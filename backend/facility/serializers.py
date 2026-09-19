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
        fields = ["id", "building", "level_no", "name_th", "name_en", "plan_scale_m_per_px", "plan_image"]


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
    # MODELS.md § 1 (Edge.distance_m): "คำนวณจาก pos_x/pos_y × scale หรือกรอกระยะจริง" —
    # optional here so it can be auto-calculated in validate() below when omitted.
    distance_m = serializers.FloatField(required=False)

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

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get("distance_m") is not None:
            return attrs

        from_node = attrs.get("from_node") or getattr(self.instance, "from_node", None)
        to_node = attrs.get("to_node") or getattr(self.instance, "to_node", None)
        computed = self._auto_distance(from_node, to_node)
        if computed is None:
            raise serializers.ValidationError(
                {
                    "distance_m": (
                        "Could not auto-calculate — from_node/to_node must be on the same "
                        "calibrated floor (Floor.plan_scale_m_per_px set), otherwise enter it manually."
                    )
                }
            )
        attrs["distance_m"] = computed
        return attrs

    @staticmethod
    def _auto_distance(from_node, to_node):
        if from_node is None or to_node is None or from_node.floor_id != to_node.floor_id:
            return None
        scale = from_node.floor.plan_scale_m_per_px
        if not scale:
            return None
        dx = from_node.pos_x - to_node.pos_x
        dy = from_node.pos_y - to_node.pos_y
        return round(((dx**2 + dy**2) ** 0.5) * scale, 2)
