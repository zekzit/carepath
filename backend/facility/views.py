from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Node
from .routing import shortest_path

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
            "id": serializers.IntegerField(),
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
            "id": node.id,
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


# FR-13/FR-12/FR-17: real shortest-path routing over the facility graph
# (replaces the old "compass bearing only" fake navigation in
# frontend/lib/direction.ts). Public, permanent `AllowAny` — same rationale
# as kiosk_by_device_code/location_node_by_qr above: the Patient Portal and
# Kiosk call this with no staff session, only a qr_token/device_code.
@extend_schema(
    summary="Compute the shortest path between two facility nodes",
    description=(
        "Public, permanent `AllowAny` — used by the un-authenticated "
        "Patient Portal and Kiosk to render turn-by-turn directions "
        "(distance/time/turns/floor changes) to the patient's next "
        "service point, replacing the old straight-line compass bearing. "
        "Runs Dijkstra over the full building graph "
        "(`facility.routing.shortest_path`), weighted by `walk_time_sec`, "
        "and — when `wheelchair=true` — excludes every edge with "
        "`wheelchair_accessible=False` from the graph entirely, so "
        "wheelchair patients automatically get a stairs-avoiding route."
    ),
    responses={
        200: inline_serializer(
            name="RouteResponse",
            fields={
                "reachable": serializers.BooleanField(),
                "total_distance_m": serializers.FloatField(),
                "total_time_sec": serializers.IntegerField(),
                "legs": inline_serializer(
                    name="RouteLegResponse",
                    many=True,
                    fields={
                        "from_node_id": serializers.IntegerField(),
                        "to_node_id": serializers.IntegerField(),
                        "edge_type": serializers.CharField(),
                        "distance_m": serializers.FloatField(),
                        "walk_time_sec": serializers.IntegerField(),
                        "turn": serializers.CharField(allow_null=True),
                        "to_floor_id": serializers.IntegerField(),
                        "to_floor_name_th": serializers.CharField(),
                        "to_floor_name_en": serializers.CharField(),
                    },
                ),
            },
        ),
        400: inline_serializer(
            name="RouteBadRequest",
            fields={"detail": serializers.CharField()},
        ),
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def route_between_nodes(request):
    """Public, permanent AllowAny — see schema description above."""
    from_raw = request.query_params.get("from_node")
    to_raw = request.query_params.get("to_node")
    if from_raw is None or to_raw is None:
        return Response(
            {"detail": "Both from_node and to_node query params are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        from_node_id = int(from_raw)
        to_node_id = int(to_raw)
    except (TypeError, ValueError):
        return Response(
            {"detail": "from_node and to_node must be integer node ids."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    wheelchair_raw = (request.query_params.get("wheelchair") or "").strip().lower()
    wheelchair = wheelchair_raw in ("true", "1")

    existing_ids = set(
        Node.objects.filter(id__in=[from_node_id, to_node_id]).values_list("id", flat=True)
    )
    if from_node_id not in existing_ids or to_node_id not in existing_ids:
        return Response(
            {"detail": "from_node and/or to_node do not match an existing Node id."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = shortest_path(from_node_id, to_node_id, wheelchair=wheelchair)

    if not result.reachable:
        return Response(
            {
                "reachable": False,
                "total_distance_m": 0.0,
                "total_time_sec": 0,
                "legs": [],
            }
        )

    # Bulk-fetch every leg's destination node (+ floor) in one query so the
    # frontend can announce floor changes without a second round-trip.
    to_node_ids = [leg.to_node_id for leg in result.legs]
    nodes_by_id = Node.objects.select_related("floor").in_bulk(to_node_ids)

    legs_payload = []
    for leg in result.legs:
        to_node = nodes_by_id[leg.to_node_id]
        legs_payload.append(
            {
                "from_node_id": leg.from_node_id,
                "to_node_id": leg.to_node_id,
                "edge_type": leg.edge_type,
                "distance_m": leg.distance_m,
                "walk_time_sec": leg.walk_time_sec,
                "turn": leg.turn,
                "to_floor_id": to_node.floor_id,
                "to_floor_name_th": to_node.floor.name_th,
                "to_floor_name_en": to_node.floor.name_en,
            }
        )

    return Response(
        {
            "reachable": True,
            "total_distance_m": result.total_distance_m,
            "total_time_sec": result.total_time_sec,
            "legs": legs_payload,
        }
    )
