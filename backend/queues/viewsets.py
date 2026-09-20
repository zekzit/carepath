from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from accounts.models import StaffUser
from accounts.permissions import RoleRequired

from .models import Queue, QueueTicket, ServiceSchedule
from .serializers import QueueSerializer, QueueTicketSerializer, ServiceScheduleSerializer

# Mirrors visits/viewsets.py's `_eligible_next_step_option_schema` /
# `_designation_required_response_schema` — duplicated (rather than imported
# across apps) to keep queues/visits decoupled at the viewset layer; the
# actual eligibility logic itself lives once in `visits.services`
# (`eligible_next_steps`/`eligible_next_steps_payload`) and is shared.
_eligible_next_step_option_schema = inline_serializer(
    name="QueueTicketEligibleNextStepOption",
    fields={
        "id": serializers.IntegerField(),
        "service_point": inline_serializer(
            name="QueueTicketEligibleNextStepServicePoint",
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
    name="QueueTicketDesignationRequiredResponse",
    fields={
        "detail": serializers.CharField(),
        "eligible_next_steps": serializers.ListField(child=_eligible_next_step_option_schema),
    },
)
_done_request_schema = inline_serializer(
    name="DoneQueueTicketRequest",
    fields={
        "next_step_ids": serializers.ListField(
            child=serializers.IntegerField(),
            required=False,
            help_text=(
                "Ids of the eligible-next VisitSteps (from a prior 409's "
                "eligible_next_steps) that staff designates as where the "
                "patient goes next. Omit to get the 409 preview when "
                "completing this step would unlock one or more follow-up "
                "steps — same contract as VisitStepViewSet.complete."
            ),
        ),
    },
)


@extend_schema_view(
    list=extend_schema(
        summary="List service schedules",
        description=(
            "Master-data opening-hours config (Phase 1). One row per "
            "(service_point, day_of_week) with `open_time`/`close_time`."
        ),
    ),
    retrieve=extend_schema(summary="Retrieve a service schedule"),
    create=extend_schema(summary="Create a service schedule"),
    update=extend_schema(summary="Replace a service schedule"),
    partial_update=extend_schema(summary="Partially update a service schedule"),
    destroy=extend_schema(summary="Delete a service schedule"),
)
class ServiceScheduleViewSet(ModelViewSet):
    """Master-data schedule config (Phase 1)."""

    queryset = ServiceSchedule.objects.select_related("service_point").order_by("service_point_id", "day_of_week")
    serializer_class = ServiceScheduleSerializer
    permission_classes = [RoleRequired]
    read_roles = ()
    write_roles = ()


@extend_schema_view(
    list=extend_schema(
        summary="List queues",
        description=(
            "Default scope is *today's* queues unless `queue_date` (YYYY-MM-DD) "
            "is given. Optional `service_point` (id) narrows by service point."
        ),
    ),
    retrieve=extend_schema(summary="Retrieve a queue"),
    call_next=extend_schema(
        summary="Call the next waiting ticket in this queue",
        description=(
            "Picks the lowest `ticket_number` with status `WAITING`, moves it "
            "to `CALLED`, records `called_at`, and bumps `Queue.current_number`. "
            "Returns 400 if nobody is waiting."
        ),
    ),
)
class QueueViewSet(viewsets.ReadOnlyModelViewSet):
    """Queue rows are created lazily by queues.services.ensure_ticket_for_step
    (the first VisitStep started at a service point on a given day) — there's
    no direct create endpoint. Defaults to today's queues unless `queue_date`
    is given, since that's what the Queue Console cares about."""

    queryset = Queue.objects.select_related("service_point").order_by("-queue_date")
    serializer_class = QueueSerializer
    permission_classes = [RoleRequired]
    read_roles = (StaffUser.Role.SERVICE_STAFF, StaffUser.Role.EXECUTIVE)
    write_roles = (StaffUser.Role.SERVICE_STAFF,)

    def get_queryset(self):
        qs = super().get_queryset()
        service_point = self.request.query_params.get("service_point")
        if service_point:
            qs = qs.filter(service_point_id=service_point)
        queue_date = self.request.query_params.get("queue_date")
        qs = qs.filter(queue_date=queue_date) if queue_date else qs.filter(queue_date=timezone.localdate())
        return qs

    @extend_schema(
        summary="Call the next waiting ticket in this queue",
        description=(
            "Picks the lowest `ticket_number` with status `WAITING`, moves it "
            "to `CALLED`, records `called_at`, and bumps `Queue.current_number`. "
            "Returns 400 if nobody is waiting."
        ),
        request=None,
        responses={200: QueueSerializer, 400: {"description": "No waiting tickets in this queue."}},
    )
    @action(detail=True, methods=["post"], url_path="call-next")
    def call_next(self, request, pk=None):
        queue = self.get_object()
        next_ticket = queue.tickets.filter(status=QueueTicket.Status.WAITING).order_by("ticket_number").first()
        if not next_ticket:
            return Response({"detail": "No waiting tickets in this queue."}, status=400)

        next_ticket.status = QueueTicket.Status.CALLED
        next_ticket.called_at = timezone.now()
        next_ticket.save(update_fields=["status", "called_at"])

        queue.current_number = next_ticket.ticket_number
        queue.save(update_fields=["current_number"])

        return Response(QueueSerializer(queue).data)


@extend_schema_view(
    list=extend_schema(
        summary="List queue tickets",
        description="Optional `queue` (id) filter narrows to one queue. Newest first.",
    ),
    retrieve=extend_schema(summary="Retrieve a queue ticket"),
    serve=extend_schema(
        summary="Mark the ticket as SERVING",
        description="Allowed only from `CALLED`. 400 if the ticket is in any other status.",
    ),
    done=extend_schema(
        summary="Mark the ticket as DONE",
        description=(
            "Allowed from `CALLED` or `SERVING`. Completes the underlying "
            "`VisitStep` (delegates to `visits.services.complete_step`). "
            "Same `next_step_ids` / 409-preview next-step designation "
            "contract as `VisitStepViewSet.complete`. 400 if the ticket is "
            "in any other status."
        ),
    ),
)
class QueueTicketViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = QueueTicket.objects.select_related("queue", "visit_step__visit__patient")
    serializer_class = QueueTicketSerializer
    permission_classes = [RoleRequired]
    # REGISTRAR and EXECUTIVE both land on the Admin Portal Dashboard (see
    # admin-nav.ts), which unconditionally reads ticket status to compute
    # the "waiting" stat card for every role — QueueTicketSerializer never
    # exposes patient identity (see queues/serializers.py: id/queue/
    # visit_step/ticket_number/status/called_at only), so this is a safe,
    # read-only widening. Same RBAC/reporting-interaction bug class as
    # VisitStepViewSet's (see GAP.md), found while verifying the Executive
    # Dashboard end-to-end. write_roles (serve/done) stays SERVICE_STAFF-only.
    read_roles = (StaffUser.Role.SERVICE_STAFF, StaffUser.Role.REGISTRAR, StaffUser.Role.EXECUTIVE)
    write_roles = (StaffUser.Role.SERVICE_STAFF,)

    def get_queryset(self):
        qs = super().get_queryset()
        queue_id = self.request.query_params.get("queue")
        if queue_id:
            qs = qs.filter(queue_id=queue_id)
        return qs

    @extend_schema(
        summary="Mark the ticket as SERVING",
        description="Allowed only from `CALLED`. 400 if the ticket is in any other status.",
        request=None,
        responses={200: QueueTicketSerializer, 400: {"description": "Ticket is not in a `CALLED` state."}},
    )
    @action(detail=True, methods=["post"])
    def serve(self, request, pk=None):
        ticket = self.get_object()
        if ticket.status != QueueTicket.Status.CALLED:
            return Response({"detail": f"Ticket is {ticket.status}, not CALLED."}, status=400)
        ticket.status = QueueTicket.Status.SERVING
        ticket.save(update_fields=["status"])
        return Response(QueueTicketSerializer(ticket).data)

    @extend_schema(
        summary="Mark the ticket as DONE",
        description=(
            "Allowed from `CALLED` or `SERVING`. Completes the underlying "
            "`VisitStep` (delegates to `visits.services.complete_step`). If "
            "completing that step would unlock one or more follow-up "
            "PENDING steps and the request did not include `next_step_ids`, "
            "returns 409 with the eligible options instead of completing "
            "anything — same `next_step_ids` / 409-preview designation "
            "contract as `VisitStepViewSet.complete` (GAP.md FR-19/FR-21), "
            "so finishing a step from the Queue Console designates the "
            "patient's next destination just like finishing it from the "
            "Visit Detail page does. 400 if the ticket is in any other "
            "status, or if next_step_ids contains an invalid/ineligible id."
        ),
        request=_done_request_schema,
        responses={
            200: QueueTicketSerializer,
            400: {
                "description": "Ticket cannot be marked done in its current state, "
                "or next_step_ids contains an invalid/ineligible id.",
            },
            409: _designation_required_response_schema,
        },
    )
    @action(detail=True, methods=["post"])
    def done(self, request, pk=None):
        # visits already depends on queues; keep the reverse edge local.
        from visits import services as visit_services
        from visits.models import VisitStep

        ticket = self.get_object()
        if ticket.status not in (QueueTicket.Status.CALLED, QueueTicket.Status.SERVING):
            return Response({"detail": f"Ticket is {ticket.status}, cannot be marked done."}, status=400)

        step = ticket.visit_step
        eligible_next = visit_services.eligible_next_steps(step.visit, step)
        next_step_ids = request.data.get("next_step_ids")

        if eligible_next and next_step_ids is None:
            return Response(visit_services.eligible_next_steps_payload(eligible_next), status=409)

        if next_step_ids is not None:
            eligible_ids = {s.id for s in eligible_next}
            invalid = [nid for nid in next_step_ids if nid not in eligible_ids]
            if invalid:
                return Response(
                    {"detail": f"next_step_ids contains ids that are not eligible next steps for this visit: {invalid}"},
                    status=400,
                )

        visit_services.complete_step(step)

        if next_step_ids:
            VisitStep.objects.filter(id__in=next_step_ids).update(is_next=True)

        ticket.refresh_from_db()
        return Response(QueueTicketSerializer(ticket).data)