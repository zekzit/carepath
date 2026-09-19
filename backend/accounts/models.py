from django.contrib.auth.models import AbstractUser
from django.db import models

from facility.models import Node, validate_is_service_point


class StaffUser(AbstractUser):
    class Role(models.TextChoices):
        REGISTRAR = "REGISTRAR"
        SERVICE_STAFF = "SERVICE_STAFF"
        ADMIN = "ADMIN"
        EXECUTIVE = "EXECUTIVE"

    role = models.CharField(max_length=20, choices=Role.choices)


class ServicePointStaff(models.Model):
    staff_user = models.ForeignKey(
        StaffUser, on_delete=models.CASCADE, related_name="service_point_assignments"
    )
    service_point = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name="staff_assignments",
        limit_choices_to={"node_type": Node.NodeType.SERVICE_POINT},
    )

    class Meta:
        unique_together = [("staff_user", "service_point")]

    def clean(self):
        super().clean()
        validate_is_service_point(self.service_point)

    def __str__(self):
        return f"{self.staff_user} @ {self.service_point}"


class AuditLog(models.Model):
    staff_user = models.ForeignKey(
        StaffUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs"
    )
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=60)
    target_id = models.PositiveIntegerField()
    detail = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} {self.target_type}#{self.target_id}"
