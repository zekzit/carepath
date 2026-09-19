import secrets

from django.db import transaction
from rest_framework import serializers

from pathway.models import TemplateStep

from .models import Patient, Visit, VisitStep


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ["id", "hn_code", "full_name", "dob", "national_id", "phone", "preferred_language"]


class VisitStepSerializer(serializers.ModelSerializer):
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
            "started_at",
            "completed_at",
        ]
        # Fully read-only here — created only via Visit's snapshot-on-create,
        # mutated only via VisitStepViewSet's start/complete/skip actions.
        read_only_fields = fields


class VisitSerializer(serializers.ModelSerializer):
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
        for template_step in template_steps:
            prereq_ids = [p.id for p in template_step.prerequisite_steps.all()]
            if not prereq_ids:
                continue
            step_by_template_id[template_step.id].prerequisite_steps.set(
                [step_by_template_id[pid] for pid in prereq_ids if pid in step_by_template_id]
            )

        return visit
