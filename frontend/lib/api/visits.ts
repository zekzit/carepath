import { apiFetch } from "./client";
import { createResourceClient } from "./resource";

export type PreferredLanguage = "th" | "en";

export type Patient = {
  id: number;
  hn_code: string;
  full_name: string;
  dob: string; // "YYYY-MM-DD"
  national_id: string;
  phone: string;
  preferred_language: PreferredLanguage;
};
export type PatientInput = Omit<Patient, "id">;

export const patientsApi = createResourceClient<Patient, PatientInput>("/visits/patients");

/** `GET /visits/patients?hn_code=...` — case-insensitive partial match, for the
 * live "search by HN" box on the visit-registration form. */
export function searchPatientsByHn(hnCode: string): Promise<Patient[]> {
  return apiFetch<Patient[]>(`/visits/patients?hn_code=${encodeURIComponent(hnCode)}`);
}

export const VISIT_STATUSES = ["REGISTERED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export type Visit = {
  id: number;
  patient: number;
  pathway_template: number;
  visit_date: string; // "YYYY-MM-DD"
  created_at: string;
  status: VisitStatus;
  qr_token: string;
  current_node: number | null;
  uses_wheelchair: boolean;
};

/** Only the fields a caller may set — `status`/`qr_token`/`created_at`/`current_node`
 * are server-generated (see backend/visits/serializers.py::VisitSerializer). */
export type VisitCreateInput = {
  patient: number;
  pathway_template: number;
  visit_date: string;
  uses_wheelchair: boolean;
};

export const visitsApi = createResourceClient<Visit, VisitCreateInput>("/visits/visits");

/** `GET /visits/visits?visit_date=YYYY-MM-DD` */
export function listVisitsByDate(visitDate: string): Promise<Visit[]> {
  return apiFetch<Visit[]>(`/visits/visits?visit_date=${encodeURIComponent(visitDate)}`);
}

export const VISIT_STEP_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"] as const;
export type VisitStepStatus = (typeof VISIT_STEP_STATUSES)[number];

export type VisitStep = {
  id: number;
  visit: number;
  service_point: number;
  sequence_order: number;
  prerequisite_steps: number[];
  status: VisitStepStatus;
  is_planned: boolean;
  /** True once staff has explicitly designated this PENDING step as where the
   * patient goes next — see backend/visits/viewsets.py's start/complete/skip
   * actions. Source of truth for eligibility now; no longer client-derived
   * from prerequisite_steps (see AdminStepTimeline.tsx::canStart). */
  is_next: boolean;
  started_at: string | null;
  completed_at: string | null;
};

/** One of the follow-up steps `complete`/`skip` would unlock, as returned by
 * their 409 "designate next step(s)" response. */
export type EligibleNextStepOption = {
  id: number;
  service_point: { id: number; name_th: string; name_en: string };
  waiting_count: number;
};

/** Shape of `ApiError.body` when `completeVisitStep`/`skipVisitStep` reject
 * with `status === 409` — completing/skipping would unlock one or more
 * follow-up steps and no `next_step_ids` were supplied yet. */
export type EligibleNextStepsError = {
  detail: string;
  eligible_next_steps: EligibleNextStepOption[];
};

/** `GET /visits/visit-steps?visit={id}` when `visitId` is given, otherwise the
 * unfiltered list (used for cross-referencing visit_step -> visit -> patient
 * on the Queue Console, same "fetch what you need into local state" approach
 * as Phase 1's NodesSection floor/building lookup). */
export function listVisitSteps(visitId?: number): Promise<VisitStep[]> {
  const query = visitId != null ? `?visit=${visitId}` : "";
  return apiFetch<VisitStep[]>(`/visits/visit-steps${query}`);
}

export function startVisitStep(id: number): Promise<VisitStep> {
  return apiFetch<VisitStep>(`/visits/visit-steps/${id}/start`, { method: "POST" });
}

/** `nextStepIds` designates which of a prior 409's `eligible_next_steps` the
 * patient goes to next (see EligibleNextStepsError). Omit it to get that 409
 * preview when completing this step would unlock follow-up step(s). */
export function completeVisitStep(id: number, nextStepIds?: number[]): Promise<VisitStep> {
  return apiFetch<VisitStep>(`/visits/visit-steps/${id}/complete`, {
    method: "POST",
    body: nextStepIds !== undefined ? JSON.stringify({ next_step_ids: nextStepIds }) : undefined,
  });
}

/** Same `next_step_ids` / 409-preview mechanism as completeVisitStep — see
 * EligibleNextStepsError. */
export function skipVisitStep(id: number, nextStepIds?: number[]): Promise<VisitStep> {
  return apiFetch<VisitStep>(`/visits/visit-steps/${id}/skip`, {
    method: "POST",
    body: nextStepIds !== undefined ? JSON.stringify({ next_step_ids: nextStepIds }) : undefined,
  });
}

/** Staff, standing at their own current VisitStep `id`, inserts a new
 * unplanned (`is_planned=false`) step at `servicePointId` for the same
 * visit (see backend/visits/viewsets.py::VisitStepViewSet.insert_next).
 * `insertBeforeStepIds` are added as EXTRA prerequisites of those existing
 * steps, on top of whatever they already had. */
export function insertVisitStep(
  id: number,
  servicePointId: number,
  insertBeforeStepIds: number[],
): Promise<VisitStep & { target_queue_waiting_count: number }> {
  return apiFetch<VisitStep & { target_queue_waiting_count: number }>(`/visits/visit-steps/${id}/insert-next`, {
    method: "POST",
    body: JSON.stringify({ service_point: servicePointId, insert_before_step_ids: insertBeforeStepIds }),
  });
}
