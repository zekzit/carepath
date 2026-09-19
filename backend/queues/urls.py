from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views
from .viewsets import QueueTicketViewSet, QueueViewSet, ServiceScheduleViewSet

router = SimpleRouter(trailing_slash=False)
router.register("service-schedules", ServiceScheduleViewSet, basename="serviceschedule")
router.register("queues", QueueViewSet, basename="queue")
router.register("queue-tickets", QueueTicketViewSet, basename="queueticket")

urlpatterns = [
    path("stats/wait-times", views.wait_time_stats, name="wait-time-stats"),
] + router.urls
