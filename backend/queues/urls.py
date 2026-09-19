from rest_framework.routers import SimpleRouter

from .viewsets import QueueTicketViewSet, QueueViewSet, ServiceScheduleViewSet

router = SimpleRouter(trailing_slash=False)
router.register("service-schedules", ServiceScheduleViewSet, basename="serviceschedule")
router.register("queues", QueueViewSet, basename="queue")
router.register("queue-tickets", QueueTicketViewSet, basename="queueticket")

urlpatterns = router.urls
