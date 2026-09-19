from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Node


@api_view(["GET"])
@permission_classes([AllowAny])
def kiosk_by_device_code(request, device_code):
    """Public, permanent AllowAny — a kiosk terminal identifies itself by
    `device_code` (its own URL, e.g. /kiosk/<device_code>) and has no
    account/session of its own, same rationale as Visit.qr_token for
    patients (see MODELS.md § 1 and visits/views.py::visit_by_token).
    """
    node = get_object_or_404(Node, device_code=device_code, node_type=Node.NodeType.KIOSK)
    return Response(
        {
            "device_code": node.device_code,
            "name_th": node.name_th,
            "name_en": node.name_en,
        }
    )
