from django.core.exceptions import ValidationError
from django.db import models

from facility.models import Node, validate_is_service_point


class CareCategory(models.Model):
    name_th = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120)

    def __str__(self):
        return self.name_en


class PathwayTemplate(models.Model):
    care_category = models.ForeignKey(
        CareCategory, on_delete=models.PROTECT, related_name="pathway_templates"
    )
    name_th = models.CharField(max_length=150)
    name_en = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name_en


class TemplateStep(models.Model):
    pathway_template = models.ForeignKey(
        PathwayTemplate, on_delete=models.CASCADE, related_name="steps"
    )
    service_point = models.ForeignKey(
        Node,
        on_delete=models.PROTECT,
        related_name="template_steps",
        limit_choices_to={"node_type": Node.NodeType.SERVICE_POINT},
    )
    sequence_order = models.PositiveIntegerField()
    prerequisite_steps = models.ManyToManyField(
        "self", symmetrical=False, related_name="dependent_steps", blank=True
    )

    class Meta:
        ordering = ["sequence_order"]

    def clean(self):
        super().clean()
        validate_is_service_point(self.service_point)

    def __str__(self):
        return f"{self.pathway_template} #{self.sequence_order} {self.service_point}"
