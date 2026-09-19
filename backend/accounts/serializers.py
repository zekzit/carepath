from rest_framework import serializers

from core.serializers import CleanOnValidateMixin
from facility.models import Node

from .models import AuditLog, ServicePointStaff, StaffUser


class StaffUserSerializer(serializers.ModelSerializer):
    """Auth-facing shape only (login/logout/me) — keep in sync with what
    Sidebar/Topbar read on the frontend. Master Data CRUD uses
    StaffUserAdminSerializer below instead."""

    full_name = serializers.SerializerMethodField(
        help_text="`first_name last_name` if either is set, otherwise `username`.",
    )

    class Meta:
        model = StaffUser
        fields = ["id", "username", "full_name", "role"]

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.username


class StaffUserAdminSerializer(serializers.ModelSerializer):
    username = serializers.CharField(help_text="Login identifier (unique).")
    role = serializers.ChoiceField(
        choices=StaffUser.Role.choices,
        help_text="Admin Portal role — drives future permission gating.",
    )
    is_active = serializers.BooleanField(
        required=False,
        help_text="Inactive users can't log in but their historical audit rows are preserved.",
    )
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        help_text="Required on create. On update, omit to keep the current password.",
    )

    class Meta:
        model = StaffUser
        fields = ["id", "username", "first_name", "last_name", "email", "role", "is_active", "password"]

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Required when creating a new user."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = StaffUser(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ServicePointStaffSerializer(CleanOnValidateMixin, serializers.ModelSerializer):
    staff_user = serializers.PrimaryKeyRelatedField(
        queryset=StaffUser.objects.all(),
        help_text="Staff user being assigned.",
    )
    service_point = serializers.PrimaryKeyRelatedField(
        queryset=Node.objects.filter(node_type=Node.NodeType.SERVICE_POINT),
        help_text="Service-point node this staff user works at.",
    )

    class Meta:
        model = ServicePointStaff
        fields = ["id", "staff_user", "service_point"]


class AuditLogSerializer(serializers.ModelSerializer):
    """Read-only — rows are only ever written by accounts.services.log_action."""

    staff_username = serializers.SerializerMethodField(
        help_text="Username of the staff user who performed the action, or `null` for the deleted-user sentinel.",
    )
    action = serializers.CharField(
        help_text="Verb in SCREAMING_SNAKE_CASE, e.g. `LOGIN`, `CREATE_STAFF_USER`, `START_VISIT_STEP`.",
    )
    target_type = serializers.CharField(
        help_text="Model name of the entity the action targets, e.g. `StaffUser`, `VisitStep`. `null` for non-row events.",
    )
    target_id = serializers.IntegerField(
        help_text="Primary key of the target row, or `null` for non-row events.",
    )
    detail = serializers.JSONField(
        help_text="Free-form structured payload with action-specific context (e.g. `{\"visit\": 42}`).",
    )

    class Meta:
        model = AuditLog
        fields = ["id", "staff_user", "staff_username", "action", "target_type", "target_id", "detail", "created_at"]

    def get_staff_username(self, obj) -> str | None:
        return obj.staff_user.username if obj.staff_user else None