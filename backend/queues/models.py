from django.db import models

from facility.models import Node, validate_is_service_point
from visits.models import VisitStep


class Queue(models.Model):
    service_point = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name="queues",
        limit_choices_to={"node_type": Node.NodeType.SERVICE_POINT},
    )
    queue_date = models.DateField()
    current_number = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("service_point", "queue_date")]

    def clean(self):
        super().clean()
        validate_is_service_point(self.service_point)

    def __str__(self):
        return f"{self.service_point} {self.queue_date}"


class QueueTicket(models.Model):
    class Status(models.TextChoices):
        WAITING = "WAITING"
        CALLED = "CALLED"
        SERVING = "SERVING"
        DONE = "DONE"
        SKIPPED = "SKIPPED"

    queue = models.ForeignKey(Queue, on_delete=models.CASCADE, related_name="tickets")
    visit_step = models.OneToOneField(
        VisitStep, on_delete=models.CASCADE, related_name="queue_ticket"
    )
    ticket_number = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING)
    called_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Ticket {self.ticket_number} ({self.queue})"


class ServiceSchedule(models.Model):
    class DayOfWeek(models.IntegerChoices):
        MON = 0, "Mon"
        TUE = 1, "Tue"
        WED = 2, "Wed"
        THU = 3, "Thu"
        FRI = 4, "Fri"
        SAT = 5, "Sat"
        SUN = 6, "Sun"

    service_point = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name="schedules",
        limit_choices_to={"node_type": Node.NodeType.SERVICE_POINT},
    )
    day_of_week = models.IntegerField(choices=DayOfWeek.choices)
    open_time = models.TimeField()
    close_time = models.TimeField()

    def clean(self):
        super().clean()
        validate_is_service_point(self.service_point)

    def __str__(self):
        return f"{self.service_point} {self.get_day_of_week_display()}"
