"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DashboardPlaceholderIcon, EditIcon, PlusIcon, TrashIcon } from "@/components/icons";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

export type DataTableExtraAction<T> = {
  /** Stable id used as the React key. */
  key: string;
  /** `aria-label` for the icon button — important for screen readers since the
   *  button is icon-only. */
  label: string;
  icon: ReactNode;
  onClick: (row: T) => void;
  /** Optional — if it returns true the button is hidden for that row. */
  hidden?: (row: T) => boolean;
  /** Optional — if it returns true the button renders as disabled. */
  disabled?: (row: T) => boolean;
  /** Optional tooltip text; falls back to `label`. */
  title?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  /** Optional filter controls (dropdowns/search) rendered on the same row as
   *  the "add" button, to its left. */
  filters?: ReactNode;
  addLabel: string;
  onAdd: () => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => Promise<void> | void;
  emptyTitle: string;
  emptyDescription: string;
  /**
   * Optional resource-specific actions rendered at the front of the per-row
   * actions column (leftmost), before the default edit/delete buttons. Kept
   * here rather than on each resource section so the icon-only styling stays
   * consistent across the admin.
   */
  extraActions?: DataTableExtraAction<T>[];
};

/**
 * Reusable list view for a single Admin master-data resource: columns you
 * configure, an "add" button, per-row edit/delete, loading + empty states.
 * Delete uses a simple two-click inline confirm (click once to arm, click
 * again to confirm) rather than a native confirm() dialog or a modal.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  filters,
  addLabel,
  onAdd,
  onEdit,
  onDelete,
  emptyTitle,
  emptyDescription,
  extraActions,
}: DataTableProps<T>) {
  const t = useTranslations("admin");
  const [confirmingKey, setConfirmingKey] = useState<string | number | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | number | null>(null);

  async function handleDeleteClick(row: T) {
    const key = rowKey(row);
    if (confirmingKey !== key) {
      setConfirmingKey(key);
      return;
    }
    setConfirmingKey(null);
    setDeletingKey(key);
    try {
      await onDelete(row);
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">{filters}</div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--brand-ink)] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon width={15} height={15} />
          {addLabel}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
          <div className="text-[12.5px]">{t("loading")}</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
          <DashboardPlaceholderIcon width={26} height={26} strokeWidth={1.6} className="text-[#b7cbc7]" />
          <div className="text-[14px] font-semibold">{emptyTitle}</div>
          <div className="text-[12.5px]">{emptyDescription}</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                {columns.map((column) => (
                  <th key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold">
                    {column.header}
                  </th>
                ))}
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row);
                const isConfirming = confirmingKey === key;
                const isDeleting = deletingKey === key;
                const visibleExtras = extraActions?.filter((action) => !action.hidden?.(row)) ?? [];
                return (
                  <tr key={key} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-app)]">
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3 align-top">
                        {column.render(row)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex justify-end gap-1.5">
                        {visibleExtras.map((action) => {
                          const isDisabled = action.disabled?.(row) ?? false;
                          return (
                            <button
                              key={action.key}
                              type="button"
                              onClick={() => action.onClick(row)}
                              disabled={isDisabled}
                              aria-label={action.label}
                              title={action.title ?? action.label}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-app)] disabled:opacity-40"
                            >
                              {action.icon}
                            </button>
                          );
                        })}
                        {isConfirming && (
                          <button
                            type="button"
                            onClick={() => setConfirmingKey(null)}
                            className="rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-app)]"
                          >
                            {t("cancel")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(row)}
                          disabled={isDeleting}
                          aria-label={isConfirming ? t("confirmDelete") : t("delete")}
                          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-60 ${
                            isConfirming
                              ? "bg-red-600 text-white hover:bg-red-700"
                              : "text-red-600 hover:bg-red-50"
                          }`}
                        >
                          {isConfirming ? (
                            t("confirmDelete")
                          ) : (
                            <TrashIcon width={14} height={14} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          aria-label={t("edit")}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-app)]"
                        >
                          <EditIcon width={14} height={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
