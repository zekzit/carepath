from rest_framework import serializers

from core.serializers import CleanOnValidateMixin
from facility.models import Node

from .models import ServiceSchedule


class ServiceScheduleSerializer(CleanOnValidateMixin, serializers.ModelSerializer):
    service_point = serializers.PrimaryKeyRelatedField(queryset=Node.objects.filter(node_type=Node.NodeType.SERVICE_POINT))

    class Meta:
        model = ServiceSchedule
        fields = ["id", "service_point", "day_of_week", "open_time", "close_time"]
