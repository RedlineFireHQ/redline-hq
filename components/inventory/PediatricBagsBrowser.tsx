"use client";

import { useMemo, useState } from "react";
import PediatricBagPicker from "@/components/inventory/PediatricBagPicker";
import PediatricCheckHistory from "@/components/inventory/PediatricCheckHistory";
import type { PediatricBagRow, PediatricInspectionSummaryRow } from "@/lib/pediatric-bags/data";
import {
  filterPediatricBags,
  filterPediatricInspections,
  findMatchingPediatricChecklistItems,
} from "@/lib/pediatric-bags/search";

type PediatricBagsBrowserProps = {
  bags: PediatricBagRow[];
  inspections: PediatricInspectionSummaryRow[];
  canDeleteInspections: boolean;
};

/**
 * Client-side browser for the Pediatric Bags view: a single search field
 * (styled consistently with other Redline HQ inventory pages) filters the four
 * artwork bag cards, matches the shared checklist template, and filters the
 * Pediatric Check History rendered below the cards.
 */
export default function PediatricBagsBrowser({
  bags,
  inspections,
  canDeleteInspections,
}: PediatricBagsBrowserProps) {
  const [query, setQuery] = useState("");
  const hasQuery = query.trim().length > 0;

  const bagMatches = useMemo(() => filterPediatricBags(bags, query), [bags, query]);
  const itemMatches = useMemo(() => findMatchingPediatricChecklistItems(query), [query]);
  const visibleInspections = useMemo(() => filterPediatricInspections(inspections, query), [inspections, query]);

  // All bags share the department checklist template, so a checklist-item
  // match keeps every bag visible; a bag-name match narrows the cards.
  const visibleBags = !hasQuery
    ? bags
    : bagMatches.length > 0
      ? bagMatches
      : itemMatches.length > 0
        ? bags
        : [];

  return (
    <div className="space-y-8">
      <div>
        <label htmlFor="pediatric-bags-search" className="sr-only">
          Search pediatric bags, checklist items, or inspection history
        </label>
        <input
          id="pediatric-bags-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pediatric bags, checklist items, or inspection history..."
          className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
        />
        {hasQuery && itemMatches.length > 0 ? (
          <p className="mt-2 text-xs text-neutral-400">
            Checklist matches: {itemMatches.join(", ")}
          </p>
        ) : null}
      </div>

      {visibleBags.length > 0 ? (
        <PediatricBagPicker bags={visibleBags} />
      ) : (
        <section className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/40 p-8 text-center">
          <p className="text-sm text-neutral-400">No pediatric bags match &ldquo;{query.trim()}&rdquo;.</p>
        </section>
      )}

      <PediatricCheckHistory inspections={visibleInspections} canDelete={canDeleteInspections} />
    </div>
  );
}
