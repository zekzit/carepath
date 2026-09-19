/**
 * Small, dependency-free helpers for turning raw `RecordFormSheet` field
 * values (always strings/booleans/string-arrays, since they come straight
 * out of HTML form controls) into the properly-typed JSON payload each
 * backend serializer expects, and back again when seeding the form from an
 * existing record for editing.
 */

export function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v === null || v === undefined) return "";
  return String(v);
}

/** For optional CharFields that are `unique=True, null=True` (blank must become null, not ""). */
export function optionalStr(v: unknown): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

export function num(v: unknown): number {
  return Number(str(v));
}

/** For optional FloatFields (blank must become null, not ""). */
export function optionalNum(v: unknown): number | null {
  const s = str(v);
  if (s === "") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

export function int(v: unknown): number {
  return parseInt(str(v), 10);
}

export function bool(v: unknown): boolean {
  return Boolean(v);
}

export function id(v: unknown): number {
  return Number(str(v));
}

export function idOrNull(v: unknown): number | null {
  const s = str(v);
  return s === "" ? null : Number(s);
}

export function idArray(v: unknown): number[] {
  return Array.isArray(v) ? v.map((x) => Number(x)) : [];
}

export function idArrayToStrings(v: number[] | undefined): string[] {
  return (v ?? []).map((x) => String(x));
}

/** <input type="time"> gives "HH:MM" — the backend TimeField wants "HH:MM:SS". */
export function timeToApi(v: unknown): string {
  const s = str(v);
  return s.length === 5 ? `${s}:00` : s;
}

/** Backend TimeField comes back as "HH:MM:SS" — <input type="time"> wants "HH:MM". */
export function timeFromApi(v: string | null | undefined): string {
  return v ? v.slice(0, 5) : "";
}
