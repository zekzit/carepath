"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { SearchInput } from "@/components/admin/SearchInput";
import { pathwayTemplatesApi, type CareCategory, type PathwayTemplate } from "@/lib/api/pathway";
import { bool, id, str } from "@/lib/admin-form-utils";

function templateToFormValues(template: PathwayTemplate): FormValues {
  return {
    care_category: String(template.care_category),
    name_th: template.name_th,
    name_en: template.name_en,
    is_active: template.is_active,
  };
}

export function PathwayTemplatesSection({
  pathwayTemplates,
  careCategories,
  loading,
  refetch,
}: {
  pathwayTemplates: PathwayTemplate[];
  careCategories: CareCategory[];
  loading: boolean;
  refetch: () => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<PathwayTemplate | null>(null);
  const [careCategoryFilter, setCareCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [search, setSearch] = useState("");

  function careCategoryLabel(categoryId: number): string {
    const category = careCategories.find((c) => c.id === categoryId);
    return category ? category.name_th : `#${categoryId}`;
  }

  const needle = search.trim().toLowerCase();
  const visibleTemplates = pathwayTemplates.filter((template) => {
    if (careCategoryFilter && String(template.care_category) !== careCategoryFilter) return false;
    if (statusFilter === "active" && !template.is_active) return false;
    if (statusFilter === "inactive" && template.is_active) return false;
    if (needle && !`${template.name_th} ${template.name_en}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  const fields: FieldConfig[] = [
    {
      name: "care_category",
      label: t("colCareCategory"),
      type: "select",
      required: true,
      options: careCategories.map((c) => ({ value: String(c.id), label: c.name_th })),
    },
    { name: "name_th", label: t("colNameTh"), type: "text", required: true },
    { name: "name_en", label: t("colNameEn"), type: "text", required: true },
    { name: "is_active", label: t("colIsActive"), type: "checkbox" },
  ];

  const columns: DataTableColumn<PathwayTemplate>[] = [
    { key: "care_category", header: t("colCareCategory"), render: (row) => careCategoryLabel(row.care_category) },
    { key: "name_th", header: t("colNameTh"), render: (row) => row.name_th },
    { key: "name_en", header: t("colNameEn"), render: (row) => row.name_en },
    { key: "is_active", header: t("colIsActive"), render: (row) => (row.is_active ? t("active") : t("inactive")) },
  ];

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: PathwayTemplate) {
    setEditing(row);
    setSheetOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    const payload = {
      care_category: id(values.care_category),
      name_th: str(values.name_th),
      name_en: str(values.name_en),
      is_active: bool(values.is_active),
    };
    if (editing) {
      await pathwayTemplatesApi.update(editing.id, payload);
    } else {
      await pathwayTemplatesApi.create(payload);
    }
    setSheetOpen(false);
    await refetch();
  }

  async function handleDelete(row: PathwayTemplate) {
    await pathwayTemplatesApi.remove(row.id);
    await refetch();
  }

  const filters = (
    <>
      <select
        value={careCategoryFilter}
        onChange={(event) => setCareCategoryFilter(event.target.value)}
        className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--brand-teal)]"
      >
        <option value="">{t("filterAllOption")}</option>
        {careCategories.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name_th}
          </option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value as "" | "active" | "inactive")}
        className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--brand-teal)]"
      >
        <option value="">{t("filterAllOption")}</option>
        <option value="active">{t("active")}</option>
        <option value="inactive">{t("inactive")}</option>
      </select>
      <SearchInput value={search} onChange={setSearch} placeholder={t("pathwayTemplatesSearchPlaceholder")} />
    </>
  );

  return (
    <>
      <DataTable
        columns={columns}
        rows={visibleTemplates}
        rowKey={(row) => row.id}
        loading={loading}
        filters={filters}
        addLabel={t("addPathwayTemplate")}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        emptyTitle={t("pathwayTemplatesEmptyTitle")}
        emptyDescription={t("pathwayTemplatesEmptyDescription")}
      />
      {sheetOpen && (
        <RecordFormSheet
        title={editing ? t("editPathwayTemplate") : t("addPathwayTemplate")}
        fields={fields}
        initialValues={editing ? templateToFormValues(editing) : { is_active: true }}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        />
      )}
    </>
  );
}
