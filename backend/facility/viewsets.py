from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.viewsets import ModelViewSet

from accounts.models import StaffUser
from accounts.permissions import RoleRequired

from .models import Building, Edge, Floor, Node
from .serializers import BuildingSerializer, EdgeSerializer, FloorSerializer, NodeSerializer


@extend_schema_view(
    list=extend_schema(summary="List buildings", description="Ordered by `code`."),
    retrieve=extend_schema(summary="Retrieve a building"),
    create=extend_schema(summary="Create a building"),
    update=extend_schema(summary="Replace a building"),
    partial_update=extend_schema(summary="Partially update a building"),
    destroy=extend_schema(summary="Delete a building"),
)
class BuildingViewSet(ModelViewSet):
    queryset = Building.objects.all().order_by("code")
    serializer_class = BuildingSerializer
    permission_classes = [RoleRequired]
    read_roles = ()
    write_roles = ()


@extend_schema_view(
    list=extend_schema(summary="List floors", description="Ordered by `(building__code, level_no)`."),
    retrieve=extend_schema(summary="Retrieve a floor"),
    create=extend_schema(summary="Create a floor"),
    update=extend_schema(summary="Replace a floor"),
    partial_update=extend_schema(summary="Partially update a floor"),
    destroy=extend_schema(summary="Delete a floor"),
)
class FloorViewSet(ModelViewSet):
    queryset = Floor.objects.select_related("building").order_by("building__code", "level_no")
    serializer_class = FloorSerializer
    permission_classes = [RoleRequired]
    read_roles = ()
    write_roles = ()


@extend_schema_view(
    list=extend_schema(
        summary="List nodes",
        description=(
            "All mappable points on the hospital graph — rooms, service "
            "points, kiosks, vertical connectors (elevator/staircase). "
            "Ordered by `(floor_id, name_en)`."
        ),
    ),
    retrieve=extend_schema(summary="Retrieve a node"),
    create=extend_schema(summary="Create a node"),
    update=extend_schema(summary="Replace a node"),
    partial_update=extend_schema(summary="Partially update a node"),
    destroy=extend_schema(summary="Delete a node"),
)
class NodeViewSet(ModelViewSet):
    queryset = Node.objects.select_related("floor").order_by("floor_id", "name_en")
    serializer_class = NodeSerializer
    permission_classes = [RoleRequired]
    # Every staff role that lands on the Admin Portal Dashboard (REGISTRAR,
    # SERVICE_STAFF, EXECUTIVE, ADMIN — see admin-nav.ts's "dashboard" nav
    # item) needs read access to the facility node graph: DashboardPage
    # unconditionally calls nodesApi.list() to compute "service points
    # open" and resolve queues, and QueueConsolePage/ScheduleAdminPage/
    # VisitDetail need it too for their own (already role-gated) pages.
    # Before this widening every non-ADMIN role 403'd here, which is the
    # same class of RBAC/reporting-interaction bug as VisitStepViewSet's
    # (see GAP.md) — discovered while verifying the Executive Dashboard
    # walkthrough end-to-end, not just testing as ADMIN (which bypasses all
    # role checks and would have hidden this). write_roles stays
    # ADMIN-only — editing the facility map is still admin-only, matching
    # the "facility" nav item's ADMIN-only gating.
    read_roles = (StaffUser.Role.REGISTRAR, StaffUser.Role.SERVICE_STAFF, StaffUser.Role.EXECUTIVE)
    write_roles = ()


@extend_schema_view(
    list=extend_schema(summary="List edges", description="All graph edges between nodes (corridors, stairs, elevators)."),
    retrieve=extend_schema(summary="Retrieve an edge"),
    create=extend_schema(
        summary="Create an edge",
        description=(
            "If `distance_m` is omitted, it's auto-calculated from the two "
            "nodes' `pos_x`/`pos_y` and the source floor's "
            "`plan_scale_m_per_px`. Otherwise the manual value is used. "
            "Both nodes must be on the same calibrated floor for "
            "auto-calc, else `distance_m` must be provided."
        ),
    ),
    update=extend_schema(summary="Replace an edge"),
    partial_update=extend_schema(summary="Partially update an edge"),
    destroy=extend_schema(summary="Delete an edge"),
)
class EdgeViewSet(ModelViewSet):
    queryset = Edge.objects.select_related("from_node", "to_node").all()
    serializer_class = EdgeSerializer
    permission_classes = [RoleRequired]
    read_roles = ()
    write_roles = ()