from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response


@extend_schema(
    summary="Liveness probe",
    description="Returns `{\"status\": \"ok\"}` as long as the Django process is serving requests.",
    responses=inline_serializer(
        name="HealthResponse",
        fields={"status": serializers.CharField()},
    ),
)
@api_view(['GET'])
def health(request):
    return Response({'status': 'ok'})
