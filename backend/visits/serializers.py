import secrets

from django.db import transaction
from rest_framework import serializers

from pathway.models import TemplateStep

from .models import Patient, Visit, VisitStep


class PatientSerializer(serializers.ModelSerializer):
    hn_code = serializers.CharField(help_text="Hospital Number — the patient's unique identifier across visits.")
    dob = serializers.DateField(help_text="Date of birth.")
    national_id = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Thai national ID (13 digits). Optional — some patients may not have one on file.",
    )
    phone = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Contact phone. Optional.",
    )
    preferred_language = serializers.ChoiceField(
        choices=Patient.Language.choices,
        help_text="TH | EN. Drives Patient Portal UI language and message tone.",
    )

    class Meta:
        model = Patient
        fields = ["id", "hn_code", "full_name", "dob", "national_id", "phone", "preferred_language"]


class VisitStepSerializer(serializers.ModelSerializer):
    sequence_order = serializers.IntegerField(help_text="0-based ordinal within the parent visit.")
    status = serializers.ChoiceField(
        choices=VisitStep.Status.choices,
        help_text="PENDING → IN_PROGRESS → DONE. `SKIPPED` is also possible. Transitions are driven by the start/complete/skip actions.",
    )
    is_planned = serializers.BooleanField(
        help_text="True if this step came from the snapshot of the visit's pathway template; false for ad-hoc steps added later.",
    )
    is_next = serializers.BooleanField(
        help_text=(
            "True once staff has explicitly designated this PENDING step as "
            "where the patient goes next (via complete/skip's next_step_ids, "
            "or auto-set at registration for the pathway's root step(s)). "
            "Read-only — set only via the start/complete/skip/insert-next actions, "
            "never directly writable."
        ),
    )

    class Meta:
        model = VisitStep
        fields = [
            "id",
            "visit",
            "service_point",
            "sequence_order",
            "prerequisite_steps",
            "status",
            "is_planned",
            "is_next",
            "started_at",
            "completed_at",
        ]
        # Fully read-only here — created only via Visit's snapshot-on-create,
        # mutated only via VisitStepViewSet's start/complete/skip actions.
        read_only_fields = fields


class VisitSerializer(serializers.ModelSerializer):
    visit_date = serializers.DateField(help_text="Date of the visit (one visit per day).")
    status = serializers.ChoiceField(
        choices=Visit.Status.choices,
        help_text="REGISTERED → IN_PROGRESS → DONE. Set by the server — callers can't write it directly.",
    )
    qr_token = serializers.CharField(
        read_only=True,
        help_text="64-char URL-safe random token, set on creation. Patients/Kiosk look up their visit by this via `GET /api/visits/by-token/{qr_token}`. Never expose `Visit.id` to patients — it's sequential and guessable.",
    )
    current_node = serializers.PrimaryKeyRelatedField(
        read_only=True,
        help_text="Last node scanned by the patient (via location QR). Updated only by a kiosk scan.",
    )
    uses_wheelchair = serializers.BooleanField(
        required=False,
        help_text="If true, the route planner excludes edges where `wheelchair_accessible=false`.",
    )

    class Meta:
        model = Visit
        fields = [
            "id",
            "patient",
            "pathway_template",
            "visit_date",
            "created_at",
            "status",
            "qr_token",
            "current_node",
            "uses_wheelchair",
        ]
        # status/qr_token are set by create() below, not the caller;
        # current_node is only ever updated by a kiosk scan (later phase).
        read_only_fields = ["created_at", "status", "qr_token", "current_node"]

    @transaction.atomic
    def create(self, validated_data):
        visit = Visit.objects.create(
            status=Visit.Status.REGISTERED,
            qr_token=secrets.token_urlsafe(48),
            **validated_data,
        )

        template_steps = list(
            TemplateStep.objects.filter(pathway_template=visit.pathway_template)
            .order_by("sequence_order")
            .prefetch_related("prerequisite_steps")
        )

        # Snapshot TemplateStep -> VisitStep. prerequisite_steps must be
        # remapped from TemplateStep ids to the freshly created VisitStep ids
        # (MODELS.md § 3: the copy is independent of the template afterwards).
        step_by_template_id = {
            template_step.id: VisitStep.objects.create(
                visit=visit,
                service_point=template_step.service_point,
                sequence_order=template_step.sequence_order,
            )
            for template_step in template_steps
        }
        root_step_ids = []
        for template_step in template_steps:
            prereq_ids = [p.id for p in template_step.prerequisite_steps.all()]
            if not prereq_ids:
                root_step_ids.append(step_by_template_id[template_step.id].id)
                continue
            step_by_template_id[template_step.id].prerequisite_steps.set(
                [step_by_template_id[pid] for pid in prereq_ids if pid in step_by_template_id]
            )

        # Auto-designate the pathway's root step(s) — those with zero
        # prerequisite_steps — as staff-designated "next" so registration ->
        # immediate first check-in keeps working without an extra explicit
        # designate call. There can be more than one when a template's
        # first steps fan out in parallel. See GAP.md FR-19/FR-21.
        if root_step_ids:
            VisitStep.objects.filter(id__in=root_step_ids).update(is_next=True)

        return visit