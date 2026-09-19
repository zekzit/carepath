"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { staffUsersApi, type StaffUser } from "@/lib/api/accounts";
import { ALL_STAFF_ROLES, ROLE_META } from "@/lib/roles";
import { bool, str } from "@/lib/admin-form-utils";

function staffUserToFormValues(user: StaffUser): FormValues {
  return {
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    password: "",
  };
}

export function StaffUsersSection({
  staffUsers,
  loading,
  refetch,
}: {
  staffUsers: StaffUser[];
  loading: boolean;
  refetch: () => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);

  const isEditing = editing !== null;

  const fields: FieldConfig[] = [
    { name: "username", label: t("colUsername"), type: "text", required: true },
    { name: "first_name", label: t("colFirstName"), type: "text" },
    { name: "last_name", label: t("colLastName"), type: "text" },
    { name: "email", label: t("colEmail"), type: "email" },
    {
      name: "role",
      label: t("colRole"),
      type: "select",
      required: true,
      options: ALL_STAFF_ROLES.map((role) => ({ value: role, label: `${ROLE_META[role].labelTh} / ${ROLE_META[role].labelEn}` })),
    },
    { name: "is_active", label: t("colIsActive"), type: "checkbox" },
    {
      name: "password",
      label: t("colPassword"),
      type: "password",
      required: !isEditing,
      helpText: isEditing ? t("passwordEditHelp") : t("passwordCreateHelp"),
    },
  ];

  const columns: DataTableColumn<StaffUser>[] = [
    { key: "username", header: t("colUsername"), render: (row) => row.username },
    { key: "full_name", header: t("colFullName"), render: (row) => `${row.first_name} ${row.last_name}`.trim() || "—" },
    { key: "email", header: t("colEmail"), render: (row) => row.email || "—" },
    {
      key: "role",
      header: t("colRole"),
      render: (row) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
          style={{ background: `color-mix(in srgb, ${ROLE_META[row.role].colorVar} 18%, white)` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: ROLE_META[row.role].colorVar }} />
          {ROLE_META[row.role].labelTh}
        </span>
      ),
    },
    { key: "is_active", header: t("colIsActive"), render: (row) => (row.is_active ? t("active") : t("inactive")) },
  ];

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: StaffUser) {
    setEditing(row);
    setSheetOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    const payload = {
      username: str(values.username),
      first_name: str(values.first_name),
      last_name: str(values.last_name),
      email: str(values.email),
      role: str(values.role) as StaffUser["role"],
      is_active: bool(values.is_active),
      // Blank on edit keeps the current password (backend only requires it on create).
      password: str(values.password),
    };
    if (editing) {
      await staffUsersApi.update(editing.id, payload);
    } else {
      await staffUsersApi.create(payload);
    }
    setSheetOpen(false);
    await refetch();
  }

  async function handleDelete(row: StaffUser) {
    await staffUsersApi.remove(row.id);
    await refetch();
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={staffUsers}
        rowKey={(row) => row.id}
        loading={loading}
        addLabel={t("addStaffUser")}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        emptyTitle={t("staffUsersEmptyTitle")}
        emptyDescription={t("staffUsersEmptyDescription")}
      />
      {sheetOpen && (
        <RecordFormSheet
        title={editing ? t("editStaffUser") : t("addStaffUser")}
        fields={fields}
        initialValues={editing ? staffUserToFormValues(editing) : { is_active: true }}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        />
      )}
    </>
  );
}
