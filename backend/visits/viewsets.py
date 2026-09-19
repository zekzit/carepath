from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.services import log_action
from queues.services import ensure_ticket_for_step

from . import services
from .models import Patient, Visit, VisitStep
from .serializers import PatientSerializer, VisitSerializer, VisitStepSerializer


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().order_by("full_name")
    serializer_class = PatientSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        hn_code = self.request.query_params.get("hn_code")
        if hn_code:
            qs = qs.filter(hn_code__icontains=hn_code)
        return qs


class VisitViewSet(viewsets.ModelViewSet):
    queryset = Visit.objects.select_related("patient", "pathway_template").order_by("-created_at")
    serializer_class = VisitSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        visit_date = self.request.query_params.get("visit_date")
        if visit_date:
            qs = qs.filter(visit_date=visit_date)
        return qs


class VisitStepViewSet(viewsets.ReadOnlyModelViewSet):
    """No general update endpoint on purpose (see IMPLEMENT_PLAN.md Phase 2) —
    a step only ever moves forward through the start/complete/skip actions
    below, each of which enforces its own transition rule."""

    queryset = VisitStep.objects.select_related("visit", "service_point").prefetch_related("prerequisite_steps")
    serializer_class = VisitStepSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        visit_id = self.request.query_params.get("visit")
        if visit_id:
            qs = qs.filter(visit_id=visit_id)
        return qs

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        step = self.get_object()
        if step.status != VisitStep.Status.PENDING:
            return Response({"detail": f"Step is {step.status}, not PENDING."}, status=400)

        unmet = step.prerequisite_steps.exclude(status=VisitStep.Status.DONE)
        if unmet.exists():
            return Response(
                {"detail": "All prerequisite steps must be DONE before this step can start."}, status=400
            )

        step.status = VisitStep.Status.IN_PROGRESS
        step.started_at = timezone.now()
        step.save(update_fields=["status", "started_at"])

        if step.visit.status == Visit.Status.REGISTERED:
            step.visit.status = Visit.Status.IN_PROGRESS
            step.visit.save(update_fields=["status"])

        ensure_ticket_for_step(step)
        log_action(request.user, "START_VISIT_STEP", "VisitStep", step.id, {"visit": step.visit_id})
        return Response(VisitStepSerializer(step).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        step = self.get_object()
        if step.status != VisitStep.Status.IN_PROGRESS:
            return Response({"detail": f"Step is {step.status}, not IN_PROGRESS."}, status=400)
        services.complete_step(step)
        step.refresh_from_db()
        log_action(request.user, "COMPLETE_VISIT_STEP", "VisitStep", step.id, {"visit": step.visit_id})
        return Response(VisitStepSerializer(step).data)

    @action(detail=True, methods=["post"])
    def skip(self, request, pk=None):
        step = self.get_object()
        if step.status in (VisitStep.Status.DONE, VisitStep.Status.SKIPPED):
            return Response({"detail": f"Step is already {step.status}."}, status=400)
        services.skip_step(step)
        step.refresh_from_db()
        log_action(request.user, "SKIP_VISIT_STEP", "VisitStep", step.id, {"visit": step.visit_id})
        return Response(VisitStepSerializer(step).data)
