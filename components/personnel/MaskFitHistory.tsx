"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type HistoryRow = {
  result_id: string;
  member_name: string;
  session_id: string;
  session_name: string;
  test_date: string;
  tester_name: string;
  result: string;
  mask_size: string;
  total_count: number;
};
type Filters = { personnel: string; session: string; from: string; to: string; result: string };
const initial: Filters = { personnel: "", session: "", from: "", to: "", result: "" };
const input = "rounded-lg border border-white/15 bg-neutral-950 px-3 py-2 text-sm text-white";

export default function MaskFitHistory({ departmentId, memberId }: { departmentId: string; memberId?: string }) {
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(0);
  const [session, setSession] = useState<{ id: string; name: string } | null>(null);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error: queryError } = await supabase.rpc("search_scba_mask_fit_history", {
        p_department_id: departmentId, p_member_id: memberId ?? null,
        p_personnel: filters.personnel, p_session: filters.session,
        p_from: filters.from || null, p_to: filters.to || null,
        p_result: filters.result || null, p_offset: page * 25, p_limit: 25,
        p_session_id: session?.id ?? null,
      });
      if (!active) return;
      if (queryError) {
        setRows([]);
        setError(`Unable to load mask fit history: ${queryError.message}`);
      } else {
        setRows((data ?? []) as HistoryRow[]);
        setError("");
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [departmentId, memberId, filters, page, session]);

  const total = Number(rows[0]?.total_count ?? 0);
  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-neutral-900 p-5">
      <h2 className="text-xl font-semibold">SCBA Mask Fit Test History</h2>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
        event.preventDefault();
        if (draft.from && draft.to && draft.from > draft.to) {
          setError("The start date must be on or before the end date.");
          return;
        }
        setLoading(true);
        setSession(null);
        setPage(0);
        setFilters({ ...draft });
      }}>
        {!memberId ? <label className="grid gap-1 text-sm">Firefighter
          <input className={input} value={draft.personnel} onChange={(event) => setDraft({ ...draft, personnel: event.target.value })} />
        </label> : null}
        <label className="grid gap-1 text-sm">Session
          <input className={input} value={draft.session} onChange={(event) => setDraft({ ...draft, session: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">From
          <input className={input} type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">To
          <input className={input} type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">Result
          <select className={input} value={draft.result} onChange={(event) => setDraft({ ...draft, result: event.target.value })}>
            <option value="">All</option><option value="Pass">Pass</option><option value="Fail">Fail</option>
          </select>
        </label>
        <button className="rounded-lg bg-neutral-700 px-4 py-2 text-sm hover:bg-neutral-600">Search</button>
      </form>
      {session ? (
        <p className="mt-4 text-sm text-neutral-300">
          Session: {session.name} ({session.id}){" "}
          <button type="button" className="underline" onClick={() => { setLoading(true); setSession(null); setPage(0); }}>Show all sessions</button>
        </p>
      ) : null}
      {error ? <p role="alert" className="mt-4 text-red-300">{error}</p> : null}
      {loading ? <p className="mt-4 text-neutral-400">Loading history...</p> : !error && rows.length === 0
        ? <p className="mt-4 text-neutral-400">No matching tests.</p> : null}
      {!loading && rows.length ? (
        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <details key={row.result_id} className="rounded-lg border border-white/10 p-3">
              <summary className="cursor-pointer font-semibold">
                {row.test_date} · {row.member_name} · {row.result.toUpperCase()} · {row.session_name}
              </summary>
              <div className="mt-2 text-sm text-neutral-300">
                Mask size: {row.mask_size} · Tester: {row.tester_name}<br />
                Session: {row.session_name} ({row.session_id})
                {!memberId ? <button type="button" className="ml-3 underline" onClick={() => {
                  setLoading(true); setPage(0); setDraft(initial); setFilters({ ...initial });
                  setSession({ id: row.session_id, name: row.session_name });
                }}>View session results</button> : null}
              </div>
            </details>
          ))}
          <div className="flex items-center gap-3 text-sm text-neutral-300">
            <button type="button" className={input} disabled={page === 0} onClick={() => { setLoading(true); setPage(page - 1); }}>Previous</button>
            <span>Page {page + 1} · {total} results</span>
            <button type="button" className={input} disabled={(page + 1) * 25 >= total} onClick={() => { setLoading(true); setPage(page + 1); }}>Next</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
