from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views
from .viewsets import PatientViewSet, VisitStepViewSet, VisitViewSet

router = SimpleRouter(trailing_slash=False)
router.register("patients", PatientViewSet, basename="patient")
router.register("visits", VisitViewSet, basename="visit")
router.register("visit-steps", VisitStepViewSet, basename="visitstep")

urlpatterns = [
    path("by-token/<str:qr_token>", views.visit_by_token, name="visit-by-token"),
    path("by-hn-today/<str:hn_code>", views.visit_by_hn_today, name="visit-by-hn-today"),
    path("stats/total-time", views.total_time_stats, name="total-time-stats"),
] + router.urls
