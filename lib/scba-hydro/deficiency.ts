export function hydroDeficiencyHref(resultId: string, cylinderId: string, cylinderLabel: string) {
  const params = new URLSearchParams({
    returnTo: "/inventory/scba-cylinders/hydrostatic-testing",
    inventoryCategory: "scba-cylinders",
    inventoryItemId: cylinderId,
    inventoryItemLabel: cylinderLabel,
    apparatusId: "station-supply",
    hydrostatic: "1",
    hydroResultId: resultId,
  });
  return `/deficiencies/report?${params}`;
}

export function hydroResultButtonClass(result: "Pass" | "Fail", selected: boolean) {
  const base = "rounded-lg border px-3 py-1.5 text-xs font-semibold transition";
  if (result === "Pass") {
    return `${base} ${selected ? "border-emerald-500/40 bg-emerald-600 text-white" : "border-emerald-500/30 bg-emerald-900/20 text-emerald-100 hover:bg-emerald-900/30"}`;
  }

  return `${base} ${selected ? "border-red-500/40 bg-red-600 text-white" : "border-red-500/30 bg-red-900/20 text-red-100 hover:bg-red-900/30"}`;
}

export function shouldMarkCylinderOutOfService(isHydrostatic: boolean, requested: boolean) {
  return !isHydrostatic || requested;
}
