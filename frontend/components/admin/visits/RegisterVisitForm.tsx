"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/client";
import { XIcon } from "@/components/icons";
import {
  patientsApi,
  searchPatientsByHn,
  visitsApi,
  type Patient,
  type PatientInput,
  type PreferredLanguage,
  type Visit,
} from "@/lib/api/visits";
import type { PathwayTemplate } from "@/lib/api/pathway";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type NewPatientForm = {
  hn_code: string;
  full_name: string;
  dob: string;
  national_id: string;
  phone: string;
  preferred_language: PreferredLanguage;
};

function emptyNewPatientForm(hnSeed: string): NewPatientForm {
  return { hn_code: hnSeed, full_name: "", dob: "", national_id: "", phone: "", preferred_language: "th" };
}

function fieldErrorsFromApiError(err: unknown, fallbackMessage: string): Record<string, string[]> {
  if (err instanceof ApiError && err.body && typeof err.body === "object") {
    const body = err.body as Record<string, unknown>;
    const errors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(body)) {
      errors[key] = Array.isArray(value) ? value.map(String) : [String(value)];
    }
    return errors;
  }
  return { non_field_errors: [fallbackMessage] };
}

/**
 * Bespoke registration flow, not RecordFormSheet: it's a two-stage wizard
 * (find-or-create Patient, then pick PathwayTemplate + visit details) with a
 * live search-as-you-type box, which doesn't fit RecordFormSheet's flat
 * FieldConfig[] shape.
 */
export function RegisterVisitForm({
  pathwayTemplates,
  onClose,
  onRegistered,
}: {
  pathwayTemplates: PathwayTemplate[];
  onClose: () => void;
  onRegistered: (visit: Visit) => void | Promise<void>;
}) {
  const t = useTranslations("admin");

  const [hnQuery, setHnQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [creatingNew, setCreatingNew] = useState(false);
  const [newPatient, setNewPatient] = useState<NewPatientForm>(emptyNewPatientForm(""));
  const [newPatientErrors, setNewPatientErrors] = useState<Record<string, string[]>>({});
  const [creatingPatientBusy, setCreatingPatientBusy] = useState(false);

  const [pathwayTemplateId, setPathwayTemplateId] = useState("");
  const [visitDate, setVisitDate] = useState(todayStr());
  const [usesWheelchair, setUsesWheelchair] = useState(false);
  const [visitError, setVisitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedPatient) return;
    const query = hnQuery.trim();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Debounced live search: wrapped in a single async IIFE (rather than
    // calling setState directly in the effect body) so the query-cleared
    // case and the actual fetch both update state from within an async
    // callback, not synchronously during the effect's render pass.
    (async () => {
      if (query.length === 0) {
        setSearchResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      await new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 300);
      });
      if (cancelled) return;
      try {
        const results = await searchPatientsByHn(query);
        if (!cancelled) setSearchResults(results);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hnQuery, selectedPatient]);

  function selectPatient(patient: Patient) {
    setSelectedPatient(patient);
    setSearchResults([]);
    setCreatingNew(false);
  }

  function changePatient() {
    setSelectedPatient(null);
    setHnQuery("");
    setVisitError(null);
  }

  function openCreatePatient() {
    setNewPatient(emptyNewPatientForm(hnQuery.trim()));
    setNewPatientErrors({});
    setCreatingNew(true);
  }

  async function submitNewPatient(event: FormEvent) {
    event.preventDefault();
    const missing: Record<string, string[]> = {};
    if (!newPatient.hn_code.trim()) missing.hn_code = [t("fieldRequired")];
    if (!newPatient.full_name.trim()) missing.full_name = [t("fieldRequired")];
    if (!newPatient.dob) missing.dob = [t("fieldRequired")];
    if (Object.keys(missing).length > 0) {
      setNewPatientErrors(missing);
      return;
    }

    setNewPatientErrors({});
    setCreatingPatientBusy(true);
    try {
      const payload: PatientInput = {
        hn_code: newPatient.hn_code.trim(),
        full_name: newPatient.full_name.trim(),
        dob: newPatient.dob,
        national_id: newPatient.national_id.trim(),
        phone: newPatient.phone.trim(),
        preferred_language: newPatient.preferred_language,
      };
      const created = await patientsApi.create(payload);
      selectPatient(created);
    } catch (err) {
      setNewPatientErrors(fieldErrorsFromApiError(err, t("formGenericError")));
    } finally {
      setCreatingPatientBusy(false);
    }
  }

  async function handleSubmitVisit(event: FormEvent) {
    event.preventDefault();
    setVisitError(null);
    if (!selectedPatient || !pathwayTemplateId || !visitDate) {
      setVisitError(t("fieldRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const visit = await visitsApi.create({
        patient: selectedPatient.id,
        pathway_template: Number(pathwayTemplateId),
        visit_date: visitDate,
        uses_wheelchair: usesWheelchair,
      });
      await onRegistered(visit);
    } catch (err) {
      const errors = fieldErrorsFromApiError(err, t("formGenericError"));
      setVisitError(Object.values(errors).flat().join(" "));
    } finally {
      setSubmitting(false);
    }
  }

  const activeTemplates = pathwayTemplates.filter((tpl) => tpl.is_active);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-[var(--surface-card)] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="text-[15px] font-semibold text-[var(--ink)]">{t("registerVisit")}</div>
          <button type="button" onClick={onClose} aria-label={t("cancel")} className="text-[var(--ink-muted)]">
            <XIcon width={18} height={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-2">
            <div className="text-[12.5px] font-semibold text-[var(--ink)]">{t("registerStepPatient")}</div>

            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-app)] px-3 py-2.5">
                <div>
                  <div className="text-[13px] font-medium text-[var(--ink)]">{selectedPatient.full_name}</div>
                  <div className="text-[11.5px] text-[var(--ink-faint)]">HN {selectedPatient.hn_code}</div>
                </div>
                <button
                  type="button"
                  onClick={changePatient}
                  className="text-[12px] font-medium text-[var(--brand-teal)]"
                >
                  {t("changePatient")}
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={hnQuery}
                  onChange={(event) => setHnQuery(event.target.value)}
                  placeholder={t("searchByHnPlaceholder")}
                  className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                />
                {searching && <div className="text-[11.5px] text-[var(--ink-faint)]">{t("loading")}</div>}
                {!searching && hnQuery.trim() && searchResults.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-lg border border-[var(--border-subtle)] p-1.5">
                    {searchResults.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => selectPatient(patient)}
                        className="flex flex-col rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--surface-app)]"
                      >
                        <span className="text-[13px] font-medium text-[var(--ink)]">{patient.full_name}</span>
                        <span className="text-[11.5px] text-[var(--ink-faint)]">HN {patient.hn_code}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!searching && hnQuery.trim() && searchResults.length === 0 && (
                  <div className="text-[12px] text-[var(--ink-faint)]">{t("noPatientFound")}</div>
                )}

                {!creatingNew ? (
                  <button
                    type="button"
                    onClick={openCreatePatient}
                    className="self-start text-[12px] font-medium text-[var(--brand-teal)]"
                  >
                    {t("createNewPatient")}
                  </button>
                ) : (
                  <form
                    onSubmit={submitNewPatient}
                    className="flex flex-col gap-2 rounded-lg border border-[var(--border-subtle)] p-3"
                  >
                    <div className="text-[12px] font-semibold text-[var(--ink)]">{t("createNewPatient")}</div>
                    {newPatientErrors.non_field_errors?.map((message, index) => (
                      <div key={index} className="text-[11.5px] text-red-600">
                        {message}
                      </div>
                    ))}
                    <FieldGroup label={t("colHnCode")} required error={newPatientErrors.hn_code}>
                      <input
                        type="text"
                        value={newPatient.hn_code}
                        onChange={(event) => setNewPatient((prev) => ({ ...prev, hn_code: event.target.value }))}
                        className="w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                      />
                    </FieldGroup>
                    <FieldGroup label={t("colFullName")} required error={newPatientErrors.full_name}>
                      <input
                        type="text"
                        value={newPatient.full_name}
                        onChange={(event) => setNewPatient((prev) => ({ ...prev, full_name: event.target.value }))}
                        className="w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                      />
                    </FieldGroup>
                    <FieldGroup label={t("colDob")} required error={newPatientErrors.dob}>
                      <input
                        type="date"
                        value={newPatient.dob}
                        onChange={(event) => setNewPatient((prev) => ({ ...prev, dob: event.target.value }))}
                        className="w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                      />
                    </FieldGroup>
                    <FieldGroup label={t("colNationalId")} error={newPatientErrors.national_id}>
                      <input
                        type="text"
                        value={newPatient.national_id}
                        onChange={(event) => setNewPatient((prev) => ({ ...prev, national_id: event.target.value }))}
                        className="w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                      />
                    </FieldGroup>
                    <FieldGroup label={t("colPhone")} error={newPatientErrors.phone}>
                      <input
                        type="text"
                        value={newPatient.phone}
                        onChange={(event) => setNewPatient((prev) => ({ ...prev, phone: event.target.value }))}
                        className="w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                      />
                    </FieldGroup>
                    <FieldGroup label={t("colPreferredLanguage")} required error={newPatientErrors.preferred_language}>
                      <select
                        value={newPatient.preferred_language}
                        onChange={(event) =>
                          setNewPatient((prev) => ({
                            ...prev,
                            preferred_language: event.target.value as PreferredLanguage,
                          }))
                        }
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                      >
                        <option value="th">{t("languageTh")}</option>
                        <option value="en">{t("languageEn")}</option>
                      </select>
                    </FieldGroup>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setCreatingNew(false)}
                        className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-app)]"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        type="submit"
                        disabled={creatingPatientBusy}
                        className="rounded-lg bg-[var(--brand-ink)] px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-60"
                      >
                        {t("save")}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

          {selectedPatient && (
            <form onSubmit={handleSubmitVisit} className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4">
              <div className="text-[12.5px] font-semibold text-[var(--ink)]">{t("registerStepVisit")}</div>

              {visitError && <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{visitError}</div>}

              <FieldGroup label={t("colPathwayTemplate")} required>
                <select
                  value={pathwayTemplateId}
                  onChange={(event) => setPathwayTemplateId(event.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                >
                  <option value="">{t("selectPlaceholder")}</option>
                  {activeTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name_th}
                    </option>
                  ))}
                </select>
              </FieldGroup>

              <FieldGroup label={t("colVisitDate")} required>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(event) => setVisitDate(event.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
                />
              </FieldGroup>

              <label className="flex items-center gap-2 text-[12.5px] text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={usesWheelchair}
                  onChange={(event) => setUsesWheelchair(event.target.checked)}
                  className="h-4 w-4"
                />
                {t("colWheelchair")}
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-app)]"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[var(--brand-ink)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  {t("registerVisit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string[];
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12.5px] font-medium text-[var(--ink)]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error?.map((message, index) => (
        <div key={index} className="text-[11.5px] text-red-600">
          {message}
        </div>
      ))}
    </div>
  );
}
