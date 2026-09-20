from django.db import transaction
from django.db.models import F
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import StaffUser
from accounts.permissions import RoleRequired
from accounts.services import log_action
from facility.models import Node
from queues.services import waiting_count_for_service_point

from . import services
from .models import Patient, Visit, VisitStep
from .serializers import PatientSerializer, VisitSerializer, VisitStepSerializer


_eligible_next_step_option_schema = inline_serializer(
    name="EligibleNextStepOption",
    fields={
        "id": serializers.IntegerField(),
        "service_point": inline_serializer(
            name="EligibleNextStepServicePoint",
            fields={
                "id": serializers.IntegerField(),
                "name_th": serializers.CharField(),
                "name_en": serializers.CharField(),
            },
        ),
        "waiting_count": serializers.IntegerField(),
    },
)
_designation_required_response_schema = inline_serializer(
    name="DesignationRequiredResponse",
    fields={
        "detail": serializers.CharField(),
        "eligible_next_steps": serializers.ListField(child=_eligible_next_step_option_schema),
    },
)
_next_step_ids_request_schema = inline_serializer(
    name="CompleteOrSkipVisitStepRequest",
    fields={
        "next_step_ids": serializers.ListField(
            child=serializers.IntegerField(),
            required=False,
            help_text=(
                "Ids of the eligible-next VisitSteps (from a prior 409's "
                "eligible_next_steps) that staff designates as where the "
                "patient goes next. Omit to get the 409 preview when this "
                "action would unlock one or more follow-up steps."
            ),
        ),
    },
)


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
            "Allowed only from `PENDING` AND `is_next=True` — i.e. staff "
            "must have already designated this step as where the patient "
            "goes next (see the `complete`/`skip` actions' `next_step_ids`, "
            "or the pathway's root step(s), auto-designated at registration). "
            "400 if not `PENDING`, 400 if not designated (`is_next=False`), "
            "and 400 if any prerequisite step is not `DONE` (a `SKIPPED` one "
            "does not count — see MODELS.md § 3; kept as defense in depth "
            "even though `is_next` is only ever set once prerequisites are "
            "already satisfied). On success: step → `IN_PROGRESS`, the "
            "parent visit transitions to `IN_PROGRESS` if it was "
            "`REGISTERED`, and a `QueueTicket` is ensured at the step's "
            "service point."
        ),
        request=None,
        responses={
            200: VisitStepSerializer,
            400: {"description": "Step is not PENDING, not staff-designated (is_next=False), or has unmet prerequisites."},
        },
    ),
    complete=extend_schema(
        summary="Complete a visit step",
        description=(
            "Allowed only from `IN_PROGRESS`. If completing this step would "
            "unlock one or more follow-up PENDING steps (all their other "
            "prerequisites already DONE) and the request did not include "
            "`next_step_ids`, returns 409 with the list of eligible options "
            "(and each target service point's current queue length) instead "
            "of completing anything. Pass `next_step_ids` (a subset of that "
            "list) to complete the step AND designate exactly those as "
            "`is_next=True`. Delegates to `visits.services.complete_step`."
        ),
        request=_next_step_ids_request_schema,
        responses={
            200: VisitStepSerializer,
            400: {"description": "Step is not IN_PROGRESS, or next_step_ids contains an invalid/ineligible id."},
            409: _designation_required_response_schema,
        },
    ),
    skip=extend_schema(
        summary="Skip a visit step",
        description=(
            "Allowed from `PENDING` or `IN_PROGRESS`. 400 if already `DONE` "
            "or `SKIPPED`. Same `next_step_ids` / 409-preview designation "
            "mechanism as `complete` — skipping a step can unlock follow-up "
            "steps just like completing one does. Delegates to "
            "`visits.services.skip_step`."
        ),
        request=_next_step_ids_request_schema,
        responses={
            200: VisitStepSerializer,
            400: {"description": "Step is already DONE or SKIPPED, or next_step_ids contains an invalid/ineligible id."},
            409: _designation_required_response_schema,
        },
    ),
)
class VisitStepViewSet(viewsets.ReadOnlyModelViewSet):
    """No general update endpoint on purpose (see IMPLEMENT_PLAN.md Phase 2) —
    a step only ever moves forward through the start/complete/skip actions
    below, each of which enforces its own transition rule."""

    queryset = VisitStep.objects.select_related("visit", "service_point").prefetch_related("prerequisite_steps")
    serializer_class = VisitStepSerializer
    permission_classes = [RoleRequired]
    # EXECUTIVE reads step-level data for reporting (avg. steps/visit,
    # wait-time/bottleneck aggregation on the Executive Reports page —
    # GAP.md FR-24). Executives already have read access to Visit/Queue
    # elsewhere in this same scheme, so this is a small, justified read-only
    # widening, not a rollback of the RBAC work — write_roles stays
    # SERVICE_STAFF-only, so Executives still can't start/complete/skip/
    # insert steps.
    read_roles = (StaffUser.Role.SERVICE_STAFF, StaffUser.Role.EXECUTIVE)
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
            "Allowed only from `PENDING` AND `is_next=True` — staff must "
            "have already designated this step as where the patient goes "
            "next. 400 if not `PENDING`, 400 if not designated, and 400 if "
            "any prerequisite step is not `DONE` (a `SKIPPED` one does not "
            "count — see MODELS.md § 3; kept as defense in depth). On "
            "success: step → `IN_PROGRESS`, the parent visit transitions to "
            "`IN_PROGRESS` if it was `REGISTERED`, and a `QueueTicket` is "
            "ensured at the step's service point."
        ),
        request=None,
        responses={
            200: VisitStepSerializer,
            400: {"description": "Step is not PENDING, not staff-designated (is_next=False), or has unmet prerequisites."},
        },
    )
    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        step = self.get_object()
        if step.status != VisitStep.Status.PENDING:
            return Response({"detail": f"Step is {step.status}, not PENDING."}, status=400)

        if not step.is_next:
            return Response(
                {"detail": "This step has not been designated as the next step by staff yet."}, status=400
            )

        unmet = step.prerequisite_steps.exclude(status=VisitStep.Status.DONE)
        if unmet.exists():
            return Response(
                {"detail": "All prerequisite steps must be DONE before this step can start."}, status=400
            )

        services.start_step(step)
        step.refresh_from_db()
        log_action(request.user, "START_VISIT_STEP", "VisitStep", step.id, {"visit": step.visit_id})
        return Response(VisitStepSerializer(step).data)

    @extend_schema(
        summary="Complete a visit step",
        description=(
            "Allowed only from `IN_PROGRESS`. If completing this step would "
            "unlock one or more follow-up PENDING steps and the request did "
            "not include `next_step_ids`, returns 409 with the eligible "
            "options instead of completing anything. Pass `next_step_ids` "
            "to complete AND designate exactly those as `is_next=True`. "
            "Delegates to `visits.services.complete_step`."
        ),
        request=_next_step_ids_request_schema,
        responses={
            200: VisitStepSerializer,
            400: {"description": "Step is not IN_PROGRESS, or next_step_ids contains an invalid/ineligible id."},
            409: _designation_required_response_schema,
        },
    )
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        step = self.get_object()
        if step.status != VisitStep.Status.IN_PROGRESS:
            return Response({"detail": f"Step is {step.status}, not IN_PROGRESS."}, status=400)

        eligible_next = services.eligible_next_steps(step.visit, step)
        next_step_ids = request.data.get("next_step_ids")

        if eligible_next and next_step_ids is None:
            return Response(services.eligible_next_steps_payload(eligible_next), status=409)

        if next_step_ids is not None:
            eligible_ids = {s.id for s in eligible_next}
            invalid = [nid for nid in next_step_ids if nid not in eligible_ids]
            if invalid:
                return Response(
                    {"detail": f"next_step_ids contains ids that are not eligible next steps for this visit: {invalid}"},
                    status=400,
                )

        services.complete_step(step)
        step.refresh_from_db()

        if next_step_ids:
            VisitStep.objects.filter(id__in=next_step_ids).update(is_next=True)

        log_action(
            request.user,
            "COMPLETE_VISIT_STEP",
            "VisitStep",
            step.id,
            {"visit": step.visit_id, "next_step_ids": next_step_ids},
        )
        return Response(VisitStepSerializer(step).data)

    @extend_schema(
        summary="Skip a visit step",
        description=(
            "Allowed from `PENDING` or `IN_PROGRESS`. 400 if already `DONE` "
            "or `SKIPPED`. Same `next_step_ids` / 409-preview designation "
            "mechanism as `complete` — skipping a step can unlock follow-up "
            "steps just like completing one does. Delegates to "
            "`visits.services.skip_step`."
        ),
        request=_next_step_ids_request_schema,
        responses={
            200: VisitStepSerializer,
            400: {"description": "Step is already DONE or SKIPPED, or next_step_ids contains an invalid/ineligible id."},
            409: _designation_required_response_schema,
        },
    )
    @action(detail=True, methods=["post"])
    def skip(self, request, pk=None):
        step = self.get_object()
        if step.status in (VisitStep.Status.DONE, VisitStep.Status.SKIPPED):
            return Response({"detail": f"Step is already {step.status}."}, status=400)

        eligible_next = services.eligible_next_steps(step.visit, step)
        next_step_ids = request.data.get("next_step_ids")

        if eligible_next and next_step_ids is None:
            return Response(services.eligible_next_steps_payload(eligible_next), status=409)

        if next_step_ids is not None:
            eligible_ids = {s.id for s in eligible_next}
            invalid = [nid for nid in next_step_ids if nid not in eligible_ids]
            if invalid:
                return Response(
                    {"detail": f"next_step_ids contains ids that are not eligible next steps for this visit: {invalid}"},
                    status=400,
                )

        services.skip_step(step)
        step.refresh_from_db()

        if next_step_ids:
            VisitStep.objects.filter(id__in=next_step_ids).update(is_next=True)

        log_action(
            request.user,
            "SKIP_VISIT_STEP",
            "VisitStep",
            step.id,
            {"visit": step.visit_id, "next_step_ids": next_step_ids},
        )
        return Response(VisitStepSerializer(step).data)

    @extend_schema(
        summary="Insert an unplanned (ad-hoc) step mid-visit",
        description=(
            "Staff, standing at their own current VisitStep (`{id}` — "
            "typically `IN_PROGRESS`, but not required to be), inserts a "
            "new ad-hoc (`is_planned=False`) VisitStep at `service_point` "
            "for the same visit (e.g. a doctor ordering an extra chest "
            "X-ray mid-consult). The new step's sole prerequisite is `{id}`'s "
            "step. Any already-PENDING step that currently depends on `{id}`'s "
            "step is AUTOMATICALLY given the new step as an extra prerequisite "
            "too, so it waits for the unplanned step instead of becoming "
            "eligible in parallel with it. `insert_before_step_ids` still "
            "works the same way for any additional, non-obvious targets — "
            "gets the new step ADDED to its existing prerequisites (never "
            "replacing them), so existing ordering is only tightened, never "
            "broken. `sequence_order` for every other step in the visit at "
            "or after the insertion point — and for any `insert_before_step_ids` "
            "target that was sequenced earlier (e.g. on another branch) — is "
            "adjusted for display purposes only; `prerequisite_steps` is what "
            "actually enforces ordering. If `{id}`'s step is still PENDING or "
            "IN_PROGRESS, the new step starts with `is_next=False` and "
            "becomes designable the moment `{id}`'s step is completed/skipped, "
            "via that action's `next_step_ids` mechanism, with no special-case "
            "wiring needed. If `{id}`'s step is already `DONE`/`SKIPPED`, its "
            "prerequisite is already satisfied and it will never be "
            "completed/skipped again — so the new step is immediately given "
            "`is_next=True` instead, or it would be stuck PENDING forever. "
            "See GAP.md FR-20."
        ),
        request=inline_serializer(
            name="InsertNextStepRequest",
            fields={
                "service_point": serializers.IntegerField(
                    help_text="Node id of the target service point — must be node_type=SERVICE_POINT."
                ),
                "insert_before_step_ids": serializers.ListField(
                    child=serializers.IntegerField(),
                    required=False,
                    help_text="VisitStep ids (same visit) to add the new step as an extra prerequisite of. Defaults to [].",
                ),
            },
        ),
        responses={
            201: inline_serializer(
                name="InsertNextStepResponse",
                fields={
                    "id": serializers.IntegerField(),
                    "visit": serializers.IntegerField(),
                    "service_point": serializers.IntegerField(),
                    "sequence_order": serializers.IntegerField(),
                    "prerequisite_steps": serializers.ListField(child=serializers.IntegerField()),
                    "status": serializers.CharField(),
                    "is_planned": serializers.BooleanField(),
                    "is_next": serializers.BooleanField(),
                    "started_at": serializers.DateTimeField(allow_null=True),
                    "completed_at": serializers.DateTimeField(allow_null=True),
                    "target_queue_waiting_count": serializers.IntegerField(
                        help_text="waiting_count_for_service_point(service_point) at insertion time."
                    ),
                },
            ),
            400: {
                "description": (
                    "service_point is not an existing SERVICE_POINT node, or "
                    "insert_before_step_ids references an unknown id or a "
                    "VisitStep from a different visit."
                )
            },
        },
    )
    @action(detail=True, methods=["post"], url_path="insert-next")
    def insert_next(self, request, pk=None):
        current_step = self.get_object()
        visit = current_step.visit

        service_point_id = request.data.get("service_point")
        node = Node.objects.filter(id=service_point_id).first()
        if node is None or node.node_type != Node.NodeType.SERVICE_POINT:
            return Response(
                {"detail": "service_point must be the id of an existing SERVICE_POINT node."}, status=400
            )

        insert_before_step_ids = request.data.get("insert_before_step_ids") or []
        insert_before_steps = list(VisitStep.objects.filter(id__in=insert_before_step_ids))
        found_ids = {s.id for s in insert_before_steps}
        missing = [sid for sid in insert_before_step_ids if sid not in found_ids]
        if missing:
            return Response(
                {"detail": f"insert_before_step_ids references unknown VisitStep ids: {missing}"}, status=400
            )
        cross_visit = [s.id for s in insert_before_steps if s.visit_id != visit.id]
        if cross_visit:
            return Response(
                {"detail": f"insert_before_step_ids must belong to the same visit as this step: {cross_visit}"},
                status=400,
            )

        # Any already-PENDING step that depends on current_step would
        # otherwise become eligible in parallel with the new step the moment
        # current_step resolves (see services.eligible_next_steps). Chain them
        # automatically so the insert is sequential, not parallel, without
        # staff having to hand-pick targets via insert_before_step_ids.
        auto_targets = current_step.dependent_steps.filter(
            visit=visit, status=VisitStep.Status.PENDING
        ).exclude(id__in=found_ids)
        insert_before_steps += list(auto_targets)

        with transaction.atomic():
            new_sequence_order = current_step.sequence_order + 1
            VisitStep.objects.filter(visit=visit, sequence_order__gte=new_sequence_order).update(
                sequence_order=F("sequence_order") + 1
            )
            new_step = VisitStep.objects.create(
                visit=visit,
                service_point=node,
                sequence_order=new_sequence_order,
                is_planned=False,
                # current_step is already DONE/SKIPPED, so it can never be
                # completed/skipped again to designate this step via the
                # normal next_step_ids mechanism (complete/skip both reject
                # a step that isn't IN_PROGRESS/PENDING) — the sole
                # prerequisite is already resolved, so designate it now or
                # it would be permanently stuck PENDING/is_next=False.
                is_next=current_step.status in (VisitStep.Status.DONE, VisitStep.Status.SKIPPED),
            )
            new_step.prerequisite_steps.set([current_step])

            # A step named in insert_before_step_ids that was already
            # sequenced at or before the insertion point (e.g. it sits on a
            # different branch than current_step) didn't get touched by the
            # bump above. Left alone it would still render ahead of the new
            # step in the timeline even though it now has to wait for it, so
            # push its display order past new_step too.
            out_of_order_targets = sorted(
                (t for t in insert_before_steps if t.sequence_order <= new_step.sequence_order),
                key=lambda t: t.sequence_order,
            )
            next_order = new_step.sequence_order + 1
            for target in out_of_order_targets:
                VisitStep.objects.filter(visit=visit, sequence_order__gte=next_order).update(
                    sequence_order=F("sequence_order") + 1
                )
                target.sequence_order = next_order
                target.save(update_fields=["sequence_order"])
                next_order += 1

            for target in insert_before_steps:
                target.prerequisite_steps.add(new_step)

            log_action(
                request.user,
                "INSERT_VISIT_STEP",
                "VisitStep",
                new_step.id,
                {
                    "visit": visit.id,
                    "service_point": node.id,
                    "insert_before_step_ids": insert_before_step_ids,
                },
            )

        data = VisitStepSerializer(new_step).data
        data["target_queue_waiting_count"] = waiting_count_for_service_point(node)
        return Response(data, status=201)