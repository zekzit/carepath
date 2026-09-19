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
