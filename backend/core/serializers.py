from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


class CleanOnValidateMixin:
    """Re-runs the model's `clean()` (not `full_clean()`) during DRF validation.

    Field-level checks (required/unique/type) are already handled by DRF's
    own serializer fields, so this only enforces the model's custom business
    rules (e.g. facility.Node.clean, pathway.TemplateStep.clean) the same way
    Django admin's ModelForm would — otherwise they'd only ever run for data
    entered through /admin/, not through this API.

    Many-to-many fields are skipped: Django forbids setting them on an
    unsaved instance, and none of this project's `clean()` overrides touch
    an m2m field anyway (see facility/pathway/queues/accounts models.py).
    """

    def validate(self, attrs):
        attrs = super().validate(attrs)
        model = self.Meta.model
        m2m_fields = {f.name for f in model._meta.many_to_many}
        instance = self.instance or model()
        for field, value in attrs.items():
            if field in m2m_fields:
                continue
            setattr(instance, field, value)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(getattr(exc, "message_dict", None) or {"non_field_errors": exc.messages})
        return attrs
