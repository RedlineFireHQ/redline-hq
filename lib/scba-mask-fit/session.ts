import type { FitResult, MaskSize } from "./status";

export type FitMember = { id: string; name: string };
export type FitEntry = { member: FitMember; result: FitResult | ""; size: MaskSize | "" };

export function searchAvailableMembers(members: FitMember[], entries: FitEntry[], search: string): FitMember[] {
  const term = search.trim().toLowerCase();
  if (!term) return [];
  const selected = new Set(entries.map((entry) => entry.member.id));
  return members.filter((member) => !selected.has(member.id) && member.name.toLowerCase().includes(term)).slice(0, 20);
}

export function isCompleteSession(name: string, date: string, tester: string, entries: FitEntry[]): boolean {
  return Boolean(name.trim() && date && tester.trim() && entries.length > 0
    && new Set(entries.map((entry) => entry.member.id)).size === entries.length
    && entries.every((entry) => entry.result && entry.size));
}
