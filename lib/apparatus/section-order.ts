/**
 * Preferred display order for apparatus-check checklist sections, matching the
 * crew's workflow: Outside first, then Inside, then Jump Kit. Any section not
 * listed here keeps its relative position after the known ones (by first
 * appearance), so unknown sections are never reordered or dropped.
 */
export const APPARATUS_CHECK_SECTION_ORDER: readonly string[] = [
  "Outside",
  "Inside",
  "Jump Kit",
];

/**
 * Order section names by the preferred workflow order. Sections not in the
 * preferred list are appended in their original relative order. Stable and
 * deterministic regardless of the incoming (database) order.
 */
export function orderApparatusCheckSections(sectionNames: string[]): string[] {
  const preferred = APPARATUS_CHECK_SECTION_ORDER.filter((name) =>
    sectionNames.includes(name),
  );
  const remainder = sectionNames.filter((name) => !APPARATUS_CHECK_SECTION_ORDER.includes(name));
  return [...preferred, ...remainder];
}
