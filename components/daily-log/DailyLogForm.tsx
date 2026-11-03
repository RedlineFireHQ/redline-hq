"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDailyLog } from "@/app/daily-log/actions";
import { dailyLogDefaults, type DailyLogEntry, type DailyLogFields } from "@/lib/daily-log";

export default function DailyLogForm({ entry, basePath }: { entry: DailyLogEntry | null; basePath: string }) {
  const router = useRouter();
  const [fields, setFields] = useState<DailyLogFields>(() => entry ?? dailyLogDefaults());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function update(key: keyof DailyLogFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }
  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-neutral-950 px-3 py-3 text-base text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
  return (
    <form className="space-y-5 rounded-2xl border border-white/10 bg-neutral-900 p-4 sm:p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        try {
          const result = await saveDailyLog(fields, entry?.id ?? null, entry ? entry.edited_at ?? entry.created_at : null);
          if (result.error) { setError(result.error); return; }
          router.push(`${basePath}?saved=${result.id}`);
          router.refresh();
        } catch {
          setError("Unable to save Daily Log. Check your connection and try again.");
        } finally { setSaving(false); }
      }}>
      <h2 className="text-xl font-semibold">{entry ? "Edit Daily Log" : "Add Daily Log"}</h2>
      <p className="text-sm text-neutral-400">All five fields are optional.</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">Date
          <input type="date" name="date" className={inputClass} value={fields.entry_date ?? ""} onChange={(e) => update("entry_date", e.target.value)} />
        </label>
        <label className="block text-sm font-medium">Time
          <input type="time" name="time" step="1" className={inputClass} value={fields.entry_time ?? ""} onChange={(e) => update("entry_time", e.target.value)} />
        </label>
      </div>
      <label className="block text-sm font-medium">Location
        <input name="location" className={inputClass} value={fields.location ?? ""} onChange={(e) => update("location", e.target.value)} />
      </label>
      <label className="block text-sm font-medium">Activity
        <textarea name="activity" rows={12} className={`${inputClass} min-h-64 resize-y`} value={fields.activity ?? ""} onChange={(e) => update("activity", e.target.value)} />
      </label>
      <label className="block text-sm font-medium">Unit
        <input name="unit" className={inputClass} value={fields.unit ?? ""} onChange={(e) => update("unit", e.target.value)} />
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-red-200">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={saving} className="min-h-12 rounded-xl bg-[#EF2B2D] px-6 font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
        <Link href={basePath} className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-6">Cancel</Link>
      </div>
    </form>
  );
}
