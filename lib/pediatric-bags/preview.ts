import {
  PEDIATRIC_BAG_LABELS,
  PEDIATRIC_INVENTORY,
  PEDIATRIC_SECTION_ORDER,
} from "@/lib/pediatric-bags/inventory";

/**
 * Read-only preview data for the Pediatric Bags checklist.
 *
 * Built from the canonical shared inventory (lib/pediatric-bags/inventory.ts) —
 * no database connection required. This is a PREVIEW ONLY: nothing here is
 * saved, and no inspection is recorded. Used by the preview pages so the four
 * bags, 17 sections, item wording, and quantities can be inspected without a
 * working Supabase connection.
 */

export type PreviewChecklistItem = {
  id: string;
  sectionName: string;
  itemLabel: string;
  requiredQuantity: number | null;
  sourceQuantityText: string;
};

export type PreviewBag = {
  label: string;
  displayName: string;
  imagePath: string;
};

export type PreviewSection = {
  sectionName: string;
  items: PreviewChecklistItem[];
};

/**
 * Artwork for each bag, mapped by bag letter. The files live in
 * public/branding/images/ (verified to exist). Paths are URL-encoded for the
 * spaces in the filenames.
 */
const BAG_IMAGE_PATHS: Record<string, string> = {
  A: "/branding/images/Pediatric%20Bag%20A%20Emergency%20Emblem.png",
  B: "/branding/images/Futuristic%20Pediatric%20Bag%20B%20Emblem.png",
  C: "/branding/images/Industrial%20Pediatric%20Bag%20C%20Emblem.png",
  D: "/branding/images/Industrial%20Pediatric%20bag%20d%20EMS%20Emblem.png",
};

/** The four preview bags (A/B/C/D), all sharing the identical inventory. */
export function getPreviewBags(): PreviewBag[] {
  return PEDIATRIC_BAG_LABELS.map((label) => ({
    label,
    displayName: `Pediatric Bag ${label}`,
    imagePath: BAG_IMAGE_PATHS[label],
  }));
}

/** A single preview bag by label (case-insensitive), or null if not A–D. */
export function getPreviewBag(label: string): PreviewBag | null {
  const normalized = label.trim().toUpperCase();
  const found = PEDIATRIC_BAG_LABELS.find((l) => l === normalized);
  return found
    ? { label: found, displayName: `Pediatric Bag ${found}`, imagePath: BAG_IMAGE_PATHS[found] }
    : null;
}

/** The full checklist grouped into the 17 source-ordered sections. */
export function getPreviewSections(): PreviewSection[] {
  const bySection = new Map<string, PreviewChecklistItem[]>();

  PEDIATRIC_INVENTORY.forEach(([sectionName, itemLabel, requiredQuantity, sourceQuantityText], index) => {
    const item: PreviewChecklistItem = {
      id: `preview-item-${index + 1}`,
      sectionName,
      itemLabel,
      requiredQuantity,
      sourceQuantityText,
    };
    const list = bySection.get(sectionName) ?? [];
    list.push(item);
    bySection.set(sectionName, list);
  });

  // Emit sections in the canonical source order.
  return PEDIATRIC_SECTION_ORDER.map((sectionName) => ({
    sectionName,
    items: bySection.get(sectionName) ?? [],
  }));
}

/** Count of items whose quantity is unresolved in the source ("***"). */
export function countUnresolvedPreviewItems(): number {
  return PEDIATRIC_INVENTORY.filter((entry) => entry[2] === null).length;
}
