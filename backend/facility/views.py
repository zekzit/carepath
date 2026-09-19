from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Node


@extend_schema(
    summary="Resolve a kiosk by its device_code",
    description=(
        "Public, permanent `AllowAny` — a kiosk terminal identifies itself "
        "by `device_code` (its own URL, e.g. `/kiosk/<device_code>`) and "
        "has no account/session of its own, same rationale as "
        "`Visit.qr_token` for patients (see MODELS.md § 1 and "
        "`visits.views.visit_by_token`). Returns the kiosk node's own "
        "floor-plan position so the kiosk UI can compute a straight-line "
        "bearing to the patient's next service point (Phase 7)."
    ),
    responses=inline_serializer(
        name="KioskResponse",
        fields={
            "device_code": serializers.CharField(),
            "name_th": serializers.CharField(),
            "name_en": serializers.CharField(),
            "pos_x": serializers.FloatField(),
            "pos_y": serializers.FloatField(),
            "floor_id": serializers.IntegerField(),
            "floor_scale_m_per_px": serializers.FloatField(allow_null=True),
            "floor_name_th": serializers.CharField(),
            "floor_name_en": serializers.CharField(),
        },
    ),
)
@api_view(["GET"])
@permission_classes([AllowAny])
def kiosk_by_device_code(request, device_code):
    """Public, permanent AllowAny — a kiosk terminal identifies itself by
    `device_code` (its own URL, e.g. /kiosk/<device_code>) and has no
    account/session of its own, same rationale as Visit.qr_token for
    patients (see MODELS.md § 1 and visits/views.py::visit_by_token).
    """
    node = get_object_or_404(
        Node.objects.select_related("floor"),
        device_code=device_code,
        node_type=Node.NodeType.KIOSK,
    )
    floor = node.floor
    return Response(
        {
            "device_code": node.device_code,
            "name_th": node.name_th,
            "name_en": node.name_en,
            "pos_x": node.pos_x,
            "pos_y": node.pos_y,
            "floor_id": floor.id,
            "floor_scale_m_per_px": floor.plan_scale_m_per_px,
            "floor_name_th": floor.name_th,
            "floor_name_en": floor.name_en,
        }
    )
