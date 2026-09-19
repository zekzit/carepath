from rest_framework import serializers

from .models import StaffUser


class StaffUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = StaffUser
        fields = ["id", "username", "full_name", "role"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username
