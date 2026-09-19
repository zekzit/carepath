from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Queue, QueueTicket, ServiceSchedule
from .serializers import QueueSerializer, QueueTicketSerializer, ServiceScheduleSerializer


class ServiceScheduleViewSet(ModelViewSet):
    """Master-data schedule config (Phase 1)."""

    queryset = ServiceSchedule.objects.select_related("service_point").order_by("service_point_id", "day_of_week")
    serializer_class = ServiceScheduleSerializer


class QueueViewSet(viewsets.ReadOnlyModelViewSet):
    """Queue rows are created lazily by queues.services.ensure_ticket_for_step
    (the first VisitStep started at a service point on a given day) — there's
    no direct create endpoint. Defaults to today's queues unless `queue_date`
    is given, since that's what the Queue Console cares about."""

    queryset = Queue.objects.select_related("service_point").order_by("-queue_date")
    serializer_class = QueueSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        service_point = self.request.query_params.get("service_point")
        if service_point:
            qs = qs.filter(service_point_id=service_point)
        queue_date = self.request.query_params.get("queue_date")
        qs = qs.filter(queue_date=queue_date) if queue_date else qs.filter(queue_date=timezone.localdate())
        return qs

    @action(detail=True, methods=["post"], url_path="call-next")
    def call_next(self, request, pk=None):
        queue = self.get_object()
        next_ticket = queue.tickets.filter(status=QueueTicket.Status.WAITING).order_by("ticket_number").first()
        if not next_ticket:
            return Response({"detail": "No waiting tickets in this queue."}, status=400)

        next_ticket.status = QueueTicket.Status.CALLED
        next_ticket.called_at = timezone.now()
        next_ticket.save(update_fields=["status", "called_at"])

        queue.current_number = next_ticket.ticket_number
        queue.save(update_fields=["current_number"])

        return Response(QueueSerializer(queue).data)


class QueueTicketViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = QueueTicket.objects.select_related("queue", "visit_step__visit__patient")
    serializer_class = QueueTicketSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        queue_id = self.request.query_params.get("queue")
        if queue_id:
            qs = qs.filter(queue_id=queue_id)
        return qs

    @action(detail=True, methods=["post"])
    def serve(self, request, pk=None):
        ticket = self.get_object()
        if ticket.status != QueueTicket.Status.CALLED:
            return Response({"detail": f"Ticket is {ticket.status}, not CALLED."}, status=400)
        ticket.status = QueueTicket.Status.SERVING
        ticket.save(update_fields=["status"])
        return Response(QueueTicketSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    def done(self, request, pk=None):
        from visits.services import complete_step  # visits already depends on queues; keep the reverse edge local

        ticket = self.get_object()
        if ticket.status not in (QueueTicket.Status.CALLED, QueueTicket.Status.SERVING):
            return Response({"detail": f"Ticket is {ticket.status}, cannot be marked done."}, status=400)
        complete_step(ticket.visit_step)
        ticket.refresh_from_db()
        return Response(QueueTicketSerializer(ticket).data)
