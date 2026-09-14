"use client";

import { useMemo, useState } from "react";

type PumpTestHistoryRow = {
  id: string;
  apparatusName: string;
  testDate: string | null;
  testedBy: string;
  result: string | null;
  notes: string | null;
};

interface PumpTestHistoryTableProps {
  rows: PumpTestHistoryRow[];
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default function PumpTestHistoryTable({ rows }: PumpTestHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) => {
      const searchable = [
        row.apparatusName,
        row.testedBy,
        row.result ?? "",
        row.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [rows, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-4">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search pump test history"
          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#2E2E2E]">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-[#1b1b1b] text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              <th className="px-4 py-3 font-semibold">Apparatus</th>
              <th className="px-4 py-3 font-semibold">Test Date</th>
              <th className="px-4 py-3 font-semibold">Tested By</th>
              <th className="px-4 py-3 font-semibold">Result</th>
              <th className="px-4 py-3 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  No pump-test history found.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-white">{row.apparatusName}</td>
                  <td className="px-4 py-3 text-neutral-200">{formatDate(row.testDate)}</td>
                  <td className="px-4 py-3 text-neutral-200">{row.testedBy}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        row.result === "Pass"
                          ? "border-green-700/40 bg-green-900/20 text-green-200"
                          : row.result === "Fail"
                            ? "border-red-700/40 bg-red-900/20 text-red-200"
                            : "border-white/15 bg-neutral-900 text-neutral-200"
                      }`}
                    >
                      {row.result ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-200">{row.notes?.trim() || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
