"""Shortest-path routing over the facility graph (FR-13 / FR-12 / FR-17).

Dijkstra's algorithm, hand-rolled with `heapq` (no extra dependency —
`networkx` is not installed and this graph is small: a full hospital's
worth of nodes/edges, not a city). Weighted by `walk_time_sec` (the
"shortest" the SRS asks for — เวลาเดิน), with `distance_m` tracked
alongside for reporting.

`Edge` rows are not restricted to same-floor nodes: an `ELEVATOR`/`STAIRS`
edge directly connects a `VERTICAL_CONNECTOR` node on one floor to another
on a different floor, which is how floor transitions are modeled — no
special-casing needed here, they're just edges like any other.
"""

from __future__ import annotations

import heapq
import math
from dataclasses import dataclass, field

from .models import Edge, Node

# Edge types across which a bearing/turn comparison is meaningless (they
# represent a floor change, not a walk along a corridor).
_NON_CORRIDOR_TYPES = (Edge.EdgeType.ELEVATOR, Edge.EdgeType.STAIRS)

# diff thresholds (degrees) used to classify a turn — see _turn_for().
_TURN_THRESHOLD_DEG = 25


@dataclass
class RouteLeg:
    from_node_id: int
    to_node_id: int
    edge_type: str  # Edge.EdgeType value
    distance_m: float
    walk_time_sec: int
    turn: str | None = None  # "LEFT" | "RIGHT" | "STRAIGHT" | None


@dataclass
class RouteResult:
    reachable: bool
    total_distance_m: float = 0.0
    total_time_sec: int = 0
    legs: list[RouteLeg] = field(default_factory=list)


# adjacency entry: (neighbor_node_id, walk_time_sec, distance_m, edge_type)
_AdjEntry = tuple[int, int, float, str]


def _bearing_deg(from_node: Node, to_node: Node) -> float:
    """Bearing in degrees [0, 360), clockwise from north — must match
    frontend/lib/direction.ts::computeDirection() exactly so the two stay
    consistent (atan2(dx, -dy), image pixel coords, north = -Y)."""
    dx = to_node.pos_x - from_node.pos_x
    dy = to_node.pos_y - from_node.pos_y
    radians = math.atan2(dx, -dy)
    return (radians * 180 / math.pi + 360) % 360


def _turn_for(incoming_bearing: float, outgoing_bearing: float) -> str:
    diff = ((outgoing_bearing - incoming_bearing + 540) % 360) - 180
    if diff > _TURN_THRESHOLD_DEG:
        return "RIGHT"
    if diff < -_TURN_THRESHOLD_DEG:
        return "LEFT"
    return "STRAIGHT"


def shortest_path(from_node_id: int, to_node_id: int, wheelchair: bool = False) -> RouteResult:
    if from_node_id == to_node_id:
        return RouteResult(reachable=True, total_distance_m=0.0, total_time_sec=0, legs=[])

    adjacency: dict[int, list[_AdjEntry]] = {}
    nodes_by_id: dict[int, Node] = {}

    def add_edge(a_id: int, b_id: int, walk_time_sec: int, distance_m: float, edge_type: str) -> None:
        adjacency.setdefault(a_id, []).append((b_id, walk_time_sec, distance_m, edge_type))

    for edge in Edge.objects.select_related("from_node", "to_node").all():
        # Positions are recorded regardless of the wheelchair filter below,
        # so turn-detection lookups later always find every node that ends
        # up on the path (every path node is reached via some edge that
        # passed the filter, and its endpoints are recorded here too).
        nodes_by_id[edge.from_node_id] = edge.from_node
        nodes_by_id[edge.to_node_id] = edge.to_node

        if wheelchair and not edge.wheelchair_accessible:
            continue

        add_edge(edge.from_node_id, edge.to_node_id, edge.walk_time_sec, edge.distance_m, edge.edge_type)
        if edge.is_bidirectional:
            add_edge(edge.to_node_id, edge.from_node_id, edge.walk_time_sec, edge.distance_m, edge.edge_type)

    # Dijkstra, weighted by walk_time_sec.
    dist: dict[int, int] = {from_node_id: 0}
    prev: dict[int, _AdjEntry] = {}  # to_node_id -> (from_node_id, walk_time_sec, distance_m, edge_type)
    visited: set[int] = set()
    heap: list[tuple[int, int]] = [(0, from_node_id)]

    while heap:
        d, node_id = heapq.heappop(heap)
        if node_id in visited:
            continue
        visited.add(node_id)
        if node_id == to_node_id:
            break
        for neighbor_id, walk_time_sec, distance_m, edge_type in adjacency.get(node_id, []):
            if neighbor_id in visited:
                continue
            nd = d + walk_time_sec
            if neighbor_id not in dist or nd < dist[neighbor_id]:
                dist[neighbor_id] = nd
                prev[neighbor_id] = (node_id, walk_time_sec, distance_m, edge_type)
                heapq.heappush(heap, (nd, neighbor_id))

    if to_node_id not in visited:
        return RouteResult(reachable=False)

    # Reconstruct the path as a list of node ids, from_node_id first.
    path_node_ids: list[int] = [to_node_id]
    node_id = to_node_id
    while node_id != from_node_id:
        node_id = prev[node_id][0]
        path_node_ids.append(node_id)
    path_node_ids.reverse()

    legs: list[RouteLeg] = []
    total_distance_m = 0.0
    total_time_sec = 0
    prev_edge_type: str | None = None

    for i in range(1, len(path_node_ids)):
        leg_from_id = path_node_ids[i - 1]
        leg_to_id = path_node_ids[i]
        _, walk_time_sec, distance_m, edge_type = prev[leg_to_id]

        turn: str | None = None
        if i >= 2 and prev_edge_type not in _NON_CORRIDOR_TYPES and edge_type not in _NON_CORRIDOR_TYPES:
            before_id = path_node_ids[i - 2]
            before_node = nodes_by_id.get(before_id)
            mid_node = nodes_by_id.get(leg_from_id)
            after_node = nodes_by_id.get(leg_to_id)
            if (
                before_node is not None
                and mid_node is not None
                and after_node is not None
                and before_node.floor_id == mid_node.floor_id
                and mid_node.floor_id == after_node.floor_id
            ):
                incoming_bearing = _bearing_deg(before_node, mid_node)
                outgoing_bearing = _bearing_deg(mid_node, after_node)
                turn = _turn_for(incoming_bearing, outgoing_bearing)

        legs.append(
            RouteLeg(
                from_node_id=leg_from_id,
                to_node_id=leg_to_id,
                edge_type=edge_type,
                distance_m=distance_m,
                walk_time_sec=walk_time_sec,
                turn=turn,
            )
        )
        total_distance_m += distance_m
        total_time_sec += walk_time_sec
        prev_edge_type = edge_type

    return RouteResult(
        reachable=True,
        total_distance_m=total_distance_m,
        total_time_sec=total_time_sec,
        legs=legs,
    )
