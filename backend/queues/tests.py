from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import StaffUser
from facility.models import Building, Floor, Node
from pathway.models import CareCategory, PathwayTemplate
from visits.models import Patient, Visit, VisitStep

from .models import Queue, QueueTicket
from .viewsets import QueueTicketViewSet


class QueueTicketDoneDesignationTests(TestCase):
    """Regression test for the "เสร็จสิ้น" (Done) button on the Queue Console
    never sending the patient to their next service point. `done` used to
    call `visits.services.complete_step` directly, bypassing the
    `next_step_ids` / 409-preview designation mechanism that
    `VisitStepViewSet.complete` implements — so no follow-up VisitStep ever
    got `is_next=True`, and the patient's next step stayed PENDING forever
    (VisitStepViewSet.start requires is_next=True). `done` must now share
    the exact same contract."""

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
        self.lab = make_service_point("SP-LAB", "ห้องแล็บ")

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

        self.consult_step = VisitStep.objects.create(
            visit=self.visit, service_point=self.consult, sequence_order=0, status=VisitStep.Status.IN_PROGRESS
        )
        self.lab_step = VisitStep.objects.create(
            visit=self.visit, service_point=self.lab, sequence_order=1
        )
        self.lab_step.prerequisite_steps.set([self.consult_step])

        queue = Queue.objects.create(service_point=self.consult, queue_date="2026-09-20")
        self.ticket = QueueTicket.objects.create(
            queue=queue, visit_step=self.consult_step, ticket_number=1, status=QueueTicket.Status.SERVING
        )

    def _post_done(self, data=None):
        factory = APIRequestFactory()
        request = factory.post(f"/api/queues/queue-tickets/{self.ticket.id}/done/", data or {}, format="json")
        force_authenticate(request, user=self.staff)
        view = QueueTicketViewSet.as_view({"post": "done"})
        return view(request, pk=self.ticket.id)

    def test_done_without_next_step_ids_returns_409_and_completes_nothing(self):
        response = self._post_done()

        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual([opt["id"] for opt in response.data["eligible_next_steps"]], [self.lab_step.id])

        self.consult_step.refresh_from_db()
        self.lab_step.refresh_from_db()
        self.ticket.refresh_from_db()
        self.assertEqual(self.consult_step.status, VisitStep.Status.IN_PROGRESS)
        self.assertFalse(self.lab_step.is_next)
        self.assertEqual(self.ticket.status, QueueTicket.Status.SERVING)

    def test_done_with_next_step_ids_completes_and_designates_next_step(self):
        response = self._post_done({"next_step_ids": [self.lab_step.id]})

        self.assertEqual(response.status_code, 200, response.data)

        self.consult_step.refresh_from_db()
        self.lab_step.refresh_from_db()
        self.ticket.refresh_from_db()
        self.assertEqual(self.consult_step.status, VisitStep.Status.DONE)
        self.assertTrue(self.lab_step.is_next)
        self.assertEqual(self.ticket.status, QueueTicket.Status.DONE)
