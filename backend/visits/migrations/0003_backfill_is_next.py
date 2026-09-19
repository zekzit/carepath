from django.db import migrations


def backfill_is_next(apps, schema_editor):
    """One-time grandfather-in for demo/seeded data created before `is_next`
    existed: every existing PENDING VisitStep whose prerequisites are all
    already satisfied becomes staff-designated so already-registered visits
    don't get stuck after this migration runs. Mirrors the exact eligibility
    rule used by visits/views.py::serialize_public_visit and the (pre-change)
    VisitStepViewSet.start — a SKIPPED prerequisite does NOT count as DONE.
    """
    VisitStep = apps.get_model("visits", "VisitStep")

    pending_steps = VisitStep.objects.filter(status="PENDING").prefetch_related("prerequisite_steps")
    to_designate_ids = []
    for step in pending_steps:
        prereqs = list(step.prerequisite_steps.all())
        if not prereqs or all(p.status == "DONE" for p in prereqs):
            to_designate_ids.append(step.id)

    if to_designate_ids:
        VisitStep.objects.filter(id__in=to_designate_ids).update(is_next=True)


def noop_reverse(apps, schema_editor):
    # Not reversible in a meaningful way — leaving is_next as-is on reverse
    # is safe (the field itself is dropped by the previous migration anyway).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0002_visitstep_is_next"),
    ]

    operations = [
        migrations.RunPython(backfill_is_next, noop_reverse),
    ]
