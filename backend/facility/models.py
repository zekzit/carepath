from django.core.exceptions import ValidationError
from django.db import models


class Building(models.Model):
    name_th = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120)
    code = models.CharField(max_length=20, unique=True)

    def __str__(self):
        return self.code


class Floor(models.Model):
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name="floors")
    level_no = models.IntegerField()
    name_th = models.CharField(max_length=80)
    name_en = models.CharField(max_length=80)
    plan_image = models.ImageField(upload_to="floor_plans/", blank=True, null=True)
    plan_scale_m_per_px = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.building.code} / {self.name_en}"


class Node(models.Model):
    class NodeType(models.TextChoices):
        SERVICE_POINT = "SERVICE_POINT"
        JUNCTION = "JUNCTION"
        VERTICAL_CONNECTOR = "VERTICAL_CONNECTOR"
        KIOSK = "KIOSK"
        ENTRANCE = "ENTRANCE"

    floor = models.ForeignKey(Floor, on_delete=models.CASCADE, related_name="nodes")
    node_type = models.CharField(max_length=30, choices=NodeType.choices)
    name_th = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120)
    pos_x = models.FloatField()
    pos_y = models.FloatField()
    vertical_group = models.CharField(max_length=80, blank=True)

    # Available on any node_type (S2 self-scan QR sticker).
    location_qr_code = models.CharField(max_length=64, blank=True, null=True, unique=True)

    # SERVICE_POINT-only fields.
    service_point_code = models.CharField(max_length=30, blank=True, null=True, unique=True)
    department_th = models.CharField(max_length=120, blank=True)
    department_en = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)

    # KIOSK-only field.
    device_code = models.CharField(max_length=60, blank=True, null=True, unique=True)

    def clean(self):
        super().clean()
        if self.node_type != self.NodeType.SERVICE_POINT:
            if self.service_point_code or self.department_th or self.department_en:
                raise ValidationError(
                    "service_point_code/department_th/department_en are only valid for SERVICE_POINT nodes."
                )
        if self.node_type != self.NodeType.KIOSK and self.device_code:
            raise ValidationError("device_code is only valid for KIOSK nodes.")

    def __str__(self):
        return self.name_en


def validate_is_service_point(node):
    if node.node_type != Node.NodeType.SERVICE_POINT:
        raise ValidationError(f"{node} is not a SERVICE_POINT node (node_type={node.node_type}).")


class Edge(models.Model):
    class EdgeType(models.TextChoices):
        CORRIDOR = "CORRIDOR"
        ELEVATOR = "ELEVATOR"
        STAIRS = "STAIRS"
        RAMP = "RAMP"

    from_node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="edges_from")
    to_node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="edges_to")
    distance_m = models.FloatField()
    edge_type = models.CharField(max_length=20, choices=EdgeType.choices)
    walk_time_sec = models.IntegerField()
    is_bidirectional = models.BooleanField(default=True)
    wheelchair_accessible = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.from_node} -> {self.to_node}"
