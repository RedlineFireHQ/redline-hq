"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DeficiencyResolutionSettingsSection({
  departmentId,
  initialRestricted,
}: {
  departmentId: string;
  initialRestricted: boolean;
}) {
  const router = useRouter();
  const [restricted, setRestricted] = useState(initialRestricted);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(nextRestricted: boolean) {
    setIsSaving(true);
    setError(null);

    const { error: saveError } = await supabase.rpc("set_restrict_deficiency_resolution", {
      p_department_id: departmentId,
      p_restricted: nextRestricted,
    });

    if (saveError) {
      setError(saveError.message || "Unable to save deficiency resolution settings.");
    } else {
      setRestricted(nextRestricted);
      router.refresh();
    }

    setIsSaving(false);
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="border-b border-neutral-800 pb-5">
        <h2 className="text-2xl font-semibold text-white">Deficiency Resolution</h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Turn this on if you want only members with special permission to resolve deficiencies.
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <label className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <span>
          <span className="block text-sm font-semibold text-white">RESTRICT DEFICIENCY RESOLUTION</span>
          <span className="mt-2 block text-sm text-neutral-400">
            {restricted
              ? "ON - Only members with Deficiency Resolution permission can resolve deficiencies"
              : "OFF - Everyone can resolve deficiencies"}
          </span>
        </span>
        <input
          type="checkbox"
          checked={restricted}
          disabled={isSaving}
          onChange={(event) => void handleChange(event.target.checked)}
          className="mt-1 h-5 w-5 accent-red-500"
        />
      </label>
    </section>
  );
}
