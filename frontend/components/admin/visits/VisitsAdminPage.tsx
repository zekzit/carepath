"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "@/components/icons";
import { patientsApi, visitsApi, type Patient, type Visit } from "@/lib/api/visits";
import { pathwayTemplatesApi, type PathwayTemplate } from "@/lib/api/pathway";
import { RegisterVisitForm } from "./RegisterVisitForm";
import { VisitsList } from "./VisitsList";
import { VisitDetail } from "./VisitDetail";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchVisitsPageData() {
  const [patients, pathwayTemplates, visits] = await Promise.all([
    patientsApi.list(),
    pathwayTemplatesApi.list(),
    visitsApi.list(),
  ]);
  return { patients, pathwayTemplates, visits };
}

export function VisitsAdminPage() {
  const t = useTranslations("admin");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [pathwayTemplates, setPathwayTemplates] = useState<PathwayTemplate[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFilter, setDateFilter] = useState(todayStr());
  const [formOpen, setFormOpen] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);

  async function refetchAll() {
    setLoading(true);
    try {
      const data = await fetchVisitsPageData();
      setPatients(data.patients);
      setPathwayTemplates(data.pathwayTemplates);
      setVisits(data.visits);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchVisitsPageData();
        if (cancelled) return;
        setPatients(data.patients);
        setPathwayTemplates(data.pathwayTemplates);
        setVisits(data.visits);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedVisit = visits.find((v) => v.id === selectedVisitId) ?? null;

  if (selectedVisit) {
    return (
      <VisitDetail
        visit={selectedVisit}
        patients={patients}
        pathwayTemplates={pathwayTemplates}
        onBack={() => setSelectedVisitId(null)}
        onVisitStatusChanged={refetchAll}
      />
    );
  }

  const visibleVisits = dateFilter ? visits.filter((v) => v.visit_date === dateFilter) : visits;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[12.5px] font-medium text-[var(--ink-muted)]">{t("colVisitDate")}</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--brand-teal)]"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="text-[12px] font-medium text-[var(--brand-teal)]"
            >
              {t("visitsShowAll")}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--brand-ink)] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon width={15} height={15} />
          {t("registerVisit")}
        </button>
      </div>

      <VisitsList
        visits={visibleVisits}
        patients={patients}
        pathwayTemplates={pathwayTemplates}
        loading={loading}
        onSelect={(visit) => setSelectedVisitId(visit.id)}
      />

      {formOpen && (
        <RegisterVisitForm
          pathwayTemplates={pathwayTemplates}
          onClose={() => setFormOpen(false)}
          onRegistered={async (visit) => {
            setFormOpen(false);
            await refetchAll();
            setSelectedVisitId(visit.id);
          }}
        />
      )}
    </div>
  );
}
