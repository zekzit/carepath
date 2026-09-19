from django.contrib import admin

from .models import Queue, QueueTicket, ServiceSchedule

admin.site.register(Queue)
admin.site.register(QueueTicket)
admin.site.register(ServiceSchedule)
