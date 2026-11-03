"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveDailyLog } from "@/app/daily-log/actions";

export default function ArchiveDailyLog({ id, version }: { id: string; version: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      {!confirming ? <button className="min-h-11 px-3 text-sm text-neutral-400 hover:text-white" onClick={() => setConfirming(true)}>Archive</button> : (
        <div className="space-y-2 rounded-xl border border-white/20 p-3">
          <p className="text-sm text-neutral-300">Remove from history? The entry will be retained internally.</p>
          <div className="flex gap-3">
            <button disabled={pending} className="min-h-11 rounded-lg bg-red-700 px-3 text-sm disabled:opacity-50" onClick={async () => {
              setPending(true);
              setError("");
              try {
                const result = await archiveDailyLog(id, version);
                if (result.error) setError(result.error);
                else { setConfirming(false); router.refresh(); }
              } catch { setError("Unable to archive. Check your connection and try again."); }
              finally { setPending(false); }
            }}>{pending ? "Archiving..." : "Confirm archive"}</button>
            <button disabled={pending} className="min-h-11 px-3 text-sm" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
