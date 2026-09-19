"use client";

export type AdminTab = { id: string; label: string };

/** Small tab bar shared by the /admin/facility and /admin/pathways pages (each manages several related resources). */
export function AdminTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: AdminTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-[var(--border-subtle)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-[13px] font-medium transition-colors ${
            active === tab.id
              ? "border-b-2 border-[var(--brand-teal)] text-[var(--ink)]"
              : "border-b-2 border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
