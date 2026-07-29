"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Apparatus {
  id: string;
  name: string;
  type: string;
  status: string;
}

export default function ApparatusStatus() {
  const [apparatus, setApparatus] = useState<Apparatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApparatus();
  }, []);

  async function loadApparatus() {
    const { data, error } = await supabase
      .from("apparatus")
      .select("id, name, type, status")
      .eq("active", true)
      .order("name");

    if (!error && data) {
      setApparatus(data);
    }

    setLoading(false);
  }

  function statusColor(status: string) {
    switch (status.toLowerCase()) {
      case "ready":
        return "bg-green-500";

      case "inspection due":
        return "bg-yellow-400";

      case "maintenance":
        return "bg-red-500";

      default:
        return "bg-neutral-500";
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">
            Apparatus Status
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white">
            Fleet
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Live data from Supabase
          </p>
        </div>

        <div className="rounded-full bg-red-900/40 px-4 py-2">
          <span className="text-sm font-semibold text-red-300">
            {apparatus.length} Units
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-neutral-500">
          Loading apparatus...
        </div>
      ) : (
        <div className="space-y-2">
          {apparatus.map((truck) => (
            <div
              key={truck.id}
              className="flex items-center justify-between rounded-xl bg-neutral-900 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full ${statusColor(
                    truck.status
                  )}`}
                />

                <div>
                  <p className="font-semibold text-white">
                    {truck.name}
                  </p>

                  <p className="text-sm text-neutral-400">
                    {truck.status}
                  </p>
                </div>
              </div>

              <button className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-red-500 hover:text-white">
                View
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}