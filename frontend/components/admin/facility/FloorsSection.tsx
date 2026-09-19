"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { floorsApi, type Building, type Floor } from "@/lib/api/facility";
import { id, int, optionalNum, str } from "@/lib/admin-form-utils";

function floorToFormValues(floor: Floor): FormValues {
  return {
    building: String(floor.building),
    level_no: String(floor.level_no),
    name_th: floor.name_th,
    name_en: floor.name_en,
    plan_scale_m_per_px: floor.plan_scale_m_per_px == null ? "" : String(floor.plan_scale_m_per_px),
  };
}

export function FloorsSection({
  floors,
  buildings,
  loading,
  refetch,
}: {
  floors: Floor[];
  buildings: Building[];
  loading: boolean;
  refetch: () => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Floor | null>(null);

  function buildingLabel(buildingId: number): string {
    const building = buildings.find((b) => b.id === buildingId);
    return building ? `${building.code} · ${building.name_th}` : `#${buildingId}`;
  }

  const fields: FieldConfig[] = [
    {
      name: "building",
      label: t("colBuilding"),
      type: "select",
      required: true,
      options: buildings.map((b) => ({ value: String(b.id), label: `${b.code} · ${b.name_th}` })),
    },
    { name: "level_no", label: t("colLevel"), type: "integer", required: true, helpText: t("floorLevelHelp") },
    { name: "name_th", label: t("colNameTh"), type: "text", required: true },
    { name: "name_en", label: t("colNameEn"), type: "text", required: true },
    { name: "plan_scale_m_per_px", label: t("colScale"), type: "number", helpText: t("floorScaleHelp") },
  ];

  const columns: DataTableColumn<Floor>[] = [
    { key: "building", header: t("colBuilding"), render: (row) => buildingLabel(row.building) },
    { key: "level_no", header: t("colLevel"), render: (row) => row.level_no },
    { key: "name_th", header: t("colNameTh"), render: (row) => row.name_th },
    { key: "name_en", header: t("colNameEn"), render: (row) => row.name_en },
    {
      key: "plan_scale_m_per_px",
      header: t("colScale"),
      render: (row) => (row.plan_scale_m_per_px == null ? "—" : row.plan_scale_m_per_px),
    },
  ];

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: Floor) {
    setEditing(row);
    setSheetOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    const payload = {
      building: id(values.building),
      level_no: int(values.level_no),
      name_th: str(values.name_th),
      name_en: str(values.name_en),
      plan_scale_m_per_px: optionalNum(values.plan_scale_m_per_px),
    };
    if (editing) {
      await floorsApi.update(editing.id, payload);
    } else {
      await floorsApi.create(payload);
    }
    setSheetOpen(false);
    await refetch();
  }

  async function handleDelete(row: Floor) {
    await floorsApi.remove(row.id);
    await refetch();
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={floors}
        rowKey={(row) => row.id}
        loading={loading}
        addLabel={t("addFloor")}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        emptyTitle={t("floorsEmptyTitle")}
        emptyDescription={t("floorsEmptyDescription")}
      />
      {sheetOpen && (
        <RecordFormSheet
        title={editing ? t("editFloor") : t("addFloor")}
        fields={fields}
        initialValues={editing ? floorToFormValues(editing) : undefined}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        />
      )}
    </>
  );
}
