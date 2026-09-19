from rest_framework.viewsets import ModelViewSet

from .models import Building, Edge, Floor, Node
from .serializers import BuildingSerializer, EdgeSerializer, FloorSerializer, NodeSerializer


class BuildingViewSet(ModelViewSet):
    queryset = Building.objects.all().order_by("code")
    serializer_class = BuildingSerializer


class FloorViewSet(ModelViewSet):
    queryset = Floor.objects.select_related("building").order_by("building__code", "level_no")
    serializer_class = FloorSerializer


class NodeViewSet(ModelViewSet):
    queryset = Node.objects.select_related("floor").order_by("floor_id", "name_en")
    serializer_class = NodeSerializer


class EdgeViewSet(ModelViewSet):
    queryset = Edge.objects.select_related("from_node", "to_node").all()
    serializer_class = EdgeSerializer
