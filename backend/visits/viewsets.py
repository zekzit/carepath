from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import StaffUser
from accounts.permissions import RoleRequired
from accounts.services import log_action
from queues.services import ensure_ticket_for_step

from . import services
from .models import Patient, Visit, VisitStep
from .serializers import PatientSerializer, VisitSerializer, VisitStepSerializer


@extend_schema_view(
    list=extend_schema(
        summary="List patients",
        description="Optional `hn_code` substring filter (case-insensitive).",
    ),
    retrieve=extend_schema(summary="Retrieve a patient"),
    create=extend_schema(summary="Create a patient"),
    update=extend_schema(summary="Replace a patient"),
    partial_update=extend_schema(summary="Partially update a patient"),
    destroy=extend_schema(summary="Delete a patient"),
)
class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().order_by("full_name")
    serializer_class = PatientSerializer
    permission_classes = [RoleRequired]
    read_roles = (StaffUser.Role.REGISTRAR,)
    write_roles = (StaffUser.Role.REGISTRAR,)

    def get_queryset(self):
        qs = super().get_queryset()
        hn_code = self.request.query_params.get("hn_code")
        if hn_code:
            qs = qs.filter(hn_code__icontains=hn_code)
        return qs


@extend_schema_view(
    list=extend_schema(
        summary="List visits",
        description="Optional `visit_date` (YYYY-MM-DD) filter. Newest `created_at` first.",
    ),
    retrieve=extend_schema(summary="Retrieve a visit"),
    create=extend_schema(
        summary="Register a new visit",
        description=(
            "On create, the visit is `REGISTERED`, gets a fresh 64-char "
            "`qr_token`, and the chosen pathway's `TemplateStep`s are "
            "snapshotted into `VisitStep`s (with `prerequisite_steps` "
            "remapped to the new `VisitStep` ids — the snapshot is "
            "independent of the template afterwards)."
        ),
    ),
    update=extend_schema(summary="Replace a visit"),
    partial_update=extend_schema(summary="Partially update a visit"),
    destroy=extend_schema(summary="Delete a visit"),
)
class VisitViewSet(viewsets.ModelViewSet):
    queryset = Visit.objects.select_related("patient", "pathway_template").order_by("-created_at")
    serializer_class = VisitSerializer
    permission_classes = [RoleRequired]
    read_roles = (StaffUser.Role.REGISTRAR, StaffUser.Role.EXECUTIVE)
    write_roles = (StaffUser.Role.REGISTRAR,)

    def get_queryset(self):
        qs = super().get_queryset()
        visit_date = self.request.query_params.get("visit_date")
        if visit_date:
            qs = qs.filter(visit_date=visit_date)
        return qs


@extend_schema_view(
    list=extend_schema(
        summary="List visit steps",
        description="Optional `visit` (id) filter narrows to one visit.",
    ),
    retrieve=extend_schema(summary="Retrieve a visit step"),
    start=extend_schema(
        summary="Start a visit step",
        description=(
            "Allowed only from `PENDING`. 400 if any prerequisite step is "
            "not `DONE` (a `SKIPPED` one does not count — see MODELS.md § 3). "
            "On success: step → `IN_PROGRESS`, the parent visit transitions "
            "to `IN_PROGRESS` if it was `REGISTERED`, and a `QueueTicket` is "
            "ensured at the step's service point."
        ),
        request=None,
        responses={200: VisitStepSerializer, 400: {"description": "Step is not PENDING or has unmet prerequisites."}},
    ),
    complete=extend_schema(
        summary="Complete a visit step",
        description="Allowed only from `IN_PROGRESS`. Delegates to `visits.services.complete_step`.",
        request=None,
        responses={200: VisitStepSerializer, 400: {"description": "Step is not IN_PROGRESS."}},
    ),
    skip=extend_schema(
        summary="Skip a visit step",
        description=(
            "Allowed from `PENDING` or `IN_PROGRESS`. 400 if already `DONE` "
            "or `SKIPPED`. Delegates to `visits.services.skip_step`."
        ),
        request=None,
        responses={200: VisitStepSerializer, 400: {"description": "Step is already DONE or SKIPPED."}},
    ),
)
class VisitStepViewSet(viewsets.ReadOnlyModelViewSet):
    """No general update endpoint on purpose (see IMPLEMENT_PLAN.md Phase 2) —
    a step only ever moves forward through the start/complete/skip actions
    below, each of which enforces its own transition rule."""

    queryset = VisitStep.objects.select_related("visit", "service_point").prefetch_related("prerequisite_steps")
    serializer_class = VisitStepSerializer
    permission_classes = [RoleRequired]
    read_roles = (StaffUser.Role.SERVICE_STAFF,)
    write_roles = (StaffUser.Role.SERVICE_STAFF,)

    def get_queryset(self):
        qs = super().get_queryset()
        visit_id = self.request.query_params.get("visit")
        if visit_id:
            qs = qs.filter(visit_id=visit_id)
        return qs

    @extend_schema(
        summary="Start a visit step",
        description=(
            "Allowed only from `PENDING`. 400 if any prerequisite step is "
            "not `DONE` (a `SKIPPED` one does not count — see MODELS.md § 3). "
            "On success: step → `IN_PROGRESS`, the parent visit transitions "
            "to `IN_PROGRESS` if it was `REGISTERED`, and a `QueueTicket` is "
            "ensured at the step's service point."
        ),
        request=None,
        responses={200: VisitStepSerializer, 400: {"description": "Step is not PENDING or has unmet prerequisites."}},
    )
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

    @extend_schema(
        summary="Complete a visit step",
        description="Allowed only from `IN_PROGRESS`. Delegates to `visits.services.complete_step`.",
        request=None,
        responses={200: VisitStepSerializer, 400: {"description": "Step is not IN_PROGRESS."}},
    )
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        step = self.get_object()
        if step.status != VisitStep.Status.IN_PROGRESS:
            return Response({"detail": f"Step is {step.status}, not IN_PROGRESS."}, status=400)
        services.complete_step(step)
        step.refresh_from_db()
        log_action(request.user, "COMPLETE_VISIT_STEP", "VisitStep", step.id, {"visit": step.visit_id})
        return Response(VisitStepSerializer(step).data)

    @extend_schema(
        summary="Skip a visit step",
        description=(
            "Allowed from `PENDING` or `IN_PROGRESS`. 400 if already `DONE` "
            "or `SKIPPED`. Delegates to `visits.services.skip_step`."
        ),
        request=None,
        responses={200: VisitStepSerializer, 400: {"description": "Step is already DONE or SKIPPED."}},
    )
    @action(detail=True, methods=["post"])
    def skip(self, request, pk=None):
        step = self.get_object()
        if step.status in (VisitStep.Status.DONE, VisitStep.Status.SKIPPED):
            return Response({"detail": f"Step is already {step.status}."}, status=400)
        services.skip_step(step)
        step.refresh_from_db()
        log_action(request.user, "SKIP_VISIT_STEP", "VisitStep", step.id, {"visit": step.visit_id})
        return Response(VisitStepSerializer(step).data)