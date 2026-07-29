"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface DailyCheckFormProps {
  apparatusId: string;
}

export default function DailyCheckForm({
  apparatusId,
}: DailyCheckFormProps) {
  const [status, setStatus] = useState<
    "ready" | "needs_attention" | "out_of_service"
  >("ready");

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("save_apparatus_inspection", {
      p_apparatus_id: apparatusId,
      p_status: status,
      p_notes: notes || null,
    });

    if (error) {
      console.error(error);
      setMessage(`❌ ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("✅ Inspection saved successfully.");
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8">
      <h2 className="text-2xl font-bold text-white">
        Inspection Result
      </h2>

      <p className="mt-2 text-neutral-400">
        Select the apparatus status after completing the inspection.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setStatus("ready")}
          className={`rounded-xl px-6 py-5 font-bold transition ${
            status === "ready"
              ? "bg-green-700 text-white ring-4 ring-green-400"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          🟢 Ready for Service
        </button>

        <button
          type="button"
          onClick={() => setStatus("needs_attention")}
          className={`rounded-xl px-6 py-5 font-bold transition ${
            status === "needs_attention"
              ? "bg-yellow-400 text-black ring-4 ring-yellow-300"
              : "bg-yellow-500 text-black hover:bg-yellow-400"
          }`}
        >
          🟡 Needs Attention
        </button>

        <button
          type="button"
          onClick={() => setStatus("out_of_service")}
          className={`rounded-xl px-6 py-5 font-bold transition ${
            status === "out_of_service"
              ? "bg-red-700 text-white ring-4 ring-red-400"
              : "bg-red-600 text-white hover:bg-red-700"
          }`}
        >
          🔴 Out of Service
        </button>
      </div>

      <textarea
        rows={5}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Inspection notes..."
        className="mt-8 w-full rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-white outline-none"
      />

      {message && (
        <div className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-white">
          {message}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-8 w-full rounded-xl bg-red-600 py-4 text-lg font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Inspection"}
      </button>
    </div>
  );
}