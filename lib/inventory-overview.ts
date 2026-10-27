export type InventoryOverviewCategory = {
  name: string;
  detail: string;
  countLabel?: string;
  countTables?: string[];
};

export function resolveInventoryOverviewCategories<T extends InventoryOverviewCategory>(
  categories: T[],
  countByTable: ReadonlyMap<string, number | null> | null,
): T[] {
  return categories.map((category) => {
    if (!category.countLabel || !category.countTables?.length) {
      return category;
    }

    if (!countByTable) {
      return { ...category, detail: "Select a department to view count" };
    }

    let total = 0;
    for (const table of category.countTables) {
      const count = countByTable.get(table);
      if (typeof count !== "number") {
        return { ...category, detail: "Count unavailable" };
      }
      total += count;
    }

    return { ...category, detail: `${total} ${category.countLabel}` };
  });
}