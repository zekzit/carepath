from rest_framework import serializers

from core.serializers import CleanOnValidateMixin

from .models import Building, Edge, Floor, Node


class BuildingSerializer(serializers.ModelSerializer):
    code = serializers.CharField(help_text="Short unique identifier (e.g. `B1`, `OPD`).")

    class Meta:
        model = Building
        fields = ["id", "name_th", "name_en", "code"]


class FloorSerializer(serializers.ModelSerializer):
    level_no = serializers.IntegerField(help_text="Numeric level — 1 = ground, 2 = first floor up, etc.")
    plan_scale_m_per_px = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text="Metres per pixel on `plan_image`. Required for auto-calculating edge distances on this floor; leave null otherwise.",
    )
    plan_image = serializers.ImageField(
        required=False,
        allow_null=True,
        help_text="Floor plan image. Used as the visual backdrop for node coordinates.",
    )

    class Meta:
        model = Floor
        fields = ["id", "building", "level_no", "name_th", "name_en", "plan_scale_m_per_px", "plan_image"]


class NodeSerializer(CleanOnValidateMixin, serializers.ModelSerializer):
    floor = serializers.PrimaryKeyRelatedField(
        queryset=Floor.objects.all(),
        help_text="Floor this node sits on.",
    )
    node_type = serializers.ChoiceField(
        choices=Node.NodeType.choices,
        help_text="ROOM | SERVICE_POINT | KIOSK | VERTICAL_CONNECTOR.",
    )
    pos_x = serializers.FloatField(
        help_text="X coordinate on `Floor.plan_image`, in image pixels. Origin at top-left.",
    )
    pos_y = serializers.FloatField(
        help_text="Y coordinate on `Floor.plan_image`, in image pixels. Origin at top-left.",
    )
    vertical_group = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Identifier shared by vertical connectors (elevators/stairs) that serve the same shaft across floors.",
    )
    location_qr_code = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="QR payload printed at this physical location. Patients scan it to mark `Visit.current_node`.",
    )
    service_point_code = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Short business code for service-point nodes (used by templates/queues). Required when `node_type=SERVICE_POINT` (enforced in `Node.clean()`).",
    )
    device_code = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Unique per physical kiosk. Looked up via `GET /api/facility/kiosks/{device_code}`. Required when `node_type=KIOSK` (enforced in `Node.clean()`).",
    )
    is_active = serializers.BooleanField(
        required=False,
        help_text="Inactive nodes are hidden from patient-facing routing.",
    )

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
    distance_m = serializers.FloatField(
        required=False,
        help_text="Edge length in metres. Optional on create — auto-calculated from `from_node`/`to_node` positions when both are on the same calibrated floor.",
    )
    edge_type = serializers.ChoiceField(
        choices=Edge.EdgeType.choices,
        help_text="CORRIDOR | STAIRS | ELEVATOR. Affects route-finding heuristics.",
    )
    walk_time_sec = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Optional cached walk-time estimate in seconds; used by the route planner as a hint.",
    )
    is_bidirectional = serializers.BooleanField(
        required=False,
        help_text="Default true. False means the edge only goes `from_node` → `to_node`.",
    )
    wheelchair_accessible = serializers.BooleanField(
        required=False,
        help_text="If false, the route planner excludes this edge when `Visit.uses_wheelchair` is true.",
    )

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