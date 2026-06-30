/**
 * Generic API client for authenticated requests
 * Ensures credentials are sent and handles errors properly
 */

export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Safely fetch an array, returning empty array if response is not an array
 */
export async function apiArray<T = any>(url: string, options?: RequestInit): Promise<T[]> {
  const data = await apiFetch(url, options);
  return Array.isArray(data) ? data : [];
}

/**
 * Query key factory for consistent query key generation
 */
export const queryKeys = {
  all: () => ["api"],
  entities: () => [...queryKeys.all(), "entities"],
  entity: (id: number) => [...queryKeys.entities(), id],

  employees: () => [...queryKeys.all(), "employees"],
  employee: (id: number) => [...queryKeys.employees(), id],

  patients: () => [...queryKeys.all(), "patients"],
  patient: (id: number) => [...queryKeys.patients(), id],

  wards: () => [...queryKeys.all(), "wards"],
  ward: (id: number) => [...queryKeys.wards(), id],

  beds: () => [...queryKeys.all(), "beds"],
  bed: (id: number) => [...queryKeys.beds(), id],

  permissions: () => [...queryKeys.all(), "permissions"],
  rolePermissions: (role: string) => [...queryKeys.permissions(), "role", role],
  userPermissions: (userId: number) => [...queryKeys.permissions(), "user", userId],
};
