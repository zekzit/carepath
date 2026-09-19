from django.db import models

from facility.models import Node, validate_is_service_point
from pathway.models import PathwayTemplate


class Patient(models.Model):
    class Language(models.TextChoices):
        TH = "th", "ไทย"
        EN = "en", "English"

    hn_code = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=200)
    dob = models.DateField()
    national_id = models.CharField(max_length=13, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    preferred_language = models.CharField(
        max_length=2, choices=Language.choices, default=Language.TH
    )

    def __str__(self):
        return f"{self.hn_code} {self.full_name}"


class Visit(models.Model):
    class Status(models.TextChoices):
        REGISTERED = "REGISTERED"
        IN_PROGRESS = "IN_PROGRESS"
        COMPLETED = "COMPLETED"
        CANCELLED = "CANCELLED"

    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="visits")
    pathway_template = models.ForeignKey(
        PathwayTemplate, on_delete=models.PROTECT, related_name="visits"
    )
    visit_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=Status.choices)
    qr_token = models.CharField(max_length=64, unique=True)
    current_node = models.ForeignKey(
        Node, null=True, blank=True, on_delete=models.SET_NULL, related_name="visits_here"
    )
    uses_wheelchair = models.BooleanField(default=False)

    def __str__(self):
        return f"Visit {self.pk} - {self.patient}"


class VisitStep(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING"
        IN_PROGRESS = "IN_PROGRESS"
        DONE = "DONE"
        SKIPPED = "SKIPPED"

    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name="steps")
    service_point = models.ForeignKey(
        Node,
        on_delete=models.PROTECT,
        related_name="visit_steps",
        limit_choices_to={"node_type": Node.NodeType.SERVICE_POINT},
    )
    sequence_order = models.PositiveIntegerField()
    prerequisite_steps = models.ManyToManyField(
        "self", symmetrical=False, related_name="dependent_steps", blank=True
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    is_planned = models.BooleanField(default=True)
    # Staff-designated eligibility: True only once a staff member has
    # explicitly chosen this step as where the patient goes next (via
    # VisitStepViewSet.complete/skip's next_step_ids, or auto-set at
    # registration for root steps) — NOT a mirror of "prerequisites happen
    # to be satisfied". See GAP.md FR-19/FR-21.
    is_next = models.BooleanField(default=False)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["sequence_order"]

    def clean(self):
        super().clean()
        validate_is_service_point(self.service_point)

    def __str__(self):
        return f"{self.visit} #{self.sequence_order} {self.service_point}"
