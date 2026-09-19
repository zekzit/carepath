from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.viewsets import ModelViewSet

from accounts.models import StaffUser
from accounts.permissions import RoleRequired

from .models import CareCategory, PathwayTemplate, TemplateStep
from .serializers import CareCategorySerializer, PathwayTemplateSerializer, TemplateStepSerializer


@extend_schema_view(
    list=extend_schema(summary="List care categories", description="Ordered by `name_en`."),
    retrieve=extend_schema(summary="Retrieve a care category"),
    create=extend_schema(summary="Create a care category"),
    update=extend_schema(summary="Replace a care category"),
    partial_update=extend_schema(summary="Partially update a care category"),
    destroy=extend_schema(summary="Delete a care category"),
)
class CareCategoryViewSet(ModelViewSet):
    queryset = CareCategory.objects.all().order_by("name_en")
    serializer_class = CareCategorySerializer
    permission_classes = [RoleRequired]
    read_roles = (StaffUser.Role.REGISTRAR,)
    write_roles = ()


@extend_schema_view(
    list=extend_schema(
        summary="List pathway templates",
        description=(
            "Reusable care-flow templates (`name_en` / `name_th`) under a "
            "`CareCategory`. Each has an ordered set of `TemplateStep`s "
            "that get snapshotted into `VisitStep`s when a `Visit` is "
            "created from it."
        ),
    ),
    retrieve=extend_schema(summary="Retrieve a pathway template"),
    create=extend_schema(summary="Create a pathway template"),
    update=extend_schema(summary="Replace a pathway template"),
    partial_update=extend_schema(summary="Partially update a pathway template"),
    destroy=extend_schema(summary="Delete a pathway template"),
)
class PathwayTemplateViewSet(ModelViewSet):
    queryset = PathwayTemplate.objects.select_related("care_category").order_by("name_en")
    serializer_class = PathwayTemplateSerializer
    permission_classes = [RoleRequired]
    read_roles = (StaffUser.Role.REGISTRAR,)
    write_roles = ()


@extend_schema_view(
    list=extend_schema(
        summary="List template steps",
        description="Ordered within each template by `sequence_order`. Each step targets one `service_point`.",
    ),
    retrieve=extend_schema(summary="Retrieve a template step"),
    create=extend_schema(
        summary="Create a template step",
        description="All `prerequisite_steps` must belong to the same `pathway_template`.",
    ),
    update=extend_schema(summary="Replace a template step"),
    partial_update=extend_schema(summary="Partially update a template step"),
    destroy=extend_schema(summary="Delete a template step"),
)
class TemplateStepViewSet(ModelViewSet):
    queryset = (
        TemplateStep.objects.select_related("pathway_template", "service_point")
        .prefetch_related("prerequisite_steps")
        .all()
    )
    serializer_class = TemplateStepSerializer
    permission_classes = [RoleRequired]
    read_roles = ()
    write_roles = ()