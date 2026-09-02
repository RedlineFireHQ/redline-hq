export type ApparatusChecklistResultStatus = "checked" | "deficiency" | "not_applicable";

export type ApparatusChecklistItem = {
  id: string;
  isRequired: boolean;
};

export type ApparatusChecklistProgressRow = {
  checklistItemId: string;
  status: ApparatusChecklistResultStatus;
};

function toStatusMap(rows: ApparatusChecklistProgressRow[]) {
  const map = new Map<string, ApparatusChecklistResultStatus>();
  for (const row of rows) {
    map.set(row.checklistItemId, row.status);
  }
  return map;
}

export function isChecklistStatusComplete(status: ApparatusChecklistResultStatus | null | undefined) {
  return status === "checked" || status === "deficiency" || status === "not_applicable";
}

export function getChecklistProgress(
  items: ApparatusChecklistItem[],
  progressRows: ApparatusChecklistProgressRow[],
) {
  const statusByItemId = toStatusMap(progressRows);
  const requiredItems = items.filter((item) => item.isRequired);

  let completedRequired = 0;
  for (const item of requiredItems) {
    if (isChecklistStatusComplete(statusByItemId.get(item.id) ?? null)) {
      completedRequired += 1;
    }
  }

  return {
    requiredCount: requiredItems.length,
    completedRequired,
    remainingRequired: Math.max(0, requiredItems.length - completedRequired),
  };
}

export function isChecklistSubmissionAllowed(input: {
  requireChecklist: boolean;
  items: ApparatusChecklistItem[];
  progressRows: ApparatusChecklistProgressRow[];
}) {
  if (!input.requireChecklist) {
    return true;
  }

  const progress = getChecklistProgress(input.items, input.progressRows);
  if (progress.requiredCount === 0) {
    return false;
  }

  return progress.completedRequired >= progress.requiredCount;
}
