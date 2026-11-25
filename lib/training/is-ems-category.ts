export function isEmsCategoryName(value: string | null | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return false;

  // Departments may label this category "EMS", "EMS Continuing Education",
  // or spell out "Emergency Medical Services". Match the category meaning,
  // not one exact display name.
  return /\bems\b/.test(normalized) || normalized.includes("emergency medical services");
}
