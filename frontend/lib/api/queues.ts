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
