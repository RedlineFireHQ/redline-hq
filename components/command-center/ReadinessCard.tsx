"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ReadinessCard() {
  const [score, setScore] = useState(100);
  const [message, setMessage] = useState("Loading...");
  const [status, setStatus] = useState("Calculating...");

  useEffect(() => {
    calculateReadiness();
  }, []);

  async function calculateReadiness() {
    const [
      apparatusResult,
      dailyChecksResult,
      certificationsResult,
      membersResult,
    ] = await Promise.all([
      supabase
        .from("apparatus")
        .select("*", { count: "exact", head: true })
        .eq("active", true),

      supabase
        .from("daily_checks")
        .select("*", { count: "exact", head: true })
        .eq("status", "Open"),

      supabase
        .from("certifications")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("members")
        .select("*", { count: "exact", head: true }),
    ]);

    let readiness = 100;

    const apparatus = apparatusResult.count ?? 0;
    const members = membersResult.count ?? 0;
    const openChecks = dailyChecksResult.count ?? 0;
    const certifications = certificationsResult.count ?? 0;

    // Starter scoring model (easy to expand later)
    readiness -= openChecks * 5;

    if (apparatus === 0) readiness -= 30;
    if (members === 0) readiness -= 30;
    if (certifications === 0) readiness -= 10;

    readiness = Math.max(0, Math.min(100, readiness));

    setScore(readiness);

    if (readiness >= 90) {
      setStatus("REDLINE READY");
      setMessage(
        "Department readiness is excellent. Continue completing apparatus checks and maintaining certifications."
      );
    } else if (readiness >= 75) {
      setStatus("MISSION READY");
      setMessage(
        "Department is operational with a few opportunities for improvement."
      );
    } else if (readiness >= 60) {
      setStatus("ATTENTION NEEDED");
      setMessage(
        "Several operational areas require attention before full readiness."
      );
    } else {
      setStatus("CRITICAL");
      setMessage(
        "Immediate action is recommended to restore department readiness."
      );
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">
            Redline Readiness™
          </p>

          <h2 className="mt-3 text-5xl font-bold text-white">
            {score}%
          </h2>

          <p className="mt-2 text-2xl font-bold text-green-400">
            {status}
          </p>

          <p className="mt-4 max-w-md text-sm leading-6 text-neutral-400">
            {message}
          </p>

          <button className="mt-5 rounded-lg border border-red-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-600">
            View Breakdown
          </button>
        </div>

        <div className="flex h-40 w-40 items-center justify-center rounded-full border-[8px] border-red-600">
          <div className="text-center">
            <p className="text-5xl font-bold text-white">
              {score}%
            </p>

            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-neutral-400">
              READY
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}