from rest_framework import serializers

from core.serializers import CleanOnValidateMixin
from facility.models import Node

from .models import CareCategory, PathwayTemplate, TemplateStep


class CareCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CareCategory
        fields = ["id", "name_th", "name_en"]


class PathwayTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PathwayTemplate
        fields = ["id", "care_category", "name_th", "name_en", "is_active"]


class TemplateStepSerializer(CleanOnValidateMixin, serializers.ModelSerializer):
    service_point = serializers.PrimaryKeyRelatedField(queryset=Node.objects.filter(node_type=Node.NodeType.SERVICE_POINT))

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
