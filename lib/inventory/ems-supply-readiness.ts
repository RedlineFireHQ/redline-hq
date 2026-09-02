export type EmsSupplyStockStatus = "Out of Stock" | "Critical" | "Low" | "Normal";

export type EmsSupplyReadinessItem = {
  isActive: boolean;
  stockStatus: EmsSupplyStockStatus;
};

export type EmsSupplyReadinessResult = {
  isRated: boolean;
  readinessPercent: number | null;
  totalActive: number;
  normalCount: number;
  lowCount: number;
  criticalCount: number;
  outOfStockCount: number;
};

const STATUS_CONTRIBUTION_MULTIPLIER: Record<EmsSupplyStockStatus, number> = {
  "Normal": 1,
  "Low": 0.5,
  "Critical": 0,
  "Out of Stock": 0,
};

export function calculateEmsSupplyReadiness(
  items: EmsSupplyReadinessItem[],
): EmsSupplyReadinessResult {
  let totalActive = 0;
  let normalCount = 0;
  let lowCount = 0;
  let criticalCount = 0;
  let outOfStockCount = 0;
  let readinessTotal = 0;

  for (const item of items) {
    if (!item.isActive) {
      continue;
    }

    totalActive += 1;
    if (item.stockStatus === "Normal") {
      normalCount += 1;
    } else if (item.stockStatus === "Low") {
      lowCount += 1;
    } else if (item.stockStatus === "Critical") {
      criticalCount += 1;
    } else {
      outOfStockCount += 1;
    }
  }

  if (totalActive === 0) {
    return {
      isRated: false,
      readinessPercent: null,
      totalActive,
      normalCount,
      lowCount,
      criticalCount,
      outOfStockCount,
    };
  }

  const itemFullValue = 100 / totalActive;

  readinessTotal += normalCount * itemFullValue * STATUS_CONTRIBUTION_MULTIPLIER["Normal"];
  readinessTotal += lowCount * itemFullValue * STATUS_CONTRIBUTION_MULTIPLIER["Low"];
  readinessTotal +=
    criticalCount * itemFullValue * STATUS_CONTRIBUTION_MULTIPLIER["Critical"];
  readinessTotal +=
    outOfStockCount * itemFullValue * STATUS_CONTRIBUTION_MULTIPLIER["Out of Stock"];

  return {
    isRated: true,
    readinessPercent: readinessTotal,
    totalActive,
    normalCount,
    lowCount,
    criticalCount,
    outOfStockCount,
  };
}
