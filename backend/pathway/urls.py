from rest_framework.routers import SimpleRouter

from .viewsets import CareCategoryViewSet, PathwayTemplateViewSet, TemplateStepViewSet

router = SimpleRouter(trailing_slash=False)
router.register("care-categories", CareCategoryViewSet, basename="carecategory")
router.register("pathway-templates", PathwayTemplateViewSet, basename="pathwaytemplate")
router.register("template-steps", TemplateStepViewSet, basename="templatestep")

urlpatterns = router.urls
