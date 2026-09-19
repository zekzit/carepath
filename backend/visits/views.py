from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Visit, VisitStep


_service_point_payload = inline_serializer(
    name="PublicVisitServicePoint",
    fields={
        "id": serializers.IntegerField(),
        "name_th": serializers.CharField(),
        "name_en": serializers.CharField(),
        "department_th": serializers.CharField(),
        "department_en": serializers.CharField(),
    },
)
_visit_step_payload = inline_serializer(
    name="PublicVisitStep",
    fields={
        "id": serializers.IntegerField(),
        "sequence_order": serializers.IntegerField(),
        "status": serializers.CharField(),
        "prerequisite_steps": serializers.ListField(child=serializers.IntegerField()),
        "started_at": serializers.DateTimeField(allow_null=True),
        "completed_at": serializers.DateTimeField(allow_null=True),
        "service_point": _service_point_payload,
    },
)
_queue_ticket_payload = inline_serializer(
    name="PublicVisitQueueTicket",
    fields={
        "ticket_number": serializers.IntegerField(),
        "status": serializers.CharField(),
        "current_number": serializers.IntegerField(),
    },
)
_patient_payload = inline_serializer(
    name="PublicVisitPatient",
    fields={
        "full_name": serializers.CharField(),
        "hn_code": serializers.CharField(),
        "preferred_language": serializers.CharField(),
    },
)
public_visit_response = inline_serializer(
    name="PublicVisitResponse",
    fields={
        "qr_token": serializers.CharField(),
        "status": serializers.CharField(),
        "visit_date": serializers.DateField(),
        "uses_wheelchair": serializers.BooleanField(),
        "patient": _patient_payload,
        "steps": serializers.ListField(child=_visit_step_payload),
        "next_step": _visit_step_payload,
        "queue_ticket": _queue_ticket_payload,
    },
)
_not_found_response = inline_serializer(
    name="PublicVisitNotFound",
    fields={"detail": serializers.CharField()},
)


def serialize_public_visit(visit: Visit) -> dict:
    """Composes the read-only, public (no-auth) view of a Visit for the
    Patient Portal (this phase) and the Kiosk Portal (Phase 4, which scans a
    QR into the same `qr_token` and reuses this exact function) — see
    IMPLEMENT_PLAN.md Phase 3. Not a DRF Serializer because it's a computed
    composition across Visit/Patient/VisitStep/Node/QueueTicket/Queue, not a
    single model's fields.
    """
    steps = list(
        visit.steps.select_related("service_point").prefetch_related("prerequisite_steps").order_by("sequence_order")
    )

    def step_payload(step: VisitStep) -> dict:
        return {
            "id": step.id,
            "sequence_order": step.sequence_order,
            "status": step.status,
            "prerequisite_steps": [p.id for p in step.prerequisite_steps.all()],
            "started_at": step.started_at,
            "completed_at": step.completed_at,
            "service_point": {
                "id": step.service_point.id,
                "name_th": step.service_point.name_th,
                "name_en": step.service_point.name_en,
                "department_th": step.service_point.department_th,
                "department_en": step.service_point.department_en,
            },
        }

    # Same eligibility rule as the Admin Portal's start action (MODELS.md § 3:
    # every prerequisite must be DONE — a SKIPPED one does not count), just
    # computed in bulk here from an already-fetched list instead of a
    # per-step DB query, since we're composing the whole visit at once.
    done_ids = {s.id for s in steps if s.status == VisitStep.Status.DONE}
    next_step = next((s for s in steps if s.status == VisitStep.Status.IN_PROGRESS), None)
    if next_step is None:
        next_step = next(
            (
                s
                for s in steps
                if s.status == VisitStep.Status.PENDING
                and {p.id for p in s.prerequisite_steps.all()}.issubset(done_ids)
            ),
            None,
        )

    queue_ticket_payload = None
    if next_step is not None:
        ticket = getattr(next_step, "queue_ticket", None)
        if ticket is not None:
            queue_ticket_payload = {
                "ticket_number": ticket.ticket_number,
                "status": ticket.status,
                "current_number": ticket.queue.current_number,
            }

    return {
        "qr_token": visit.qr_token,
        "status": visit.status,
        "visit_date": visit.visit_date,
        "uses_wheelchair": visit.uses_wheelchair,
        "patient": {
            "full_name": visit.patient.full_name,
            "hn_code": visit.patient.hn_code,
            "preferred_language": visit.patient.preferred_language,
        },
        "steps": [step_payload(s) for s in steps],
        "next_step": step_payload(next_step) if next_step else None,
        "queue_ticket": queue_ticket_payload,
    }


@extend_schema(responses={200: public_visit_response, 404: _not_found_response})
@api_view(["GET"])
@permission_classes([AllowAny])
def visit_by_token(request, qr_token):
    """Public, permanent AllowAny — the qr_token itself (64 random chars) is
    the credential, per MODELS.md's design (no separate auth for patients).
    Never look this up by Visit.id, which is sequential and guessable.
    """
    visit = get_object_or_404(Visit.objects.select_related("patient"), qr_token=qr_token)
    return Response(serialize_public_visit(visit))


@extend_schema(responses={200: public_visit_response, 404: _not_found_response})
@api_view(["GET"])
@permission_classes([AllowAny])
def visit_by_hn_today(request, hn_code):
    """Kiosk manual-fallback lookup (Phase 4) — nobody can type a 64-char
    qr_token by hand, so the "or enter your HN" path looks up *today's*
    Visit for that HN instead and returns the same shape as visit_by_token.
    Scoped to today only (not full history) to limit what a bare HN code
    (unlike qr_token, not a random secret) can expose through a public
    endpoint. If a patient somehow has more than one visit today, the most
    recently created one wins.
    """
    visit = (
        Visit.objects.select_related("patient")
        .filter(patient__hn_code=hn_code, visit_date=timezone.localdate())
        .order_by("-created_at")
        .first()
    )
    if visit is None:
        return Response({"detail": "No visit found for this HN today."}, status=404)
    return Response(serialize_public_visit(visit))
