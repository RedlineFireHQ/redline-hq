"use client";

import { useMemo, useState } from "react";

type HistoryItemView = {
  id: string;
  occurred_at: string;
  title: string;
  detail: string;
  sourceLabel: string;
};

interface HistorySectionProps {
  historyItems: HistoryItemView[];
}

function formatDateOnly(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HistorySection({ historyItems }: HistorySectionProps) {
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return historyItems;
    }

    return historyItems.filter((item) => {
      const dateText = formatDateOnly(item.occurred_at).toLowerCase();
      const haystack = [item.title, item.detail, item.sourceLabel, item.occurred_at, dateText]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [historyItems, search]);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#101010]/84 p-6">
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-2xl font-semibold text-white">History</h2>
        <p className="mt-1 text-sm text-neutral-400">Member-linked readiness activity recorded in existing systems.</p>
        <div className="mt-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search history..."
            className="w-full rounded-lg border border-white/10 bg-[#141414]/90 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-white/20 focus:outline-none"
          />
        </div>
      </div>

      {historyItems.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
          No member-linked readiness activity found yet.
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
          No matching history records.
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-[#121212]/88">
          <div className="h-[18rem] overflow-y-auto">
            <div className="divide-y divide-white/10">
              {filteredItems.map((row) => (
                <article key={row.id} className="h-24 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-white" title={row.title}>{row.title}</p>
                    <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-neutral-500">{row.sourceLabel}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-neutral-300" title={row.detail}>{row.detail}</p>
                  <p className="mt-1 text-xs text-neutral-500">{formatDateOnly(row.occurred_at)}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        Apparatus inspections are shown only when inspector or participant attribution is present on records.
      </p>
    </section>
  );
}
