export type PpeReadinessItem = {
  isActive: boolean;
  hasOpenDeficiency: boolean;
};

export type PpeReadinessResult = {
  isRated: boolean;
  readinessPercent: number | null;
  activePpeCount: number;
  openDeficiencyItemCount: number;
};

export function calculatePpeReadiness(items: PpeReadinessItem[]): PpeReadinessResult {
  let activePpeCount = 0;
  let openDeficiencyItemCount = 0;
  let readinessTotal = 0;

  for (const item of items) {
    if (!item.isActive) {
      continue;
    }

    activePpeCount += 1;
    if (item.hasOpenDeficiency) {
      openDeficiencyItemCount += 1;
    }
  }

  if (activePpeCount === 0) {
    return {
      isRated: false,
      readinessPercent: null,
      activePpeCount,
      openDeficiencyItemCount,
    };
  }

  const itemFullValue = 100 / activePpeCount;
  const openItemValue = itemFullValue * 0.5;

  readinessTotal += (activePpeCount - openDeficiencyItemCount) * itemFullValue;
  readinessTotal += openDeficiencyItemCount * openItemValue;

  return {
    isRated: true,
    readinessPercent: readinessTotal,
    activePpeCount,
    openDeficiencyItemCount,
  };
}
