"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { NODE_TYPES, nodesApi, type Building, type FacilityNode, type Floor, type NodeType } from "@/lib/api/facility";
import { bool, num, optionalStr, str } from "@/lib/admin-form-utils";

function nodeToFormValues(node: FacilityNode): FormValues {
  return {
    floor: String(node.floor),
    node_type: node.node_type,
    name_th: node.name_th,
    name_en: node.name_en,
    pos_x: String(node.pos_x),
    pos_y: String(node.pos_y),
    vertical_group: node.vertical_group,
    location_qr_code: node.location_qr_code ?? "",
    service_point_code: node.service_point_code ?? "",
    department_th: node.department_th,
    department_en: node.department_en,
    is_active: node.is_active,
    device_code: node.device_code ?? "",
  };
}

export function NodesSection({
  nodes,
  floors,
  buildings,
  loading,
  refetch,
}: {
  nodes: FacilityNode[];
  floors: Floor[];
  buildings: Building[];
  loading: boolean;
  refetch: () => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FacilityNode | null>(null);

  const nodeTypeLabel = (type: NodeType) => t(`nodeType.${type}` as const);

  function floorLabel(floorId: number): string {
    const floor = floors.find((f) => f.id === floorId);
    if (!floor) return `#${floorId}`;
    const building = buildings.find((b) => b.id === floor.building);
    return `${building ? building.code : "?"} · ${floor.name_th} (L${floor.level_no})`;
  }

  const fields: FieldConfig[] = [
    {
      name: "floor",
      label: t("colFloor"),
      type: "select",
      required: true,
      options: floors.map((f) => ({ value: String(f.id), label: floorLabel(f.id) })),
    },
    {
      name: "node_type",
      label: t("colNodeType"),
      type: "select",
      required: true,
      helpText: t("nodeTypeHelp"),
      options: NODE_TYPES.map((type) => ({ value: type, label: nodeTypeLabel(type) })),
    },
    { name: "name_th", label: t("colNameTh"), type: "text", required: true },
    { name: "name_en", label: t("colNameEn"), type: "text", required: true },
    { name: "pos_x", label: t("colPosX"), type: "number", required: true },
    { name: "pos_y", label: t("colPosY"), type: "number", required: true },
    { name: "vertical_group", label: t("colVerticalGroup"), type: "text", helpText: t("verticalGroupHelp") },
    { name: "location_qr_code", label: t("colQrCode"), type: "text", helpText: t("locationQrHelp") },
    {
      name: "service_point_code",
      label: t("colServicePointCode"),
      type: "text",
      visible: (values) => values.node_type === "SERVICE_POINT",
    },
    {
      name: "department_th",
      label: t("colDepartmentTh"),
      type: "text",
      visible: (values) => values.node_type === "SERVICE_POINT",
    },
    {
      name: "department_en",
      label: t("colDepartmentEn"),
      type: "text",
      visible: (values) => values.node_type === "SERVICE_POINT",
    },
    {
      name: "is_active",
      label: t("colIsActive"),
      type: "checkbox",
      visible: (values) => values.node_type === "SERVICE_POINT",
    },
    {
      name: "device_code",
      label: t("colDeviceCode"),
      type: "text",
      visible: (values) => values.node_type === "KIOSK",
    },
  ];

  const columns: DataTableColumn<FacilityNode>[] = [
    { key: "name_th", header: t("colNameTh"), render: (row) => row.name_th },
    { key: "node_type", header: t("colNodeType"), render: (row) => nodeTypeLabel(row.node_type) },
    { key: "floor", header: t("colFloor"), render: (row) => floorLabel(row.floor) },
    {
      key: "extra",
      header: t("colServicePointCode"),
      render: (row) =>
        row.node_type === "SERVICE_POINT"
          ? `${row.service_point_code ?? "—"}${row.is_active ? "" : ` (${t("inactive")})`}`
          : row.node_type === "KIOSK"
            ? row.device_code ?? "—"
            : "—",
    },
  ];

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: FacilityNode) {
    setEditing(row);
    setSheetOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    const nodeType = str(values.node_type) as NodeType;
    const isServicePoint = nodeType === "SERVICE_POINT";
    const isKiosk = nodeType === "KIOSK";
    const payload = {
      floor: num(values.floor),
      node_type: nodeType,
      name_th: str(values.name_th),
      name_en: str(values.name_en),
      pos_x: num(values.pos_x),
      pos_y: num(values.pos_y),
      vertical_group: str(values.vertical_group),
      location_qr_code: optionalStr(values.location_qr_code),
      // Conditional fields: explicitly cleared (not merely omitted) when the
      // node_type doesn't apply, since PATCH would otherwise leave a stale
      // truthy value on the instance and trip Node.clean() server-side.
      service_point_code: isServicePoint ? optionalStr(values.service_point_code) : null,
      department_th: isServicePoint ? str(values.department_th) : "",
      department_en: isServicePoint ? str(values.department_en) : "",
      is_active: isServicePoint ? bool(values.is_active) : true,
      device_code: isKiosk ? optionalStr(values.device_code) : null,
    };
    if (editing) {
      await nodesApi.update(editing.id, payload);
    } else {
      await nodesApi.create(payload);
    }
    setSheetOpen(false);
    await refetch();
  }

  async function handleDelete(row: FacilityNode) {
    await nodesApi.remove(row.id);
    await refetch();
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={nodes}
        rowKey={(row) => row.id}
        loading={loading}
        addLabel={t("addNode")}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        emptyTitle={t("nodesEmptyTitle")}
        emptyDescription={t("nodesEmptyDescription")}
      />
      {sheetOpen && (
        <RecordFormSheet
        title={editing ? t("editNode") : t("addNode")}
        fields={fields}
        initialValues={editing ? nodeToFormValues(editing) : undefined}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        />
      )}
    </>
  );
}
