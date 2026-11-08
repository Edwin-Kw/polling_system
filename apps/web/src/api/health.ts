import { apiPaths, healthResponseSchema } from "@polling/shared";

export async function fetchHealth(signal: AbortSignal) {
  const response = await fetch(apiPaths.health, { signal });

  if (!response.ok) {
    throw new Error(`Backend readiness check failed (HTTP ${response.status}). Check PostgreSQL and the API.`);
  }

  const body: unknown = await response.json();
  return healthResponseSchema.parse(body);
}
