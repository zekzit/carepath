from django.contrib import admin

from .models import Patient, Visit, VisitStep

admin.site.register(Patient)
admin.site.register(Visit)
admin.site.register(VisitStep)
