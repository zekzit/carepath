from django.db.models import Avg, Count, F, Max
from django.utils import timezone

from facility.models import Node
from visits.models import VisitStep

from .models import Queue, QueueTicket


def ensure_ticket_for_step(step) -> QueueTicket:
    """Get-or-create today's Queue for the step's service point, then a WAITING
    QueueTicket for this VisitStep. Idempotent — a step that already has a
    ticket (e.g. VisitStep.start called twice) just returns it.
    """
    existing = getattr(step, "queue_ticket", None)
    if existing:
        return existing

    queue, _ = Queue.objects.get_or_create(
        service_point=step.service_point,
        queue_date=timezone.localdate(),
    )
    next_number = (QueueTicket.objects.filter(queue=queue).aggregate(Max("ticket_number"))["ticket_number__max"] or 0) + 1
    return QueueTicket.objects.create(queue=queue, visit_step=step, ticket_number=next_number)


def waiting_count_for_service_point(node, date=None) -> int:
    """Current WAITING-ticket count at `node`'s queue for `date` (default:
    today). Used by the staff "designate next step" / "insert unplanned
    step" workflows (see GAP.md FR-19/FR-20) to show the target service
    point's queue length before staff commits to sending a patient there.
    Returns 0 when there's no Queue yet for that node/date."""
    queue = Queue.objects.filter(service_point=node, queue_date=date or timezone.localdate()).first()
    if queue is None:
        return 0
    return queue.tickets.filter(status=QueueTicket.Status.WAITING).count()


def service_point_wait_stats(target_date=None) -> list[dict]:
    """Per-service-point average wait time (minutes) + DONE-step count for
    `target_date` (default: today), for the Executive Reports page's
    per-service-point bottleneck view (GAP.md FR-24).

    Only SERVICE_POINT Nodes with at least one qualifying DONE VisitStep
    (started_at and completed_at both set, started_at on target_date) are
    included — points with zero data are skipped entirely rather than
    returned with a null avg_minutes.

    Sorted by avg_minutes descending, so index 0 is the current bottleneck.

    Note: Avg() of a DurationField expression (F("completed_at") -
    F("started_at")) works fine on this project's SQLite backend (verified
    in a manage.py shell against real data) — Django's sqlite backend
    supports datetime subtraction + AVG via its own django_format_dtdelta/
    django_time_diff functions, so we use the DB-side aggregation rather
    than pulling every pair into Python.
    """
    target_date = target_date or timezone.localdate()
    results = []
    service_points = Node.objects.filter(node_type=Node.NodeType.SERVICE_POINT).order_by("id")
    for node in service_points:
        agg = VisitStep.objects.filter(
            service_point=node,
            status=VisitStep.Status.DONE,
            started_at__isnull=False,
            completed_at__isnull=False,
            started_at__date=target_date,
        ).aggregate(avg_duration=Avg(F("completed_at") - F("started_at")), done_count=Count("id"))
        done_count = agg["done_count"] or 0
        if done_count == 0:
            continue
        avg_duration = agg["avg_duration"]
        avg_minutes = avg_duration.total_seconds() / 60 if avg_duration is not None else None
        if avg_minutes is None:
            continue
        results.append(
            {
                "service_point_id": node.id,
                "name_th": node.name_th,
                "name_en": node.name_en,
                "done_count": done_count,
                "avg_minutes": round(avg_minutes, 1),
            }
        )
    results.sort(key=lambda row: row["avg_minutes"], reverse=True)
    return results
