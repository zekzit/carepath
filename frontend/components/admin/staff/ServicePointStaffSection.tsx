"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { servicePointStaffApi, type ServicePointStaff, type StaffUser } from "@/lib/api/accounts";
import type { FacilityNode } from "@/lib/api/facility";
import { id } from "@/lib/admin-form-utils";

function assignmentToFormValues(assignment: ServicePointStaff): FormValues {
  return {
    staff_user: String(assignment.staff_user),
    service_point: String(assignment.service_point),
  };
}

export function ServicePointStaffSection({
  assignments,
  staffUsers,
  servicePointNodes,
  loading,
  refetch,
}: {
  assignments: ServicePointStaff[];
  staffUsers: StaffUser[];
  servicePointNodes: FacilityNode[];
  loading: boolean;
  refetch: () => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ServicePointStaff | null>(null);

  function staffLabel(staffId: number): string {
    const staff = staffUsers.find((s) => s.id === staffId);
    return staff ? staff.username : `#${staffId}`;
  }

  function servicePointLabel(nodeId: number): string {
    const node = servicePointNodes.find((n) => n.id === nodeId);
    return node ? node.name_th : `#${nodeId}`;
  }

  const fields: FieldConfig[] = [
    {
      name: "staff_user",
      label: t("colStaffUser"),
      type: "select",
      required: true,
      options: staffUsers.map((s) => ({ value: String(s.id), label: s.username })),
    },
    {
      name: "service_point",
      label: t("colServicePoint"),
      type: "select",
      required: true,
      options: servicePointNodes.map((n) => ({ value: String(n.id), label: n.name_th })),
    },
  ];

  const columns: DataTableColumn<ServicePointStaff>[] = [
    { key: "staff_user", header: t("colStaffUser"), render: (row) => staffLabel(row.staff_user) },
    { key: "service_point", header: t("colServicePoint"), render: (row) => servicePointLabel(row.service_point) },
  ];

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: ServicePointStaff) {
    setEditing(row);
    setSheetOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    const payload = { staff_user: id(values.staff_user), service_point: id(values.service_point) };
    if (editing) {
      await servicePointStaffApi.update(editing.id, payload);
    } else {
      await servicePointStaffApi.create(payload);
    }
    setSheetOpen(false);
    await refetch();
  }

  async function handleDelete(row: ServicePointStaff) {
    await servicePointStaffApi.remove(row.id);
    await refetch();
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={assignments}
        rowKey={(row) => row.id}
        loading={loading}
        addLabel={t("addServicePointStaff")}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        emptyTitle={t("servicePointStaffEmptyTitle")}
        emptyDescription={t("servicePointStaffEmptyDescription")}
      />
      {sheetOpen && (
        <RecordFormSheet
        title={editing ? t("editServicePointStaff") : t("addServicePointStaff")}
        fields={fields}
        initialValues={editing ? assignmentToFormValues(editing) : undefined}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        />
      )}
    </>
  );
}
