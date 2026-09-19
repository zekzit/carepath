from datetime import date as date_cls

from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import StaffUser
from accounts.permissions import allowed_roles

from .services import service_point_wait_stats

_wait_time_stat_payload = inline_serializer(
    name="ServicePointWaitStat",
    fields={
        "service_point_id": serializers.IntegerField(),
        "name_th": serializers.CharField(),
        "name_en": serializers.CharField(),
        "done_count": serializers.IntegerField(),
        "avg_minutes": serializers.FloatField(),
    },
)


@extend_schema(
    summary="Per-service-point average wait time + bottleneck ranking",
    description=(
        "Executive-Reports-only (GAP.md FR-24). For every SERVICE_POINT "
        "Node with at least one DONE VisitStep (both `started_at` and "
        "`completed_at` set) whose `started_at` falls on `date` (defaults "
        "to today), returns `avg_minutes` (average completed_at - "
        "started_at, in minutes) and `done_count`. Sorted by `avg_minutes` "
        "descending, so index 0 is the current bottleneck. Service points "
        "with zero qualifying DONE steps are omitted entirely."
    ),
    parameters=[],
    responses={200: serializers.ListSerializer(child=_wait_time_stat_payload)},
)
@api_view(["GET"])
@permission_classes([allowed_roles(StaffUser.Role.EXECUTIVE)])
def wait_time_stats(request):
    date_param = request.query_params.get("date")
    target_date = timezone.localdate()
    if date_param:
        try:
            target_date = date_cls.fromisoformat(date_param)
        except ValueError:
            return Response({"detail": "date must be in YYYY-MM-DD format."}, status=400)
    return Response(service_point_wait_stats(target_date))
