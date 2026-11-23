export type HydroResult = "Pass" | "Fail" | "";

export function setAllHydroResults(ids: string[], result: HydroResult): Record<string, HydroResult> {
  return Object.fromEntries(ids.map((id) => [id, result]));
}

export function setHydroResult(results: Record<string, HydroResult>, id: string, result: "Pass" | "Fail", allowClear: boolean): Record<string, HydroResult> {
  return { ...results, [id]: allowClear && results[id] === result ? "" : result };
}
