export type RopeStatus = "Active" | "Inactive" | "Out of Service";

export function normalizeRopeStatus(value: unknown): RopeStatus {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    return "Active";
  }

  const normalizedLower = normalized.toLowerCase();

  if (normalizedLower === "inactive") {
    return "Inactive";
  }

  if (normalizedLower === "out of service") {
    return "Out of Service";
  }

  return "Active";
}
