from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from . import services
from .models import AuditLog, ServicePointStaff, StaffUser
from .serializers import AuditLogSerializer, ServicePointStaffSerializer, StaffUserAdminSerializer


class StaffUserViewSet(ModelViewSet):
    queryset = StaffUser.objects.all().order_by("username")
    serializer_class = StaffUserAdminSerializer

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


class ServicePointStaffViewSet(ModelViewSet):
    queryset = ServicePointStaff.objects.select_related("staff_user", "service_point").all()
    serializer_class = ServicePointStaffSerializer


class AuditLogViewSet(ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("staff_user").order_by("-created_at")
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        target_type = self.request.query_params.get("target_type")
        if target_type:
            qs = qs.filter(target_type=target_type)
        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        return qs
