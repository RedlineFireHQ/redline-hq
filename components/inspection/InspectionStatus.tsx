"use client";

import { useState } from "react";

type ReadinessStatus = "ready" | "deficiency" | "out";

export default function InspectionStatus() {
  const [status, setStatus] = useState<ReadinessStatus | null>(null);
  const [deficiency, setDeficiency] = useState("");

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
          Daily Readiness
        </p>

        <h2 className="mt-2 text-3xl font-bold text-white">
          Is this apparatus ready for service?
        </h2>

        <p className="mt-2 text-neutral-400">
          Select the operational status of this apparatus.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <button
          onClick={() => setStatus("ready")}
          className={`rounded-xl border p-6 text-left transition ${
            status === "ready"
              ? "border-green-500 bg-green-900/20"
              : "border-neutral-700 hover:border-green-500"
          }`}
        >
          <div className="text-3xl">🟢</div>

          <h3 className="mt-4 text-xl font-bold text-white">
            Ready for Service
          </h3>

          <p className="mt-2 text-sm text-neutral-400">
            Apparatus is fully operational.
          </p>
        </button>

        <button
          onClick={() => setStatus("deficiency")}
          className={`rounded-xl border p-6 text-left transition ${
            status === "deficiency"
              ? "border-yellow-500 bg-yellow-900/20"
              : "border-neutral-700 hover:border-yellow-500"
          }`}
        >
          <div className="text-3xl">🟡</div>

          <h3 className="mt-4 text-xl font-bold text-white">
            Ready with Deficiency
          </h3>

          <p className="mt-2 text-sm text-neutral-400">
            Apparatus remains in service but needs attention.
          </p>
        </button>

        <button
          onClick={() => setStatus("out")}
          className={`rounded-xl border p-6 text-left transition ${
            status === "out"
              ? "border-red-500 bg-red-900/20"
              : "border-neutral-700 hover:border-red-500"
          }`}
        >
          <div className="text-3xl">🔴</div>

          <h3 className="mt-4 text-xl font-bold text-white">
            Out of Service
          </h3>

          <p className="mt-2 text-sm text-neutral-400">
            Apparatus cannot respond safely.
          </p>
        </button>
      </div>

      {(status === "deficiency" || status === "out") && (
        <div className="mt-8 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h3 className="text-xl font-bold text-white">
            Describe the Issue
          </h3>

          <p className="mt-2 text-neutral-400">
            Briefly describe the deficiency found during the readiness check.
          </p>

          <textarea
            rows={5}
            value={deficiency}
            onChange={(e) => setDeficiency(e.target.value)}
            placeholder="Example: Driver-side warning light is inoperative."
            className="mt-4 w-full rounded-xl border border-neutral-700 bg-[#1B1B1B] p-4 text-white outline-none"
          />
        </div>
      )}

      {status === "ready" && (
        <div className="mt-8 rounded-xl border border-green-700 bg-green-900/20 p-6">
          <h3 className="text-xl font-bold text-green-300">
            Ready for Service
          </h3>

          <p className="mt-2 text-green-100">
            No deficiencies were reported. This apparatus is operational.
          </p>
        </div>
      )}
    </div>
  );
}