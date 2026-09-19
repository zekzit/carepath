from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from . import services
from .models import AuditLog, ServicePointStaff, StaffUser
from .permissions import RoleRequired
from .serializers import AuditLogSerializer, ServicePointStaffSerializer, StaffUserAdminSerializer


@extend_schema_view(
    list=extend_schema(summary="List staff users", description="All staff users (any role), ordered by username."),
    retrieve=extend_schema(summary="Retrieve a staff user"),
    create=extend_schema(summary="Create a staff user", description="Password is required on create; the audit log gets an action `CREATE_STAFF_USER`."),
    update=extend_schema(summary="Replace a staff user", description="Full replace; omit `password` to keep the existing one, otherwise it's reset. Audit log action `UPDATE_STAFF_USER`."),
    partial_update=extend_schema(summary="Partially update a staff user"),
    destroy=extend_schema(summary="Delete a staff user", description="Audit log action `DELETE_STAFF_USER` captures the username before deletion."),
)
class StaffUserViewSet(ModelViewSet):
    queryset = StaffUser.objects.all().order_by("username")
    serializer_class = StaffUserAdminSerializer
    permission_classes = [RoleRequired]
    read_roles = ()
    write_roles = ()

    def perform_create(self, serializer):
        instance = serializer.save()
        services.log_action(
            self.request.user, "CREATE_STAFF_USER", "StaffUser", instance.id,
            {"username": instance.username, "role": instance.role},
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        services.log_action(
            self.request.user, "UPDATE_STAFF_USER", "StaffUser", instance.id,
            {"username": instance.username, "role": instance.role},
        )

    def perform_destroy(self, instance):
        target_id, username = instance.id, instance.username
        instance.delete()
        services.log_action(self.request.user, "DELETE_STAFF_USER", "StaffUser", target_id, {"username": username})


@extend_schema_view(
    list=extend_schema(summary="List service-point staff assignments", description="Pairs of (staff_user, service_point) — i.e. which staff work at which service point."),
    retrieve=extend_schema(summary="Retrieve a service-point staff assignment"),
    create=extend_schema(summary="Create a service-point staff assignment"),
    update=extend_schema(summary="Replace a service-point staff assignment"),
    partial_update=extend_schema(summary="Partially update a service-point staff assignment"),
    destroy=extend_schema(summary="Delete a service-point staff assignment"),
)
class ServicePointStaffViewSet(ModelViewSet):
    queryset = ServicePointStaff.objects.select_related("staff_user", "service_point").all()
    serializer_class = ServicePointStaffSerializer
    permission_classes = [RoleRequired]
    read_roles = ()
    write_roles = ()


@extend_schema_view(
    list=extend_schema(
        summary="List audit log entries",
        description="Newest-first. Optional filters: `target_type` (e.g. `StaffUser`), `action` (e.g. `LOGIN`).",
    ),
    retrieve=extend_schema(summary="Retrieve a single audit log entry"),
)
class AuditLogViewSet(ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("staff_user").order_by("-created_at")
    serializer_class = AuditLogSerializer
    permission_classes = [RoleRequired]
    read_roles = (StaffUser.Role.EXECUTIVE,)

    def get_queryset(self):
        qs = super().get_queryset()
        target_type = self.request.query_params.get("target_type")
        if target_type:
            qs = qs.filter(target_type=target_type)
        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        return qs