from rest_framework import serializers

from core.serializers import CleanOnValidateMixin
from facility.models import Node

from .models import CareCategory, PathwayTemplate, TemplateStep


class CareCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CareCategory
        fields = ["id", "name_th", "name_en"]


class PathwayTemplateSerializer(serializers.ModelSerializer):
    care_category = serializers.PrimaryKeyRelatedField(
        queryset=CareCategory.objects.all(),
        help_text="Care category this template belongs to.",
    )
    is_active = serializers.BooleanField(
        required=False,
        help_text="Inactive templates are hidden from the visit-registration picker.",
    )

    class Meta:
        model = PathwayTemplate
        fields = ["id", "care_category", "name_th", "name_en", "is_active"]


class TemplateStepSerializer(CleanOnValidateMixin, serializers.ModelSerializer):
    service_point = serializers.PrimaryKeyRelatedField(
        queryset=Node.objects.filter(node_type=Node.NodeType.SERVICE_POINT),
        help_text="Service-point node this step directs patients to.",
    )
    sequence_order = serializers.IntegerField(
        help_text="0-based ordinal within the template. Drives the default visit order; explicit `prerequisite_steps` override it for branches.",
    )
    prerequisite_steps = serializers.PrimaryKeyRelatedField(
        many=True,
        required=False,
        queryset=TemplateStep.objects.all(),
        help_text="Other `TemplateStep` ids in the same `pathway_template` that must be `DONE` before this one can start. A `SKIPPED` prerequisite does NOT count.",
    )

    class Meta:
        model = TemplateStep
        fields = ["id", "pathway_template", "service_point", "sequence_order", "prerequisite_steps"]

    def validate(self, attrs):
        attrs = super().validate(attrs)  # runs TemplateStep.clean() (service_point check)

        pathway_template = attrs.get("pathway_template") or getattr(self.instance, "pathway_template", None)
        prerequisites = attrs.get("prerequisite_steps")
        if prerequisites and pathway_template:
            mismatched = [p for p in prerequisites if p.pathway_template_id != pathway_template.id]
            if mismatched:
                raise serializers.ValidationError(
                    {"prerequisite_steps": "All prerequisite steps must belong to the same pathway_template."}
                )
        return attrs