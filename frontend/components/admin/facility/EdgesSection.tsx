"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { SearchInput } from "@/components/admin/SearchInput";
import { EDGE_TYPES, edgesApi, type EdgeType, type FacilityEdge, type FacilityNode } from "@/lib/api/facility";
import { bool, id, int, optionalNum, str } from "@/lib/admin-form-utils";

function edgeToFormValues(edge: FacilityEdge): FormValues {
  return {
    from_node: String(edge.from_node),
    to_node: String(edge.to_node),
    distance_m: String(edge.distance_m),
    edge_type: edge.edge_type,
    walk_time_sec: String(edge.walk_time_sec),
    is_bidirectional: edge.is_bidirectional,
    wheelchair_accessible: edge.wheelchair_accessible,
  };
}

export function EdgesSection({
  edges,
  nodes,
  loading,
  refetch,
}: {
  edges: FacilityEdge[];
  nodes: FacilityNode[];
  loading: boolean;
  refetch: () => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FacilityEdge | null>(null);
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<EdgeType | "">("");
  const [search, setSearch] = useState("");

  function nodeLabel(nodeId: number): string {
    const node = nodes.find((n) => n.id === nodeId);
    return node ? node.name_th : `#${nodeId}`;
  }

  const nodeOptions = nodes.map((n) => ({ value: String(n.id), label: n.name_th }));
  const edgeTypeLabel = (type: EdgeType) => t(`edgeType.${type}` as const);

  const needle = search.trim().toLowerCase();
  const visibleEdges = edges.filter((edge) => {
    if (edgeTypeFilter && edge.edge_type !== edgeTypeFilter) return false;
    if (needle) {
      const haystack = `${nodeLabel(edge.from_node)} ${nodeLabel(edge.to_node)}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const fields: FieldConfig[] = [
    { name: "from_node", label: t("colFromNode"), type: "select", required: true, options: nodeOptions },
    { name: "to_node", label: t("colToNode"), type: "select", required: true, options: nodeOptions },
    {
      name: "edge_type",
      label: t("colEdgeType"),
      type: "select",
      required: true,
      options: EDGE_TYPES.map((type) => ({ value: type, label: edgeTypeLabel(type) })),
    },
    { name: "distance_m", label: t("colDistance"), type: "number", helpText: t("edgeDistanceHelp") },
    { name: "walk_time_sec", label: t("colWalkTime"), type: "integer", required: true },
    { name: "is_bidirectional", label: t("colBidirectional"), type: "checkbox" },
    { name: "wheelchair_accessible", label: t("colWheelchair"), type: "checkbox" },
  ];

  const columns: DataTableColumn<FacilityEdge>[] = [
    { key: "from_node", header: t("colFromNode"), render: (row) => nodeLabel(row.from_node) },
    { key: "to_node", header: t("colToNode"), render: (row) => nodeLabel(row.to_node) },
    { key: "edge_type", header: t("colEdgeType"), render: (row) => edgeTypeLabel(row.edge_type) },
    { key: "distance_m", header: t("colDistance"), render: (row) => row.distance_m },
    { key: "walk_time_sec", header: t("colWalkTime"), render: (row) => row.walk_time_sec },
  ];

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: FacilityEdge) {
    setEditing(row);
    setSheetOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    // `distance_m` is optional on write (Phase 5): a blank field must OMIT the
    // key entirely (not send `null`/`""`) so the backend's auto-calculate path
    // kicks in — DRF rejects both `null` and `""` as invalid floats.
    const distanceM = optionalNum(values.distance_m);
    const payload = {
      from_node: id(values.from_node),
      to_node: id(values.to_node),
      ...(distanceM != null ? { distance_m: distanceM } : {}),
      edge_type: str(values.edge_type) as EdgeType,
      walk_time_sec: int(values.walk_time_sec),
      is_bidirectional: bool(values.is_bidirectional),
      wheelchair_accessible: bool(values.wheelchair_accessible),
    };
    if (editing) {
      await edgesApi.update(editing.id, payload);
    } else {
      await edgesApi.create(payload);
    }
    setSheetOpen(false);
    await refetch();
  }

  async function handleDelete(row: FacilityEdge) {
    await edgesApi.remove(row.id);
    await refetch();
  }

  const filters = (
    <>
      <select
        value={edgeTypeFilter}
        onChange={(event) => setEdgeTypeFilter(event.target.value as EdgeType | "")}
        className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--brand-teal)]"
      >
        <option value="">{t("filterAllOption")}</option>
        {EDGE_TYPES.map((type) => (
          <option key={type} value={type}>
            {edgeTypeLabel(type)}
          </option>
        ))}
      </select>
      <SearchInput value={search} onChange={setSearch} placeholder={t("edgesSearchPlaceholder")} />
    </>
  );

  return (
    <>
      <DataTable
        columns={columns}
        rows={visibleEdges}
        rowKey={(row) => row.id}
        loading={loading}
        filters={filters}
        addLabel={t("addEdge")}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        emptyTitle={t("edgesEmptyTitle")}
        emptyDescription={t("edgesEmptyDescription")}
      />
      {sheetOpen && (
        <RecordFormSheet
        title={editing ? t("editEdge") : t("addEdge")}
        fields={fields}
        initialValues={editing ? edgeToFormValues(editing) : { is_bidirectional: true, wheelchair_accessible: true }}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        />
      )}
    </>
  );
}
