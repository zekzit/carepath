import { apiFetch } from "./client";
import { createResourceClient } from "./resource";

export const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

export type ServiceSchedule = {
  id: number;
  service_point: number;
  day_of_week: number;
  open_time: string; // "HH:MM:SS"
  close_time: string; // "HH:MM:SS"
};
export type ServiceScheduleInput = Omit<ServiceSchedule, "id">;

export const serviceSchedulesApi = createResourceClient<ServiceSchedule, ServiceScheduleInput>(
  "/queues/service-schedules",
);

export type Queue = {
  id: number;
  service_point: number;
  queue_date: string; // "YYYY-MM-DD"
  current_number: number;
};

/** `GET /queues/queues?service_point={id}` — defaults to today's queue_date on
 * the backend; returns [] when the service point has no queue yet today
 * (no VisitStep started there yet), which is a normal empty state, not an error. */
export function listQueuesByServicePoint(servicePointId: number): Promise<Queue[]> {
  return apiFetch<Queue[]>(`/queues/queues?service_point=${servicePointId}`);
}

/** 400s with `{"detail": "No waiting tickets in this queue."}` when nothing is WAITING. */
export function callNextTicket(queueId: number): Promise<Queue> {
  return apiFetch<Queue>(`/queues/queues/${queueId}/call-next`, { method: "POST" });
}

export const TICKET_STATUSES = ["WAITING", "CALLED", "SERVING", "DONE", "SKIPPED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type QueueTicket = {
  id: number;
  queue: number;
  visit_step: number;
  ticket_number: number;
  status: TicketStatus;
  called_at: string | null;
};

export function listQueueTickets(queueId: number): Promise<QueueTicket[]> {
  return apiFetch<QueueTicket[]>(`/queues/queue-tickets?queue=${queueId}`);
}

export function serveTicket(id: number): Promise<QueueTicket> {
  return apiFetch<QueueTicket>(`/queues/queue-tickets/${id}/serve`, { method: "POST" });
}

export function doneTicket(id: number): Promise<QueueTicket> {
  return apiFetch<QueueTicket>(`/queues/queue-tickets/${id}/done`, { method: "POST" });
}
