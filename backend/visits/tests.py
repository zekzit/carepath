from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import StaffUser
from facility.models import Building, Floor, Node
from pathway.models import CareCategory, PathwayTemplate

from .models import Patient, Visit, VisitStep
from .viewsets import VisitStepViewSet


class InsertUnplannedStepOrderingTests(TestCase):
    """Regression test for the "Add Unplanned map" bug: inserting an
    ad-hoc step (e.g. a dental clinic visit) with `insert_before_step_ids`
    pointing at a step that was already sequenced earlier than the
    insertion point (e.g. the finance/cashier step on another branch) must
    push that target's display `sequence_order` after the new step too —
    otherwise it keeps rendering before a step it now has to wait for."""

    def setUp(self):
        self.staff = StaffUser.objects.create_user(
            username="admin", password="x", role=StaffUser.Role.ADMIN
        )
        building = Building.objects.create(name_th="อาคาร A", name_en="Building A", code="A")
        floor = Floor.objects.create(building=building, level_no=1, name_th="ชั้น 1", name_en="Floor 1")

        def make_service_point(code, name):
            return Node.objects.create(
                floor=floor,
                node_type=Node.NodeType.SERVICE_POINT,
                name_th=name,
                name_en=name,
                pos_x=0,
                pos_y=0,
                service_point_code=code,
            )

        self.consult = make_service_point("SP-CONSULT", "Consult Room")
        self.finance = make_service_point("SP-FIN", "ห้องการเงิน")
        self.dental = make_service_point("SP-DENTAL", "คลินิกทันตกรรม")

        category = CareCategory.objects.create(name_th="ทั่วไป", name_en="General")
        template = PathwayTemplate.objects.create(care_category=category, name_th="เส้นทางทั่วไป", name_en="General Path")

        patient = Patient.objects.create(hn_code="HN1", full_name="Test Patient", dob="2000-01-01")
        self.visit = Visit.objects.create(
            patient=patient,
            pathway_template=template,
            visit_date="2026-09-20",
            status=Visit.Status.IN_PROGRESS,
            qr_token="tok-1",
        )

        # Existing plan: finance (#0) is already sequenced *before* the
        # consult step (#1) where staff currently stands — e.g. a fan-out
        # pathway where finance was scheduled early but is still PENDING.
        self.finance_step = VisitStep.objects.create(
            visit=self.visit, service_point=self.finance, sequence_order=0
        )
        self.consult_step = VisitStep.objects.create(
            visit=self.visit, service_point=self.consult, sequence_order=1, status=VisitStep.Status.IN_PROGRESS
        )

    def test_out_of_order_insert_before_target_is_pushed_after_new_step(self):
        factory = APIRequestFactory()
        request = factory.post(
            f"/api/visits/visit-steps/{self.consult_step.id}/insert-next/",
            {"service_point": self.dental.id, "insert_before_step_ids": [self.finance_step.id]},
            format="json",
        )
        force_authenticate(request, user=self.staff)
        view = VisitStepViewSet.as_view({"post": "insert_next"})
        response = view(request, pk=self.consult_step.id)

        self.assertEqual(response.status_code, 201, response.data)

        self.finance_step.refresh_from_db()
        dental_step = VisitStep.objects.get(service_point=self.dental)

        self.assertIn(dental_step, self.finance_step.prerequisite_steps.all())
        self.assertGreater(
            self.finance_step.sequence_order,
            dental_step.sequence_order,
            "finance step must display after the newly inserted dental step",
        )
