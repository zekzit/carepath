"use client";

import { SearchIcon } from "@/components/icons";

/** Small text-search box shared by Admin list filter bars — icon + input,
 *  styled to match the filter dropdowns next to it. */
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-1.5 focus-within:border-[var(--brand-teal)]">
      <SearchIcon width={14} height={14} stroke="var(--ink-muted)" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-[180px] bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
      />
    </label>
  );
}
