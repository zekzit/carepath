"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { DAYS_OF_WEEK, serviceSchedulesApi, type ServiceSchedule } from "@/lib/api/queues";
import { nodesApi, type FacilityNode } from "@/lib/api/facility";
import { id, int, timeFromApi, timeToApi } from "@/lib/admin-form-utils";

function scheduleToFormValues(schedule: ServiceSchedule): FormValues {
  return {
    service_point: String(schedule.service_point),
    day_of_week: String(schedule.day_of_week),
    open_time: timeFromApi(schedule.open_time),
    close_time: timeFromApi(schedule.close_time),
  };
}

async function fetchScheduleData() {
  const [schedules, nodes] = await Promise.all([serviceSchedulesApi.list(), nodesApi.list()]);
  return { schedules, nodes };
}

export function ScheduleAdminPage() {
  const t = useTranslations("admin");
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [nodes, setNodes] = useState<FacilityNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceSchedule | null>(null);

  async function refetchAll() {
    setLoading(true);
    try {
      const data = await fetchScheduleData();
      setSchedules(data.schedules);
      setNodes(data.nodes);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchScheduleData();
        if (cancelled) return;
        setSchedules(data.schedules);
        setNodes(data.nodes);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const servicePointNodes = nodes.filter((n) => n.node_type === "SERVICE_POINT");

  function servicePointLabel(nodeId: number): string {
    const node = servicePointNodes.find((n) => n.id === nodeId);
    return node ? node.name_th : `#${nodeId}`;
  }

  const dayLabel = (day: number) => t(`dayOfWeek.${day}` as const);

  const fields: FieldConfig[] = [
    {
      name: "service_point",
      label: t("colServicePoint"),
      type: "select",
      required: true,
      options: servicePointNodes.map((n) => ({ value: String(n.id), label: n.name_th })),
    },
    {
      name: "day_of_week",
      label: t("colDayOfWeek"),
      type: "select",
      required: true,
      options: DAYS_OF_WEEK.map((day) => ({ value: String(day), label: dayLabel(day) })),
    },
    { name: "open_time", label: t("colOpenTime"), type: "time", required: true },
    { name: "close_time", label: t("colCloseTime"), type: "time", required: true },
  ];

  const columns: DataTableColumn<ServiceSchedule>[] = [
    { key: "service_point", header: t("colServicePoint"), render: (row) => servicePointLabel(row.service_point) },
    { key: "day_of_week", header: t("colDayOfWeek"), render: (row) => dayLabel(row.day_of_week) },
    { key: "open_time", header: t("colOpenTime"), render: (row) => timeFromApi(row.open_time) },
    { key: "close_time", header: t("colCloseTime"), render: (row) => timeFromApi(row.close_time) },
  ];

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: ServiceSchedule) {
    setEditing(row);
    setSheetOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    const payload = {
      service_point: id(values.service_point),
      day_of_week: int(values.day_of_week),
      open_time: timeToApi(values.open_time),
      close_time: timeToApi(values.close_time),
    };
    if (editing) {
      await serviceSchedulesApi.update(editing.id, payload);
    } else {
      await serviceSchedulesApi.create(payload);
    }
    setSheetOpen(false);
    await refetchAll();
  }

  async function handleDelete(row: ServiceSchedule) {
    await serviceSchedulesApi.remove(row.id);
    await refetchAll();
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <DataTable
        columns={columns}
        rows={schedules}
        rowKey={(row) => row.id}
        loading={loading}
        addLabel={t("addServiceSchedule")}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        emptyTitle={t("serviceSchedulesEmptyTitle")}
        emptyDescription={t("serviceSchedulesEmptyDescription")}
      />
      {sheetOpen && (
        <RecordFormSheet
        title={editing ? t("editServiceSchedule") : t("addServiceSchedule")}
        fields={fields}
        initialValues={editing ? scheduleToFormValues(editing) : undefined}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        />
      )}
    </div>
  );
}
