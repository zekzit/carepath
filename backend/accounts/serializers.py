from rest_framework import serializers

from core.serializers import CleanOnValidateMixin
from facility.models import Node

from .models import ServicePointStaff, StaffUser


class StaffUserSerializer(serializers.ModelSerializer):
    """Auth-facing shape only (login/logout/me) — keep in sync with what
    Sidebar/Topbar read on the frontend. Master Data CRUD uses
    StaffUserAdminSerializer below instead."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = StaffUser
        fields = ["id", "username", "full_name", "role"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class StaffUserAdminSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

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
    service_point = serializers.PrimaryKeyRelatedField(queryset=Node.objects.filter(node_type=Node.NodeType.SERVICE_POINT))

    class Meta:
        model = ServicePointStaff
        fields = ["id", "staff_user", "service_point"]
