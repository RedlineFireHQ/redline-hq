const RED_OAK_DEPARTMENT_ID = "82f50d14-216a-4dd1-80f4-58459dc97b97";
const RED_OAK_UNIT_141_ID = "44d16b08-9adb-402a-bfe5-80ee5f4143c5";

type ApparatusIdentity = {
  id?: string;
  department_id: string | null;
  name?: string | null;
  type?: string | null;
};

export function isExcludedFromApparatusChecks(apparatus: ApparatusIdentity): boolean {
  return apparatus.department_id === RED_OAK_DEPARTMENT_ID &&
    (apparatus.id === RED_OAK_UNIT_141_ID || apparatus.name?.trim() === "141");
}

export function canStartApparatusCheck(
  apparatus: ApparatusIdentity,
  authenticatedDepartmentId: string | null | undefined,
): boolean {
  return Boolean(authenticatedDepartmentId) &&
    apparatus.department_id === authenticatedDepartmentId &&
    !isExcludedFromApparatusChecks(apparatus);
}

export function isRedOakDailyChecks(
  apparatus: ApparatusIdentity,
  authenticatedDepartmentId: string | null | undefined,
): boolean {
  return canStartApparatusCheck(apparatus, authenticatedDepartmentId) &&
    apparatus.department_id === RED_OAK_DEPARTMENT_ID &&
    apparatus.name?.trim() === "Daily Apparatus Checks" &&
    apparatus.type?.trim().toLowerCase() === "administrative";
}

export function applicableChecklistItems<T extends { itemLabel: string }>(
  items: T[],
  specialMode: boolean,
): T[] {
  return specialMode ? items.filter((item) => item.itemLabel.trim() !== "141") : items;
}
