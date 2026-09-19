from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views
from .viewsets import ServicePointStaffViewSet, StaffUserViewSet

router = SimpleRouter(trailing_slash=False)
router.register("staff-users", StaffUserViewSet, basename="staffuser")
router.register("service-point-staff", ServicePointStaffViewSet, basename="servicepointstaff")

urlpatterns = [
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("me", views.me_view, name="me"),
] + router.urls
