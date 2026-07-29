"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OperationalStatus() {
  const [apparatus, setApparatus] = useState(0);
  const [members, setMembers] = useState(0);
  const [certificationsDue, setCertificationsDue] = useState(0);
  const [deficiencies, setDeficiencies] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    const [
      apparatusResult,
      membersResult,
      certificationsResult,
      deficienciesResult,
    ] = await Promise.all([
      supabase
        .from("apparatus")
        .select("*", { count: "exact", head: true })
        .eq("active", true),

      supabase
        .from("members")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("certifications")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("daily_checks")
        .select("*", { count: "exact", head: true })
        .eq("status", "Open"),
    ]);

    setApparatus(apparatusResult.count ?? 0);
    setMembers(membersResult.count ?? 0);
    setCertificationsDue(certificationsResult.count ?? 0);
    setDeficiencies(deficienciesResult.count ?? 0);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">
            Operational Status
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white">
            Department Overview
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Live department statistics
          </p>
        </div>

        <span className="rounded-full border border-green-700 bg-green-950 px-4 py-2 text-sm font-semibold text-green-400">
          Operational
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl bg-neutral-900 p-4">
          <p className="text-[10px] uppercase text-neutral-500">
            Apparatus
          </p>

          <p className="mt-2 text-3xl font-bold text-white">
            {apparatus}
          </p>

          <p className="text-sm text-neutral-400">
            Active
          </p>
        </div>

        <div className="rounded-xl bg-neutral-900 p-4">
          <p className="text-[10px] uppercase text-neutral-500">
            Members
          </p>

          <p className="mt-2 text-3xl font-bold text-white">
            {members}
          </p>

          <p className="text-sm text-neutral-400">
            Registered
          </p>
        </div>

        <div className="rounded-xl bg-neutral-900 p-4">
          <p className="text-[10px] uppercase text-neutral-500">
            Daily Checks
          </p>

          <p className="mt-2 text-3xl font-bold text-yellow-400">
            {deficiencies}
          </p>

          <p className="text-sm text-neutral-400">
            Open
          </p>
        </div>

        <div className="rounded-xl bg-neutral-900 p-4">
          <p className="text-[10px] uppercase text-neutral-500">
            Certifications
          </p>

          <p className="mt-2 text-3xl font-bold text-red-400">
            {certificationsDue}
          </p>

          <p className="text-sm text-neutral-400">
            Records
          </p>
        </div>
      </div>
    </div>
  );
}