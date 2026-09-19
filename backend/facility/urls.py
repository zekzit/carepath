from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views
from .viewsets import BuildingViewSet, EdgeViewSet, FloorViewSet, NodeViewSet

# trailing_slash=False to match the project's no-trailing-slash convention
# (see README.md and config/settings.py's APPEND_SLASH=False).
router = SimpleRouter(trailing_slash=False)
router.register("buildings", BuildingViewSet, basename="building")
router.register("floors", FloorViewSet, basename="floor")
router.register("nodes", NodeViewSet, basename="node")
router.register("edges", EdgeViewSet, basename="edge")

urlpatterns = [
    path("kiosks/<str:device_code>", views.kiosk_by_device_code, name="kiosk-by-device-code"),
    path("nodes/by-location-qr/<str:qr_code>", views.location_node_by_qr, name="location-node-by-qr"),
] + router.urls
