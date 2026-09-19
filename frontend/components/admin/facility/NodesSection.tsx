"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { DataTable, type DataTableColumn, type DataTableExtraAction } from "@/components/admin/DataTable";
import { RecordFormSheet, type FieldConfig, type FormValues } from "@/components/admin/RecordFormSheet";
import { NODE_TYPES, nodesApi, type Building, type FacilityNode, type Floor, type NodeType } from "@/lib/api/facility";
import { bool, num, optionalStr, str } from "@/lib/admin-form-utils";
import type { AppLocale } from "@/i18n/locales";
import { EyeIcon, XIcon } from "@/components/icons";

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
  const locale = useLocale() as AppLocale;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FacilityNode | null>(null);
  const [qrNode, setQrNode] = useState<FacilityNode | null>(null);

  const nodeTypeLabel = (type: NodeType) => t(`nodeType.${type}` as const);

  function floorLabel(floorId: number, currentLocale: AppLocale = locale): string {
    const floor = floors.find((f) => f.id === floorId);
    if (!floor) return `#${floorId}`;
    const building = buildings.find((b) => b.id === floor.building);
    const floorName = currentLocale === "th" ? floor.name_th : floor.name_en;
    const buildingCode = building ? building.code : "?";
    return `${buildingCode} · ${floorName} (L${floor.level_no})`;
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

  function openQrModal(row: FacilityNode) {
    setQrNode(row);
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

  const extraActions: DataTableExtraAction<FacilityNode>[] = [
    {
      key: "view-qr",
      label: t("viewNodeQrCta"),
      icon: <EyeIcon width={14} height={14} />,
      onClick: openQrModal,
      disabled: (row) => !row.location_qr_code,
    },
  ];

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
        extraActions={extraActions}
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
      {qrNode && (
        <NodeQrModal
          node={qrNode}
          floorLabel={floorLabel(qrNode.floor)}
          onClose={() => setQrNode(null)}
        />
      )}
    </>
  );
}

function NodeQrModal({
  node,
  floorLabel,
  onClose,
}: {
  node: FacilityNode;
  floorLabel: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const locale = useLocale() as AppLocale;
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const nodeName = locale === "th" ? node.name_th : node.name_en;
  const nodeType = t(`nodeType.${node.node_type}` as const);

  useEffect(() => {
    // Skip the QR generation entirely when there's no code to encode — the
    // render branch shows the empty state directly, so no setState in here.
    if (!node.location_qr_code) return;
    let cancelled = false;
    QRCode.toDataURL(node.location_qr_code, { width: 260, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [node.location_qr_code]);

  async function handleCopy() {
    if (!node.location_qr_code) return;
    try {
      await navigator.clipboard.writeText(node.location_qr_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard might be blocked; the text is also visible below
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("nodeQrModalTitle")}
    >
      <div className="flex w-full max-w-[420px] flex-col gap-4 rounded-[20px] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
              {nodeType}
            </div>
            <div className="mt-0.5 text-[16px] font-bold text-[var(--ink)]">{nodeName}</div>
            <div className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{floorLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("nodeQrCloseCta")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-app)]"
          >
            <XIcon width={16} height={16} stroke="var(--ink-muted)" />
          </button>
        </div>

        {node.location_qr_code ? (
          <>
            <div className="flex items-center justify-center rounded-2xl bg-[var(--surface-app)] p-4">
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL generated client-side; next/image can't optimize this
                <img
                  src={dataUrl}
                  alt={t("nodeQrModalTitle")}
                  width={260}
                  height={260}
                  className="h-[260px] w-[260px]"
                />
              ) : (
                <div className="flex h-[260px] w-[260px] items-center justify-center text-[12.5px] text-[var(--ink-muted)]">
                  {t("loading")}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-app)] px-3 py-2">
              <code className="flex-1 truncate font-mono text-[12.5px] text-[var(--ink)]">{node.location_qr_code}</code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-[var(--brand-ink)] px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                {copied ? t("nodeQrCopiedHint") : t("nodeQrCopyCodeCta")}
              </button>
            </div>

            <div className="text-center text-[11.5px] text-[var(--ink-muted)]">{t("nodeQrPrintHint")}</div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-app)] px-4 py-8 text-center text-[12.5px] text-[var(--ink-muted)]">
            <div className="font-semibold text-[var(--ink)]">{t("nodeQrModalEmptyTitle")}</div>
            <div>{t("nodeQrModalEmptyBody")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
