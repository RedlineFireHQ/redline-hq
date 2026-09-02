export const MEMBER_RANK_OPTIONS = [
  "Firefighter",
  "Driver Operator",
  "Lieutenant",
  "Captain",
  "Battalion Chief",
  "Assistant Chief",
  "Chief",
] as const;

export type MemberRank = (typeof MEMBER_RANK_OPTIONS)[number];

export const APP_PERMISSION_KEYS = [
  "personnel_management",
  "training_management",
  "homework_assignment",
  "training_review",
  "apparatus_management",
  "maintenance_management",
  "deficiency_management",
  "certification_management",
  "inventory_management",
  "reports_management",
  "documents_management",
  "settings_management",
] as const;

export type AppPermissionKey = (typeof APP_PERMISSION_KEYS)[number];

export type AppPermissionOption = {
  key: string;
  label: string;
  description: string | null;
  active: boolean;
  sort_order: number;
};

export function isValidMemberRank(value: unknown): value is MemberRank {
  return typeof value === "string" && MEMBER_RANK_OPTIONS.includes(value as MemberRank);
}

export function normalizePermissionKeys(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const cleaned = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  return Array.from(new Set(cleaned));
}
