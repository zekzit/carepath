"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AdminTabs } from "@/components/admin/AdminTabs";
import {
  buildingsApi,
  edgesApi,
  floorsApi,
  nodesApi,
  type Building,
  type FacilityEdge,
  type FacilityNode,
  type Floor,
} from "@/lib/api/facility";
import { BuildingsSection } from "./BuildingsSection";
import { FloorsSection } from "./FloorsSection";
import { NodesSection } from "./NodesSection";
import { EdgesSection } from "./EdgesSection";
import { FloorMapSection } from "./FloorMapSection";

type TabId = "buildings" | "floors" | "nodes" | "edges" | "map";

async function fetchFacilityData() {
  const [buildings, floors, nodes, edges] = await Promise.all([
    buildingsApi.list(),
    floorsApi.list(),
    nodesApi.list(),
    edgesApi.list(),
  ]);
  return { buildings, floors, nodes, edges };
}

export function FacilityAdminPage() {
  const t = useTranslations("admin");
  const [tab, setTab] = useState<TabId>("buildings");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [nodes, setNodes] = useState<FacilityNode[]>([]);
  const [edges, setEdges] = useState<FacilityEdge[]>([]);
  const [loading, setLoading] = useState(true);

  // Called by child sections after a create/update/delete succeeds.
  async function refetchAll() {
    setLoading(true);
    try {
      const data = await fetchFacilityData();
      setBuildings(data.buildings);
      setFloors(data.floors);
      setNodes(data.nodes);
      setEdges(data.edges);
    } finally {
      setLoading(false);
    }
  }

  // Initial load on mount — kept as its own effect (rather than calling the
  // `refetchAll` above) so state is only ever set from a function whose body
  // lives directly inside the effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchFacilityData();
        if (cancelled) return;
        setBuildings(data.buildings);
        setFloors(data.floors);
        setNodes(data.nodes);
        setEdges(data.edges);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs = [
    { id: "buildings", label: t("facilityTabBuildings") },
    { id: "floors", label: t("facilityTabFloors") },
    { id: "nodes", label: t("facilityTabNodes") },
    { id: "edges", label: t("facilityTabEdges") },
    { id: "map", label: t("facilityTabMap") },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminTabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === "buildings" && <BuildingsSection buildings={buildings} loading={loading} refetch={refetchAll} />}
      {tab === "floors" && (
        <FloorsSection floors={floors} buildings={buildings} loading={loading} refetch={refetchAll} />
      )}
      {tab === "nodes" && (
        <NodesSection nodes={nodes} floors={floors} buildings={buildings} loading={loading} refetch={refetchAll} />
      )}
      {tab === "edges" && <EdgesSection edges={edges} nodes={nodes} loading={loading} refetch={refetchAll} />}
      {tab === "map" && (
        <FloorMapSection
          floors={floors}
          buildings={buildings}
          nodes={nodes}
          edges={edges}
          loading={loading}
          refetch={refetchAll}
        />
      )}
    </div>
  );
}
