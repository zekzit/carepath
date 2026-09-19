from rest_framework.routers import SimpleRouter

from .viewsets import ServiceScheduleViewSet

router = SimpleRouter(trailing_slash=False)
router.register("service-schedules", ServiceScheduleViewSet, basename="serviceschedule")

urlpatterns = router.urls
