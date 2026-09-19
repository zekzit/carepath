from rest_framework.permissions import BasePermission

from .models import StaffUser


class RoleRequired(BasePermission):
    """Generic DRF permission for ViewSets that declare `read_roles` /
    `write_roles` class attributes (tuples of StaffUser.Role values).

    - Must be authenticated (session login), full stop.
    - ADMIN is an implicit super-role: always allowed, regardless of
      read_roles/write_roles.
    - `list`/`retrieve` actions check `view.read_roles`.
    - Every other action (create/update/partial_update/destroy, and any
      custom @action like `start`/`complete`/`skip`/`call_next`/`serve`/
      `done`) checks `view.write_roles` if set, else falls back to
      `read_roles`.
    - An empty tuple means "ADMIN only" (since ADMIN already bypasses).
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role == StaffUser.Role.ADMIN:
            return True
        action = getattr(view, "action", None)
        read_roles = getattr(view, "read_roles", ())
        write_roles = getattr(view, "write_roles", None)
        roles = read_roles if action in ("list", "retrieve") else (write_roles if write_roles else read_roles)
        return user.role in roles
