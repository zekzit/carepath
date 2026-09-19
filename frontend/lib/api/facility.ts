import { createResourceClient } from "./resource";

export type Building = {
  id: number;
  name_th: string;
  name_en: string;
  code: string;
};
export type BuildingInput = Omit<Building, "id">;

export type Floor = {
  id: number;
  building: number;
  level_no: number;
  name_th: string;
  name_en: string;
  plan_scale_m_per_px: number | null;
};
export type FloorInput = Omit<Floor, "id">;

export const NODE_TYPES = ["SERVICE_POINT", "JUNCTION", "VERTICAL_CONNECTOR", "KIOSK", "ENTRANCE"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

// Named FacilityNode (not "Node") to avoid clashing with the DOM's global Node type.
export type FacilityNode = {
  id: number;
  floor: number;
  node_type: NodeType;
  name_th: string;
  name_en: string;
  pos_x: number;
  pos_y: number;
  vertical_group: string;
  location_qr_code: string | null;
  service_point_code: string | null;
  department_th: string;
  department_en: string;
  is_active: boolean;
  device_code: string | null;
};
export type FacilityNodeInput = Omit<FacilityNode, "id">;

export const EDGE_TYPES = ["CORRIDOR", "ELEVATOR", "STAIRS", "RAMP"] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export type FacilityEdge = {
  id: number;
  from_node: number;
  to_node: number;
  distance_m: number;
  edge_type: EdgeType;
  walk_time_sec: number;
  is_bidirectional: boolean;
  wheelchair_accessible: boolean;
};
export type FacilityEdgeInput = Omit<FacilityEdge, "id">;

export const buildingsApi = createResourceClient<Building, BuildingInput>("/facility/buildings");
export const floorsApi = createResourceClient<Floor, FloorInput>("/facility/floors");
export const nodesApi = createResourceClient<FacilityNode, FacilityNodeInput>("/facility/nodes");
export const edgesApi = createResourceClient<FacilityEdge, FacilityEdgeInput>("/facility/edges");
