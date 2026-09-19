from rest_framework import serializers

from .models import Building


class BuildingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Building
        fields = ["id", "name_th", "name_en", "code"]
