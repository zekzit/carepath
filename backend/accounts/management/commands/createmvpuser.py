from django.core.management.base import BaseCommand

from accounts.models import StaffUser

DEFAULT_PASSWORD = "testpass123"

MVP_USERS = [
    {"username": "admin", "role": StaffUser.Role.ADMIN, "first_name": "Admin", "last_name": "User"},
    {"username": "registrar", "role": StaffUser.Role.REGISTRAR, "first_name": "Registrar", "last_name": "User"},
    {
        "username": "service_staff",
        "role": StaffUser.Role.SERVICE_STAFF,
        "first_name": "Service",
        "last_name": "Staff",
    },
    {"username": "executive", "role": StaffUser.Role.EXECUTIVE, "first_name": "Executive", "last_name": "User"},
]


class Command(BaseCommand):
    help = (
        "Creates (or resets) one StaffUser per role for local development/demo "
        f"login testing, all with the password '{DEFAULT_PASSWORD}'. Safe to "
        "re-run — existing accounts just get their role/password reset to match "
        "(see CREDENTIALS.md)."
    )

    def handle(self, *args, **options):
        for spec in MVP_USERS:
            user, created = StaffUser.objects.get_or_create(
                username=spec["username"],
                defaults={
                    "role": spec["role"],
                    "first_name": spec["first_name"],
                    "last_name": spec["last_name"],
                },
            )
            user.role = spec["role"]
            user.first_name = spec["first_name"]
            user.last_name = spec["last_name"]
            user.is_active = True
            user.set_password(DEFAULT_PASSWORD)
            user.save()

            verb = "Created" if created else "Reset"
            self.stdout.write(self.style.SUCCESS(f"{verb} {spec['username']} ({spec['role']})"))

        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                f"All accounts use the password '{DEFAULT_PASSWORD}' — local development only, never production."
            )
        )
