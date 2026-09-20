"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { templateStepsApi, type PathwayTemplate, type TemplateStep } from "@/lib/api/pathway";
import type { FacilityNode } from "@/lib/api/facility";
import { id, idArray, idArrayToStrings, int } from "@/lib/admin-form-utils";

function stepToFormValues(step: TemplateStep): FormValues {
  return {
    pathway_template: String(step.pathway_template),
    service_point: String(step.service_point),
    sequence_order: String(step.sequence_order),
    prerequisite_steps: idArrayToStrings(step.prerequisite_steps),
  };
}

export function TemplateStepsSection({
  pathwayTemplates,
  servicePointNodes,
}: {
  pathwayTemplates: PathwayTemplate[];
  servicePointNodes: FacilityNode[];
}) {
  const t = useTranslations("admin");
  const [steps, setSteps] = useState<TemplateStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateStep | null>(null);
  const [templateFilter, setTemplateFilter] = useState("");

  const visibleSteps = templateFilter
    ? steps.filter((s) => String(s.pathway_template) === templateFilter)
    : steps;

  async function refetch() {
    setLoading(true);
    try {
      setSteps(await templateStepsApi.list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await templateStepsApi.list();
        if (cancelled) return;
        setSteps(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function templateLabel(templateId: number): string {
    const template = pathwayTemplates.find((p) => p.id === templateId);
    return template ? template.name_th : `#${templateId}`;
  }

  function servicePointLabel(nodeId: number): string {
    const node = servicePointNodes.find((n) => n.id === nodeId);
    return node ? node.name_th : `#${nodeId}`;
  }

  function stepLabel(step: TemplateStep): string {
    return `#${step.sequence_order} · ${servicePointLabel(step.service_point)}`;
  }

  const fields: FieldConfig[] = [
    {
      name: "pathway_template",
      label: t("colPathwayTemplate"),
      type: "select",
      required: true,
      options: pathwayTemplates.map((p) => ({ value: String(p.id), label: p.name_th })),
    },
    {
      name: "service_point",
      label: t("colServicePoint"),
      type: "select",
      required: true,
      options: servicePointNodes.map((n) => ({ value: String(n.id), label: n.name_th })),
    },
    {
      name: "sequence_order",
      label: t("colSequenceOrder"),
      type: "integer",
      required: true,
      helpText: t("sequenceOrderHelp"),
    },
    {
      name: "prerequisite_steps",
      label: t("colPrerequisites"),
      type: "multiselect",
      helpText: t("prerequisiteStepsHelp"),
      // Only offer steps belonging to the currently-selected pathway_template
      // (the backend 400s on cross-template prerequisites) and never the
      // step being edited itself.
      getOptions: (values) =>
        steps
          .filter((s) => String(s.pathway_template) === values.pathway_template && s.id !== editing?.id)
          .map((s) => ({ value: String(s.id), label: stepLabel(s) })),
    },
  ];

  const columns: DataTableColumn<TemplateStep>[] = [
    { key: "pathway_template", header: t("colPathwayTemplate"), render: (row) => templateLabel(row.pathway_template) },
    { key: "service_point", header: t("colServicePoint"), render: (row) => servicePointLabel(row.service_point) },
    { key: "sequence_order", header: t("colSequenceOrder"), render: (row) => row.sequence_order },
    {
      key: "prerequisite_steps",
      header: t("colPrerequisites"),
      render: (row) =>
        row.prerequisite_steps.length === 0
          ? "—"
          : row.prerequisite_steps
              .map((prereqId) => {
                const prereq = steps.find((s) => s.id === prereqId);
                return prereq ? stepLabel(prereq) : `#${prereqId}`;
              })
              .join(", "),
    },
  ];

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: TemplateStep) {
    setEditing(row);
    setSheetOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    const payload = {
      pathway_template: id(values.pathway_template),
      service_point: id(values.service_point),
      sequence_order: int(values.sequence_order),
      prerequisite_steps: idArray(values.prerequisite_steps),
    };
    if (editing) {
      await templateStepsApi.update(editing.id, payload);
    } else {
      await templateStepsApi.create(payload);
    }
    setSheetOpen(false);
    await refetch();
  }

  async function handleDelete(row: TemplateStep) {
    await templateStepsApi.remove(row.id);
    await refetch();
  }

  const filters = (
    <select
      value={templateFilter}
      onChange={(event) => setTemplateFilter(event.target.value)}
      className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--brand-teal)]"
    >
      <option value="">{t("filterAllOption")}</option>
      {pathwayTemplates.map((p) => (
        <option key={p.id} value={String(p.id)}>
          {p.name_th}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <DataTable
        columns={columns}
        rows={visibleSteps}
        rowKey={(row) => row.id}
        loading={loading}
        filters={filters}
        addLabel={t("addTemplateStep")}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        emptyTitle={t("templateStepsEmptyTitle")}
        emptyDescription={t("templateStepsEmptyDescription")}
      />
      {sheetOpen && (
        <RecordFormSheet
        title={editing ? t("editTemplateStep") : t("addTemplateStep")}
        fields={fields}
        initialValues={editing ? stepToFormValues(editing) : undefined}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        />
      )}
    </>
  );
}
