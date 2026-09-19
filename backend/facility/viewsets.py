from rest_framework.viewsets import ModelViewSet

from .models import Building
from .serializers import BuildingSerializer


class BuildingViewSet(ModelViewSet):
    """Reference pattern for Phase 1's remaining Master Data viewsets (Floor, Node, Edge, ...)."""

    queryset = Building.objects.all().order_by("code")
    serializer_class = BuildingSerializer
