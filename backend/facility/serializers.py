from rest_framework import serializers

from core.serializers import CleanOnValidateMixin

from .models import Building, Edge, Floor, Node


class BuildingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Building
        fields = ["id", "name_th", "name_en", "code"]


class FloorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Floor
        fields = ["id", "building", "level_no", "name_th", "name_en", "plan_scale_m_per_px"]
        # plan_image is uploaded separately in Phase 5 (needs multipart
        # parsing + the drag/calibrate editor) — deliberately omitted here.


class NodeSerializer(CleanOnValidateMixin, serializers.ModelSerializer):
    class Meta:
        model = Node
        fields = [
            "id",
            "floor",
            "node_type",
            "name_th",
            "name_en",
            "pos_x",
            "pos_y",
            "vertical_group",
            "location_qr_code",
            "service_point_code",
            "department_th",
            "department_en",
            "is_active",
            "device_code",
        ]


class EdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Edge
        fields = [
            "id",
            "from_node",
            "to_node",
            "distance_m",
            "edge_type",
            "walk_time_sec",
            "is_bidirectional",
            "wheelchair_accessible",
        ]
