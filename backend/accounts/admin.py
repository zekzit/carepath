from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AuditLog, ServicePointStaff, StaffUser


class StaffUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Role", {"fields": ("role",)}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Role", {"fields": ("role",)}),)


admin.site.register(StaffUser, StaffUserAdmin)
admin.site.register(ServicePointStaff)
admin.site.register(AuditLog)
