from rest_framework.routers import SimpleRouter

from .viewsets import PatientViewSet, VisitStepViewSet, VisitViewSet

router = SimpleRouter(trailing_slash=False)
router.register("patients", PatientViewSet, basename="patient")
router.register("visits", VisitViewSet, basename="visit")
router.register("visit-steps", VisitStepViewSet, basename="visitstep")

urlpatterns = router.urls
