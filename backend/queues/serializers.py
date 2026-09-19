from rest_framework import serializers

from core.serializers import CleanOnValidateMixin
from facility.models import Node

from .models import Queue, QueueTicket, ServiceSchedule


class ServiceScheduleSerializer(CleanOnValidateMixin, serializers.ModelSerializer):
    service_point = serializers.PrimaryKeyRelatedField(queryset=Node.objects.filter(node_type=Node.NodeType.SERVICE_POINT))

    class Meta:
        model = ServiceSchedule
        fields = ["id", "service_point", "day_of_week", "open_time", "close_time"]


class QueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Queue
        fields = ["id", "service_point", "queue_date", "current_number"]
        # Managed entirely by queues.services.ensure_ticket_for_step + the
        # call-next action below — no direct create/update via the API.
        read_only_fields = fields


class QueueTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = QueueTicket
        fields = ["id", "queue", "visit_step", "ticket_number", "status", "called_at"]
        # Created by queues.services.ensure_ticket_for_step, mutated only by
        # the call-next/serve/done actions below.
        read_only_fields = fields
