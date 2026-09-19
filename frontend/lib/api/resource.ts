import { apiFetch } from "./client";

/**
 * Thin typed CRUD wrapper around `apiFetch` for a single REST resource
 * (list/create/update/delete). Every Admin master-data resource in Phase 1
 * follows the same plain `ModelViewSet` shape (see IMPLEMENT_PLAN.md), so
 * this is shared across `lib/api/facility.ts`, `pathway.ts`, `queues.ts`,
 * `accounts.ts` instead of hand-rolling the same four calls per resource.
 */
export type ResourceClient<T, TInput> = {
  list: () => Promise<T[]>;
  create: (data: TInput) => Promise<T>;
  update: (id: number, data: TInput) => Promise<T>;
  remove: (id: number) => Promise<void>;
};

export function createResourceClient<T, TInput = Partial<T>>(basePath: string): ResourceClient<T, TInput> {
  return {
    list: () => apiFetch<T[]>(basePath),
    create: (data) => apiFetch<T>(basePath, { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => apiFetch<T>(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id) => apiFetch<void>(`${basePath}/${id}`, { method: "DELETE" }),
  };
}
