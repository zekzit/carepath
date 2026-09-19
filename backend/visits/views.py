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
        # Phase 7 (Kiosk compass guidance): expose the node's floor-plan
        # coordinates so the frontend can compute straight-line bearing
        # + distance from the kiosk node to this service point. The kiosk's
        # own position comes from GET /api/facility/kiosks/{device_code}.
        "pos_x": serializers.FloatField(),
        "pos_y": serializers.FloatField(),
        "floor_id": serializers.IntegerField(),
        "floor_scale_m_per_px": serializers.FloatField(allow_null=True),
        "floor_name_th": serializers.CharField(),
        "floor_name_en": serializers.CharField(),
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
# An eligible next step with its (optional) per-step queue ticket inlined.
# Multiple of these can coexist when VisitSteps share a sequence_order
# (fan-out): the patient picks one to go to first, the rest stay PENDING
# until this one is DONE/SKIPPED. The full ordered step list still lives
# under `steps`, and the timeline group rule (all DONE/SKIPPED in the
# group before the next group unlocks) is unchanged.
_next_step_option_payload = inline_serializer(
    name="PublicVisitNextStepOption",
    fields={
        "id": serializers.IntegerField(),
        "sequence_order": serializers.IntegerField(),
        "status": serializers.CharField(),
        "service_point": _service_point_payload,
        "queue_ticket": _queue_ticket_payload,
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
        "next_steps": serializers.ListField(child=_next_step_option_payload),
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
        visit.steps.select_related("service_point__floor")
        .prefetch_related("prerequisite_steps", "queue_ticket__queue")
        .order_by("sequence_order")
    )

    def step_payload(step: VisitStep) -> dict:
        sp = step.service_point
        floor = sp.floor
        return {
            "id": step.id,
            "sequence_order": step.sequence_order,
            "status": step.status,
            "prerequisite_steps": [p.id for p in step.prerequisite_steps.all()],
            "started_at": step.started_at,
            "completed_at": step.completed_at,
            "service_point": {
                "id": sp.id,
                "name_th": sp.name_th,
                "name_en": sp.name_en,
                "department_th": sp.department_th,
                "department_en": sp.department_en,
                "pos_x": sp.pos_x,
                "pos_y": sp.pos_y,
                "floor_id": floor.id,
                "floor_scale_m_per_px": floor.plan_scale_m_per_px,
                "floor_name_th": floor.name_th,
                "floor_name_en": floor.name_en,
            },
        }

    # Same eligibility rule as the Admin Portal's start action (MODELS.md § 3:
    # every prerequisite must be DONE — a SKIPPED one does not count), just
    # computed in bulk here from an already-fetched list instead of a
    # per-step DB query, since we're composing the whole visit at once.
    #
    # Returned as a list (next_steps) instead of a single step so the
    # Patient/Kiosk portals can show the full fan-out: steps that share a
    # `sequence_order` are parallel — the patient picks one to start, the
    # rest stay PENDING. If no step is IN_PROGRESS yet, every parallel
    # option comes back as PENDING with its own (possibly null) queue
    # ticket, so the portal can render each as an independent card.
    done_ids = {s.id for s in steps if s.status == VisitStep.Status.DONE}
    in_progress = [s for s in steps if s.status == VisitStep.Status.IN_PROGRESS]
    if in_progress:
        eligible = in_progress
    else:
        eligible = [
            s
            for s in steps
            if s.status == VisitStep.Status.PENDING
            and {p.id for p in s.prerequisite_steps.all()}.issubset(done_ids)
        ]

    def next_step_payload(step: VisitStep) -> dict:
        ticket = getattr(step, "queue_ticket", None)
        ticket_payload = None
        if ticket is not None:
            ticket_payload = {
                "ticket_number": ticket.ticket_number,
                "status": ticket.status,
                "current_number": ticket.queue.current_number,
            }
        return {
            "id": step.id,
            "sequence_order": step.sequence_order,
            "status": step.status,
            "service_point": step_payload(step)["service_point"],
            "queue_ticket": ticket_payload,
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
        "next_steps": [next_step_payload(s) for s in eligible],
    }


@extend_schema(
    summary="Resolve a visit by its public qr_token",
    description=(
        "Public, permanent `AllowAny` — the `qr_token` itself (64 random "
        "chars set on `Visit` creation) is the credential, per MODELS.md's "
        "design (no separate auth for patients). Returns the same read-only "
        "visit shape used by the Patient Portal and (Phase 4) the Kiosk "
        "Portal. Never look this up by `Visit.id`, which is sequential and "
        "guessable."
    ),
    responses={200: public_visit_response, 404: _not_found_response},
)
@api_view(["GET"])
@permission_classes([AllowAny])
def visit_by_token(request, qr_token):
    """Public, permanent AllowAny — the qr_token itself (64 random chars) is
    the credential, per MODELS.md's design (no separate auth for patients).
    Never look this up by Visit.id, which is sequential and guessable.
    """
    visit = get_object_or_404(Visit.objects.select_related("patient"), qr_token=qr_token)
    return Response(serialize_public_visit(visit))


@extend_schema(
    summary="Resolve today's visit for a patient by HN code",
    description=(
        "Kiosk manual-fallback lookup (Phase 4) — nobody can type a 64-char "
        "`qr_token` by hand, so the \"or enter your HN\" path looks up "
        "*today's* `Visit` for that HN instead and returns the same shape "
        "as `visit_by_token`. Scoped to today only (not full history) to "
        "limit what a bare HN code (unlike `qr_token`, not a random secret) "
        "can expose through a public endpoint. If a patient somehow has "
        "more than one visit today, the most recently created one wins."
    ),
    responses={200: public_visit_response, 404: _not_found_response},
)
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
