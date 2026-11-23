export function hydrostaticDueDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Invalid hydrostatic test date.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const original = new Date(Date.UTC(year, month - 1, day));
  if (original.getUTCFullYear() !== year || original.getUTCMonth() !== month - 1 || original.getUTCDate() !== day) {
    throw new Error("Invalid hydrostatic test date.");
  }
  const lastDay = new Date(Date.UTC(year + 5, month, 0)).getUTCDate();
  return `${String(year + 5).padStart(4, "0")}-${match[2]}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
