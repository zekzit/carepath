from rest_framework.viewsets import ModelViewSet

from .models import ServiceSchedule
from .serializers import ServiceScheduleSerializer


class ServiceScheduleViewSet(ModelViewSet):
    """Master-data schedule config (Phase 1) — Queue/QueueTicket land in Phase 2."""

    queryset = ServiceSchedule.objects.select_related("service_point").order_by("service_point_id", "day_of_week")
    serializer_class = ServiceScheduleSerializer
