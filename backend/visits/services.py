from django.utils import timezone

from .models import Visit, VisitStep


def sync_visit_completion(visit: Visit) -> None:
    """Marks the Visit COMPLETED once every one of its steps is DONE or SKIPPED."""
    terminal = {VisitStep.Status.DONE, VisitStep.Status.SKIPPED}
    statuses = set(visit.steps.values_list("status", flat=True))
    if statuses and statuses.issubset(terminal):
        visit.status = Visit.Status.COMPLETED
        visit.completed_at = timezone.now()
        visit.save(update_fields=["status", "completed_at"])


def start_step(step: VisitStep) -> None:
    """The single place a VisitStep transitions PENDING -> IN_PROGRESS: flips
    the parent Visit to IN_PROGRESS if it was still REGISTERED, and ensures a
    QueueTicket exists at the step's service point. Used both by
    VisitStepViewSet.start (staff clicking "start") and VisitSerializer.create
    (auto-starting the pathway's root step(s) immediately on registration).
    """
    from queues.services import ensure_ticket_for_step  # local import: queues already depends on visits.models

    if step.status != VisitStep.Status.PENDING:
        return

    step.status = VisitStep.Status.IN_PROGRESS
    step.started_at = timezone.now()
    step.save(update_fields=["status", "started_at"])

    if step.visit.status == Visit.Status.REGISTERED:
        step.visit.status = Visit.Status.IN_PROGRESS
        step.visit.save(update_fields=["status"])

    ensure_ticket_for_step(step)


def complete_step(step: VisitStep) -> None:
    """The single place a VisitStep is marked DONE — keeps its QueueTicket (if
    any) and the parent Visit's completion status in sync, regardless of
    whether this was triggered from the step itself (VisitStepViewSet.complete)
    or from the queue console (QueueTicketViewSet.done).
    """
    from queues.models import QueueTicket  # local import: queues already depends on visits.models

    if step.status == VisitStep.Status.DONE:
        return

    step.status = VisitStep.Status.DONE
    step.completed_at = timezone.now()
    step.save(update_fields=["status", "completed_at"])

    ticket = getattr(step, "queue_ticket", None)
    if ticket and ticket.status != QueueTicket.Status.DONE:
        ticket.status = QueueTicket.Status.DONE
        ticket.save(update_fields=["status"])

    sync_visit_completion(step.visit)


def eligible_next_steps(visit, completing_or_skipping_step):
    """PENDING VisitSteps in `visit` (other than the step itself) that would
    become eligible once `completing_or_skipping_step` is counted as
    resolved — i.e. every one of their `prerequisite_steps` is either
    already DONE, or IS `completing_or_skipping_step`. Shared by every
    "complete/skip a step" entry point (VisitStepViewSet.complete/skip and
    QueueTicketViewSet.done) so they don't duplicate this logic or drift out
    of sync (GAP.md FR-19/FR-21)."""
    candidates = (
        visit.steps.filter(status=VisitStep.Status.PENDING)
        .exclude(id=completing_or_skipping_step.id)
        .select_related("service_point")
        .prefetch_related("prerequisite_steps")
    )
    eligible = []
    for candidate in candidates:
        prereqs = list(candidate.prerequisite_steps.all())
        if all(
            p.id == completing_or_skipping_step.id or p.status == VisitStep.Status.DONE
            for p in prereqs
        ):
            eligible.append(candidate)
    return eligible


def eligible_next_steps_payload(eligible_next):
    """Body for the 409 "designate next step(s)" preview response."""
    from queues.services import waiting_count_for_service_point  # local import: visits already depends on queues elsewhere in this module

    return {
        "detail": (
            "This step unlocks one or more follow-up steps — specify "
            "next_step_ids to designate which the patient goes to next."
        ),
        "eligible_next_steps": [
            {
                "id": s.id,
                "service_point": {
                    "id": s.service_point_id,
                    "name_th": s.service_point.name_th,
                    "name_en": s.service_point.name_en,
                },
                "waiting_count": waiting_count_for_service_point(s.service_point),
            }
            for s in eligible_next
        ],
    }


def skip_step(step: VisitStep) -> None:
    from queues.models import QueueTicket

    if step.status in (VisitStep.Status.DONE, VisitStep.Status.SKIPPED):
        return

    step.status = VisitStep.Status.SKIPPED
    step.save(update_fields=["status"])

    ticket = getattr(step, "queue_ticket", None)
    if ticket and ticket.status not in (QueueTicket.Status.DONE, QueueTicket.Status.SKIPPED):
        ticket.status = QueueTicket.Status.SKIPPED
        ticket.save(update_fields=["status"])

    sync_visit_completion(step.visit)
