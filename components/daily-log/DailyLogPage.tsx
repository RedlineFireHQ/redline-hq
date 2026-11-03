import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Plus, Search } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import DailyLogForm from "./DailyLogForm";
import ArchiveDailyLog from "./ArchiveDailyLog";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";
import { canEditDailyLog, dailyLogDate, dailyLogTime, type DailyLogEntry } from "@/lib/daily-log";

export type DailyLogSearch = { q?: string; page?: string; entry?: string; saved?: string };

export default async function DailyLogPage({ params, mobile = false }: { params: DailyLogSearch; mobile?: boolean }) {
  const client = await createSupabaseServerClient();
  const member = await getCurrentMember(client);
  if (!member?.departmentId) redirect("/login");
  const { data: actors, error: actorError } = await client.rpc("daily_log_actor", { p_department_id: member.departmentId });
  if (actorError) throw new Error(`Unable to load Daily Log permissions: ${actorError.message}`);
  const actor = actors?.[0] as { member_id: string; is_admin: boolean } | undefined;
  if (!actor) return <p role="alert" className="p-6">Active department membership is required to access Daily Log.</p>;
  const basePath = mobile ? "/mobile/daily-log" : "/daily-log";
  const query = typeof params.q === "string" ? params.q : "";
  const parsedPage = Number(params.page);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= 100000 ? parsedPage : 1;
  let entries: DailyLogEntry[] = [];
  let editing: DailyLogEntry | null = null;
  const formOpen = Boolean(params.entry);
  if (formOpen && params.entry !== "new") {
    const { data, error } = await client.from("daily_logs").select("*").eq("department_id", member.departmentId).eq("id", params.entry).maybeSingle();
    if (error) throw new Error(`Unable to load Daily Log entry: ${error.message}`);
    editing = data as DailyLogEntry | null;
  } else if (!formOpen) {
    const { data, error } = await client.rpc("search_daily_logs", { p_department_id: member.departmentId, p_query: query, p_offset: (page - 1) * 50 });
    if (error) throw new Error(`Unable to load Daily Log: ${error.message}`);
    entries = (data ?? []) as DailyLogEntry[];
  }
  // A newly saved backdated/undated entry may not belong on the first history page.
  let saved: DailyLogEntry | null = null;
  if (params.saved && !formOpen) {
    const { data, error } = await client.from("daily_logs").select("*").eq("department_id", member.departmentId).eq("id", params.saved).maybeSingle();
    if (error) throw new Error(`Unable to load saved Daily Log: ${error.message}`);
    saved = data as DailyLogEntry | null;
  }
  const historyHref = (next: number) => `${basePath}?${new URLSearchParams({ q: query, page: String(next) })}`;
  const renderEntry = (entry: DailyLogEntry) => (
    <article key={entry.id} className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-4 sm:p-5">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[["Date", dailyLogDate(entry.entry_date)], ["Time", dailyLogTime(entry.entry_time)], ["Location", entry.location || "Not entered"], ["Unit", entry.unit || "Not entered"]].map(([label, value]) => (
          <div key={label} className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</dd></div>
        ))}
      </dl>
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Activity</h3>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6">{entry.activity || "Not entered"}</p>
        {entry.activity && (
          <details className="mt-2"><summary className="cursor-pointer py-2 text-sm text-red-300">Read full activity</summary><p tabIndex={0} aria-label="Full activity" className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words pr-2 text-sm leading-6">{entry.activity}</p></details>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
        <p className="text-xs text-neutral-400">{entry.edited_at ? `Edited ${new Date(entry.edited_at).toLocaleString("en-US", { timeZone: "America/Chicago" })} Central` : "Original entry"}</p>
        <div className="flex flex-wrap items-center gap-2">
          {canEditDailyLog(entry, actor.member_id, actor.is_admin) && <Link href={`${basePath}?entry=${entry.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-white/20 px-4 text-sm">Edit</Link>}
          {actor.is_admin && <ArchiveDailyLog id={entry.id} version={entry.edited_at ?? entry.created_at} />}
        </div>
      </div>
    </article>
  );
  const content = <div className="mx-auto max-w-5xl space-y-6">
    {mobile && <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm text-neutral-400">Back to Field Actions</Link>}
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl"><BookOpen className="h-7 w-7 text-red-500" />Daily Log</h1><p className="mt-2 text-sm text-neutral-400">Your department activity journal.</p></div>
      {!formOpen && <Link href={`${basePath}?entry=new`} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#EF2B2D] px-5 font-semibold"><Plus className="h-5 w-5" />Add Daily Log</Link>}
    </header>
    {formOpen ? (params.entry === "new" || (editing && canEditDailyLog(editing, actor.member_id, actor.is_admin)) ?
      <DailyLogForm entry={editing} basePath={basePath} /> : <div role="alert" className="space-y-3"><p>Entry unavailable or editing is not permitted.</p><Link href={basePath} className="inline-flex min-h-12 items-center text-red-300">Back to history</Link></div>) : <>
      {saved && <section aria-label="Saved entry" className="space-y-3"><p role="status" className="text-green-300">Daily Log saved. Your entry is shown below.</p>{renderEntry(saved)}</section>}
      <form action={basePath} className="flex flex-wrap gap-2">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Search Daily Log</span><Search className="pointer-events-none absolute left-3 top-4 h-5 w-5 text-neutral-400" /><input name="q" defaultValue={query} placeholder="Search activity, location, unit, or date" className="min-h-12 w-full rounded-xl border border-white/20 bg-neutral-900 py-3 pl-10 pr-3 text-base" /></label>
        <button className="min-h-12 rounded-xl border border-white/20 px-4">Search</button>
        {query && <Link href={basePath} className="inline-flex min-h-12 items-center px-3 text-neutral-300">Clear</Link>}
      </form>
      <p className="text-xs text-neutral-400">Newest dates first; undated entries follow dated entries, newest creation first. Search dates as MM/DD/YYYY or YYYY-MM-DD.</p>
      <section aria-label="Daily Log history" className="space-y-4">{entries.length ? entries.slice(0, 50).map(renderEntry) : <p className="rounded-xl border border-white/10 p-6 text-neutral-400">{query ? "No entries match your search." : "No Daily Log entries yet."}</p>}</section>
      <nav aria-label="Daily Log pages" className="flex justify-between gap-4">
        {page > 1 ? <Link className="inline-flex min-h-12 items-center text-red-300" href={historyHref(page - 1)}>Previous</Link> : <span />}
        {entries.length > 50 && <Link className="inline-flex min-h-12 items-center text-red-300" href={historyHref(page + 1)}>Next</Link>}
      </nav>
    </>}
  </div>;
  return mobile ? <main className="min-h-screen bg-[#080808] px-4 py-5 text-white sm:px-6">{content}</main> : <PageLayout>{content}</PageLayout>;
}
