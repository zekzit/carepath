from .models import AuditLog


def log_action(user, action: str, target_type: str, target_id: int, detail: dict | None = None) -> None:
    """Central write path for AuditLog — same per-app "business logic lives in
    services.py" convention as visits/services.py and queues/services.py.
    `user` may be AnonymousUser (AllowAny endpoints) — recorded as staff_user=None."""
    AuditLog.objects.create(
        staff_user=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail,
    )
