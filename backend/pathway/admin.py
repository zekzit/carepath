from django.contrib import admin

from .models import CareCategory, PathwayTemplate, TemplateStep

admin.site.register(CareCategory)
admin.site.register(PathwayTemplate)
admin.site.register(TemplateStep)
