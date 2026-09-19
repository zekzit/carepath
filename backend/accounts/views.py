from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import services
from .serializers import StaffUserSerializer


_error_with_detail = inline_serializer(
    name="ErrorWithDetail",
    fields={"detail": serializers.CharField()},
)


@ensure_csrf_cookie
@extend_schema(
    request=inline_serializer(
        name="LoginRequest",
        fields={
            "username": serializers.CharField(),
            "password": serializers.CharField(),
        },
    ),
    responses={
        200: StaffUserSerializer,
        400: _error_with_detail,
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")
    if not username or not password:
        return Response({"detail": "username and password are required."}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({"detail": "Invalid credentials."}, status=400)

    login(request, user)
    services.log_action(user, "LOGIN", "StaffUser", user.id)
    return Response(StaffUserSerializer(user).data)


@extend_schema(
    request=OpenApiTypes.NONE,
    responses={204: OpenApiResponse(description="No content")},
)
@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    if request.user.is_authenticated:
        services.log_action(request.user, "LOGOUT", "StaffUser", request.user.id)
    logout(request)
    return Response(status=204)


@ensure_csrf_cookie
@extend_schema(
    responses={
        200: StaffUserSerializer,
        401: _error_with_detail,
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def me_view(request):
    """Also primes the csrftoken cookie — the frontend hits this first, before any login/mutation."""
    if not request.user.is_authenticated:
        # Response(None) would serialize to an empty body, not JSON `null`,
        # which breaks a plain `fetch(...).then(r => r.json())` on the
        # frontend — an explicit body + 401 is the caller-friendly contract.
        return Response({"detail": "Not authenticated."}, status=401)
    return Response(StaffUserSerializer(request.user).data)
