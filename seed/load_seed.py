"""Load mock data from `seed/*.csv` into the Django database.

Run from the repo root with the backend venv activated:

    cd backend
    source venv/bin/activate
    python ../seed/load_seed.py

Idempotent for the most part: re-running won't duplicate buildings / floors /
nodes / edges / care categories / pathway templates / template steps /
patients / visits (matched on natural key like code / hn_code / qr_token),
but M2M rows and visit steps for re-created visits will be replaced.

Prereqs:
    python manage.py migrate          # must have run first
    python ../seed/generate_floor_plans.py   # writes the PNGs this loads

This is dev-only seed data — DO NOT run against production.
"""

from __future__ import annotations

import csv
import os
import sys
from pathlib import Path

import django
from django.utils import timezone

SEED_DIR = Path(__file__).resolve().parent
REPO_ROOT = SEED_DIR.parent
BACKEND_ROOT = REPO_ROOT / "backend"

sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.core.files import File  # noqa: E402
from django.db import transaction  # noqa: E402

from accounts.models import StaffUser  # noqa: E402  (skipping accounts/queues seed)
from facility.models import Building, Edge, Floor, Node  # noqa: E402
from pathway.models import (  # noqa: E402
    CareCategory,
    PathwayTemplate,
    TemplateStep,
)
from visits.models import Patient, Visit, VisitStep  # noqa: E402


def _read_csv(name: str) -> list[dict]:
    with (SEED_DIR / name).open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _bool(s: str) -> bool:
    return s.strip().lower() in ("1", "true", "yes", "y")


def _maybe(value: str) -> str:
    return value.strip() or None


def _aware(value: str):
    """Parse a naive datetime/date from CSV into a timezone-aware datetime."""
    if not value:
        return None
    from datetime import datetime
    dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
    return timezone.make_aware(dt, timezone.UTC)


@transaction.atomic
def load_facility() -> tuple[dict[str, Floor], dict[str, Node]]:
    print("[1/5] buildings + floors + nodes + edges ...")
    buildings_by_id: dict[str, Building] = {}
    for row in _read_csv("buildings.csv"):
        obj, _ = Building.objects.update_or_create(
            code=row["code"],
            defaults={"name_th": row["name_th"], "name_en": row["name_en"]},
        )
        buildings_by_id[row["id"]] = obj

    floors = {}
    for row in _read_csv("floors.csv"):
        b = buildings_by_id[row["building_id"]]
        plan_path = SEED_DIR / "floor_plans" / row["plan_image_filename"]
        obj, _ = Floor.objects.update_or_create(
            building=b,
            level_no=int(row["level_no"]),
            defaults={
                "name_th": row["name_th"],
                "name_en": row["name_en"],
                "plan_scale_m_per_px": float(row["plan_scale_m_per_px"]),
            },
        )
        if plan_path.exists():
            with plan_path.open("rb") as fh:
                obj.plan_image.save(row["plan_image_filename"], File(fh), save=True)
        floors[row["id"]] = obj

    nodes = {}
    for row in _read_csv("nodes.csv"):
        f = floors[row["floor_id"]]
        node_type = row["node_type"]
        defaults = {
            "floor": f,
            "node_type": node_type,
            "name_th": row["name_th"],
            "name_en": row["name_en"],
            "pos_x": float(row["pos_x"]),
            "pos_y": float(row["pos_y"]),
            "vertical_group": row["vertical_group"].strip(),
            "location_qr_code": _maybe(row["location_qr_code"]),
            "is_active": _bool(row["is_active"]),
        }
        if node_type == Node.NodeType.SERVICE_POINT:
            defaults.update({
                "service_point_code": _maybe(row["service_point_code"]),
                "department_th": row["department_th"].strip(),
                "department_en": row["department_en"].strip(),
            })
        elif node_type == Node.NodeType.KIOSK:
            defaults["device_code"] = _maybe(row["device_code"])
        obj, _ = Node.objects.update_or_create(
            id=int(row["id"]),
            defaults=defaults,
        )
        nodes[row["id"]] = obj

    # Edges: delete + recreate so renumbering/redirecting doesn't drift.
    Edge.objects.all().delete()
    for row in _read_csv("edges.csv"):
        Edge.objects.create(
            from_node=nodes[row["from_node_id"]],
            to_node=nodes[row["to_node_id"]],
            distance_m=float(row["distance_m"]),
            edge_type=row["edge_type"],
            walk_time_sec=int(row["walk_time_sec"]),
            is_bidirectional=_bool(row["is_bidirectional"]),
            wheelchair_accessible=_bool(row["wheelchair_accessible"]),
        )

    return floors, nodes


@transaction.atomic
def load_pathway() -> dict[str, PathwayTemplate]:
    print("[2/5] care categories + pathway templates + template steps ...")
    categories = {}
    for row in _read_csv("care_categories.csv"):
        obj, _ = CareCategory.objects.update_or_create(
            id=int(row["id"]),
            defaults={"name_th": row["name_th"], "name_en": row["name_en"]},
        )
        categories[row["id"]] = obj

    templates = {}
    for row in _read_csv("pathway_templates.csv"):
        obj, _ = PathwayTemplate.objects.update_or_create(
            id=int(row["id"]),
            defaults={
                "care_category": categories[row["care_category_id"]],
                "name_th": row["name_th"],
                "name_en": row["name_en"],
                "is_active": _bool(row["is_active"]),
            },
        )
        templates[row["id"]] = obj

    # Wipe and recreate template steps so renumbering stays consistent.
    TemplateStep.objects.all().delete()
    step_id_to_obj: dict[str, TemplateStep] = {}
    for row in _read_csv("template_steps.csv"):
        # Node lookup by service_point_code (stable across reseeds).
        sp_code = _node_code_for_template_step(row["service_point_node_id"])
        sp = Node.objects.get(service_point_code=sp_code)
        step = TemplateStep.objects.create(
            id=int(row["id"]),
            pathway_template=templates[row["pathway_template_id"]],
            service_point=sp,
            sequence_order=int(row["sequence_order"]),
        )
        step_id_to_obj[row["id"]] = step

    for row in _read_csv("template_step_prerequisites.csv"):
        step = step_id_to_obj[row["step_id"]]
        prereq = step_id_to_obj[row["prerequisite_step_id"]]
        step.prerequisite_steps.add(prereq)

    return templates


def _node_code_for_template_step(node_id: str) -> str:
    for row in _read_csv("nodes.csv"):
        if row["id"] == node_id:
            return row["service_point_code"]
    raise KeyError(node_id)


@transaction.atomic
def load_visits(nodes: dict[str, Node], templates: dict[str, PathwayTemplate]) -> None:
    print("[3/5] patients ...")
    patients = {}
    for row in _read_csv("patients.csv"):
        obj, _ = Patient.objects.update_or_create(
            hn_code=row["hn_code"],
            defaults={
                "full_name": row["full_name"],
                "dob": row["dob"],
                "national_id": row["national_id"].strip(),
                "phone": row["phone"].strip(),
                "preferred_language": row["preferred_language"],
            },
        )
        patients[row["hn_code"]] = obj

    print("[4/5] visits ...")
    visits = {}
    for row in _read_csv("visits.csv"):
        patient = patients[row["patient_hn_code"]]
        tmpl = templates[row["pathway_template_id"]]
        # delete any old visit for this patient/today so we can re-create cleanly
        Visit.objects.filter(patient=patient, visit_date=row["visit_date"]).delete()
        current = nodes[row["current_node_id"]] if row["current_node_id"] else None
        visit = Visit.objects.create(
            id=int(row["id"]),
            patient=patient,
            pathway_template=tmpl,
            visit_date=row["visit_date"],
            status=row["status"],
            qr_token=row["qr_token"],
            current_node=current,
            uses_wheelchair=_bool(row["uses_wheelchair"]),
            created_at=_aware(row["created_at"]),
        )
        visits[row["id"]] = visit

    print("[5/5] visit steps + prerequisites ...")
    step_id_to_obj: dict[str, VisitStep] = {}
    for row in _read_csv("visit_steps.csv"):
        sp_code = _node_code_for_template_step(row["service_point_node_id"])
        sp = Node.objects.get(service_point_code=sp_code)
        step = VisitStep.objects.create(
            id=int(row["id"]),
            visit=visits[row["visit_id"]],
            service_point=sp,
            sequence_order=int(row["sequence_order"]),
            status=row["status"],
            is_planned=_bool(row["is_planned"]),
            started_at=_aware(row["started_at"]),
            completed_at=_aware(row["completed_at"]),
        )
        step_id_to_obj[row["id"]] = step

    for row in _read_csv("visit_step_prerequisites.csv"):
        step = step_id_to_obj[row["visit_step_id"]]
        prereq = step_id_to_obj[row["prerequisite_visit_step_id"]]
        step.prerequisite_steps.add(prereq)


def _reset_db() -> None:
    """Wipe everything this seed owns, in FK-respecting order."""
    VisitStep.objects.all().delete()
    Visit.objects.all().delete()
    TemplateStep.objects.all().delete()
    PathwayTemplate.objects.all().delete()
    CareCategory.objects.all().delete()
    Patient.objects.all().delete()
    Edge.objects.all().delete()
    Node.objects.all().delete()
    Floor.objects.all().delete()
    Building.objects.all().delete()


def main() -> None:
    _reset_db()
    floors, nodes = load_facility()
    templates = load_pathway()
    load_visits(nodes, templates)
    print("done.")
    print(f"  buildings={Building.objects.count()} "
          f"floors={Floor.objects.count()} "
          f"nodes={Node.objects.count()} "
          f"edges={Edge.objects.count()} "
          f"templates={PathwayTemplate.objects.count()} "
          f"patients={Patient.objects.count()} "
          f"visits={Visit.objects.count()} "
          f"visit_steps={VisitStep.objects.count()}")
    print()
    print("QR tokens for the 4 demo visits (paste into the kiosk scanner):")
    print("  Visit 1 (TH, no-wheelchair)  demo-qr-vj-thai-patient01-visit01-20260919-0000000000")
    print("  Visit 2 (EN, no-wheelchair)  demo-qr-vj-en-patient02-visit01-20260919-000000000000")
    print("  Visit 3 (EN, wheelchair)     demo-qr-vj-en-patient03-visit01-20260919-000000000000")
    print("  Visit 4 (TH, wheelchair)     demo-qr-vj-thai-patient04-visit01-20260919-000000000000")
    print()
    print("Patient portal URLs (open in browser):")
    print("  http://localhost:3000/visit/demo-qr-vj-thai-patient01-visit01-20260919-0000000000")
    print("  http://localhost:3000/visit/demo-qr-vj-en-patient02-visit01-20260919-000000000000")
    print("  http://localhost:3000/visit/demo-qr-vj-en-patient03-visit01-20260919-000000000000")
    print("  http://localhost:3000/visit/demo-qr-vj-thai-patient04-visit01-20260919-000000000000")
    print()
    print("Kiosk URLs:")
    print("  http://localhost:3000/kiosk/KIOSK-OPD1-01")
    print("  http://localhost:3000/kiosk/KIOSK-ER-01")
    print()
    print("See SCENARIO.md for the full demo script.")


if __name__ == "__main__":
    main()
