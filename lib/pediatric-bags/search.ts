import type { PediatricBagRow, PediatricInspectionSummaryRow } from "./data";
import { PEDIATRIC_INVENTORY } from "./inventory";

/**
 * Pure client-side search helpers for the Pediatric Bags page. A single query
 * matches bags (by label / display name), the shared checklist template (by
 * item label), and inspection history (by bag, inspector, status, or date).
 */

export function normalizePediatricSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Bags whose label or display name contains the query. Empty query → all. */
export function filterPediatricBags(bags: PediatricBagRow[], query: string): PediatricBagRow[] {
  const normalized = normalizePediatricSearchQuery(query);
  if (!normalized) {
    return bags;
  }

  return bags.filter(
    (bag) =>
      bag.bagLabel.toLowerCase().includes(normalized) ||
      bag.displayName.toLowerCase().includes(normalized),
  );
}

/**
 * Checklist template item labels matching the query (deduped, capped). All
 * four bags share one department template, so an item match applies to every
 * bag; the UI surfaces these as context rather than hiding bags.
 */
export function findMatchingPediatricChecklistItems(query: string, limit = 5): string[] {
  const normalized = normalizePediatricSearchQuery(query);
  if (!normalized) {
    return [];
  }

  const matches: string[] = [];
  for (const [, itemLabel] of PEDIATRIC_INVENTORY) {
    if (itemLabel.toLowerCase().includes(normalized) && !matches.includes(itemLabel)) {
      matches.push(itemLabel);
      if (matches.length >= limit) {
        break;
      }
    }
  }
  return matches;
}

function formatSearchableDate(value: string | null): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed
    .toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    .toLowerCase();
}

/** History entries matching bag label, inspector, status, or date. */
export function filterPediatricInspections(
  inspections: PediatricInspectionSummaryRow[],
  query: string,
): PediatricInspectionSummaryRow[] {
  const normalized = normalizePediatricSearchQuery(query);
  if (!normalized) {
    return inspections;
  }

  return inspections.filter((inspection) => {
    const haystacks = [
      `pediatric bag ${inspection.bagLabel}`.toLowerCase(),
      inspection.bagLabel.toLowerCase(),
      inspection.inspectorName.toLowerCase(),
      inspection.status.toLowerCase().replace(/_/g, " "),
      formatSearchableDate(inspection.createdAt),
    ];
    return haystacks.some((text) => text.includes(normalized));
  });
}
