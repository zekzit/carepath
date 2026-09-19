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
