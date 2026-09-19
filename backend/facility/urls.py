from rest_framework.routers import SimpleRouter

from .viewsets import BuildingViewSet

# trailing_slash=False to match the project's no-trailing-slash convention
# (see README.md and config/settings.py's APPEND_SLASH=False).
router = SimpleRouter(trailing_slash=False)
router.register("buildings", BuildingViewSet, basename="building")

urlpatterns = router.urls
