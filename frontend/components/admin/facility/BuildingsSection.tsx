"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { buildingsApi, type Building } from "@/lib/api/facility";
import { str } from "@/lib/admin-form-utils";

export function BuildingsSection({ buildings, loading, refetch }: { buildings: Building[]; loading: boolean; refetch: () => Promise<void> }) {
  const t = useTranslations("admin");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);

  const fields: FieldConfig[] = [
    { name: "name_th", label: t("colNameTh"), type: "text", required: true },
    { name: "name_en", label: t("colNameEn"), type: "text", required: true },
    { name: "code", label: t("colCode"), type: "text", required: true, helpText: t("buildingCodeHelp") },
  ];

  const columns: DataTableColumn<Building>[] = [
    { key: "name_th", header: t("colNameTh"), render: (row) => row.name_th },
    { key: "name_en", header: t("colNameEn"), render: (row) => row.name_en },
    { key: "code", header: t("colCode"), render: (row) => row.code },
  ];

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: Building) {
    setEditing(row);
    setSheetOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    const payload = { name_th: str(values.name_th), name_en: str(values.name_en), code: str(values.code) };
    if (editing) {
      await buildingsApi.update(editing.id, payload);
    } else {
      await buildingsApi.create(payload);
    }
    setSheetOpen(false);
    await refetch();
  }

  async function handleDelete(row: Building) {
    await buildingsApi.remove(row.id);
    await refetch();
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={buildings}
        rowKey={(row) => row.id}
        loading={loading}
        addLabel={t("addBuilding")}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        emptyTitle={t("buildingsEmptyTitle")}
        emptyDescription={t("buildingsEmptyDescription")}
      />
      {sheetOpen && (
        <RecordFormSheet
        title={editing ? t("editBuilding") : t("addBuilding")}
        fields={fields}
        initialValues={editing ?? undefined}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        />
      )}
    </>
  );
}
