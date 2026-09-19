from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Node

# Patient "where am I" scanning is only meaningful for nodes that physically
# represent a place the patient can stand — junctions, vertical connectors,
# and entrances. SERVICE_POINT/KIOSK are destinations or fixed terminals, not
# "I am standing here" markers, so they're rejected explicitly.
_SCANNABLE_NODE_TYPES = (
    Node.NodeType.JUNCTION,
    Node.NodeType.VERTICAL_CONNECTOR,
    Node.NodeType.ENTRANCE,
)


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


# Phase 8 (Patient "where am I" scanning): the QR sticker on any JUNCTION /
# VERTICAL_CONNECTOR / ENTRANCE node resolves to its floor-plan position so
# the Patient Portal can compute a bearing to the patient's next service
# point — same shape as the kiosk payload, minus `device_code` and plus
# `node_type`/`id` so the frontend knows what kind of location was scanned.
@extend_schema(
    summary="Resolve a scannable location node by its location_qr_code",
    description=(
        "Public, permanent `AllowAny` — the printed `location_qr_code` "
        "sticker itself is the credential (MODELS.md § 1, S2 self-scan). "
        "Used by the Patient Portal to mark the patient's current position "
        "and compute a straight-line bearing to their next service point. "
        "Limited to `JUNCTION` / `VERTICAL_CONNECTOR` / `ENTRANCE` — those "
        "are the node types that physically represent a place a patient "
        "can stand. `SERVICE_POINT` and `KIOSK` are rejected because they "
        "are destinations/terminals, not 'I am standing here' markers."
    ),
    responses={
        200: inline_serializer(
            name="LocationNodeResponse",
            fields={
                "id": serializers.IntegerField(),
                "node_type": serializers.CharField(),
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
        400: inline_serializer(
            name="LocationNodeWrongType",
            fields={"detail": serializers.CharField()},
        ),
        404: inline_serializer(
            name="LocationNodeNotFound",
            fields={"detail": serializers.CharField()},
        ),
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def location_node_by_qr(request, qr_code):
    """Public, permanent AllowAny — see schema description above."""
    node = get_object_or_404(
        Node.objects.select_related("floor"),
        location_qr_code=qr_code,
    )
    if node.node_type not in _SCANNABLE_NODE_TYPES:
        allowed = ", ".join(t.value for t in _SCANNABLE_NODE_TYPES)
        return Response(
            {
                "detail": (
                    f"node_type {node.node_type} cannot be scanned as a patient location "
                    f"(allowed: {allowed})."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    floor = node.floor
    return Response(
        {
            "id": node.id,
            "node_type": node.node_type,
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
