"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { careCategoriesApi, type CareCategory } from "@/lib/api/pathway";
import { str } from "@/lib/admin-form-utils";

export function CareCategoriesSection({
  careCategories,
  loading,
  refetch,
}: {
  careCategories: CareCategory[];
  loading: boolean;
  refetch: () => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CareCategory | null>(null);

  const fields: FieldConfig[] = [
    { name: "name_th", label: t("colNameTh"), type: "text", required: true },
    { name: "name_en", label: t("colNameEn"), type: "text", required: true },
  ];

  const columns: DataTableColumn<CareCategory>[] = [
    { key: "name_th", header: t("colNameTh"), render: (row) => row.name_th },
    { key: "name_en", header: t("colNameEn"), render: (row) => row.name_en },
  ];

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: CareCategory) {
    setEditing(row);
    setSheetOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    const payload = { name_th: str(values.name_th), name_en: str(values.name_en) };
    if (editing) {
      await careCategoriesApi.update(editing.id, payload);
    } else {
      await careCategoriesApi.create(payload);
    }
    setSheetOpen(false);
    await refetch();
  }

  async function handleDelete(row: CareCategory) {
    await careCategoriesApi.remove(row.id);
    await refetch();
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={careCategories}
        rowKey={(row) => row.id}
        loading={loading}
        addLabel={t("addCareCategory")}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        emptyTitle={t("careCategoriesEmptyTitle")}
        emptyDescription={t("careCategoriesEmptyDescription")}
      />
      {sheetOpen && (
        <RecordFormSheet
        title={editing ? t("editCareCategory") : t("addCareCategory")}
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
