from rest_framework.viewsets import ModelViewSet

from .models import CareCategory, PathwayTemplate, TemplateStep
from .serializers import CareCategorySerializer, PathwayTemplateSerializer, TemplateStepSerializer


class CareCategoryViewSet(ModelViewSet):
    queryset = CareCategory.objects.all().order_by("name_en")
    serializer_class = CareCategorySerializer


class PathwayTemplateViewSet(ModelViewSet):
    queryset = PathwayTemplate.objects.select_related("care_category").order_by("name_en")
    serializer_class = PathwayTemplateSerializer


class TemplateStepViewSet(ModelViewSet):
    queryset = (
        TemplateStep.objects.select_related("pathway_template", "service_point")
        .prefetch_related("prerequisite_steps")
        .all()
    )
    serializer_class = TemplateStepSerializer
