from django.db.models import Max
from django.utils import timezone

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
