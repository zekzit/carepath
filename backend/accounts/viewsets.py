from rest_framework.viewsets import ModelViewSet

from .models import ServicePointStaff, StaffUser
from .serializers import ServicePointStaffSerializer, StaffUserAdminSerializer


class StaffUserViewSet(ModelViewSet):
    queryset = StaffUser.objects.all().order_by("username")
    serializer_class = StaffUserAdminSerializer


class ServicePointStaffViewSet(ModelViewSet):
    queryset = ServicePointStaff.objects.select_related("staff_user", "service_point").all()
    serializer_class = ServicePointStaffSerializer
