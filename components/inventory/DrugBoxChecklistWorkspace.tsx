"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getDrugTemplateSections, type DrugBoxRecord } from "@/lib/drug-boxes/data";

type DrugBoxChecklistWorkspaceProps = {
  box: DrugBoxRecord;
};

/**
 * Drug Box inspection checklist. Every new inspection starts with all items
 * unchecked. Clicking an entire item card toggles it (checked → green, click
 * again → unchecked). Missing items are simply left unchecked. On save, the
 * inspection is persisted to Supabase (via the inspections API) as a permanent
 * historical snapshot and the user returns to the Drug Box overview.
 */
export default function DrugBoxChecklistWorkspace({ box }: DrugBoxChecklistWorkspaceProps) {
  const router = useRouter();
  const sections = useMemo(() => getDrugTemplateSections(), []);
  // Fresh inspection: nothing is pre-selected. Each item tracks PASS ('pass') or
  // EXPIRED ('expired'); the first click selects PASS.
  const [statusByItem, setStatusByItem] = useState<Map<string, "pass" | "expired">>(new Map());
  const [unitNumber, setUnitNumber] = useState(box.squadNumber);
  const [boxLockNumber, setBoxLockNumber] = useState("");
  const [csLockNumber, setCsLockNumber] = useState("");
  const [ezIoNumber, setEzIoNumber] = useState("");
  const [assistingText, setAssistingText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clicking a card cycles the item: unselected → PASS → EXPIRED → PASS → …
  // (it never returns to unselected after the first click).
  function toggleItem(itemId: string) {
    setStatusByItem((current) => {
      const next = new Map(current);
      const status = next.get(itemId);
      if (status === "pass") {
        next.set(itemId, "expired");
      } else {
        // unselected or expired → pass
        next.set(itemId, "pass");
      }
      return next;
    });
  }

  // N/A convenience action for the EZ-IO section: mark every EZ-IO item PASS.
  // Applies only to EZ-IO items; other sections are untouched. N/A is not a new
  // status — it simply marks those items PASS.
  function markEzIoNotApplicable() {
    setStatusByItem((current) => {
      const next = new Map(current);
      for (const section of sections) {
        if (section.sectionName !== "EZ-IO") {
          continue;
        }
        for (const item of section.items) {
          next.set(item.id, "pass");
        }
      }
      return next;
    });
  }

  async function handleComplete() {
    if (saving) {
      return;
    }
    setError(null);

    if (!unitNumber.trim()) {
      setError("Unit number is required.");
      return;
    }

    setSaving(true);
    try {
      // Persist PASS items as checked (is_checked=true). EXPIRED items are sent
      // separately so the server records them as not-present (is_checked=false).
      const passIds: string[] = [];
      const expiredIds: string[] = [];
      for (const [itemId, status] of statusByItem.entries()) {
        if (status === "pass") {
          passIds.push(itemId);
        } else {
          expiredIds.push(itemId);
        }
      }

      const response = await fetch("/api/drug-boxes/inspections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          drugBoxId: box.id,
          unitNumber: unitNumber.trim(),
          boxLockNumber: boxLockNumber.trim(),
          csLockNumber: csLockNumber.trim(),
          ezIoNumber: ezIoNumber.trim(),
          assistingPersonnel: assistingText
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
          checkedItemIds: passIds,
          expiredItemIds: expiredIds,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        setError(typeof body?.error === "string" ? body.error : "Unable to save this drug box inspection.");
        setSaving(false);
        return;
      }

      router.push("/inventory/ems-drug-box");
      router.refresh();
    } catch {
      setError("Unable to save this drug box inspection.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">Drug Box Inspection</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Squad {box.squadNumber}</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Tap each item you verify; verified items turn green.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/inventory/ems-drug-box")}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
        >
          Back to Drug Boxes
        </button>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
        <h2 className="text-xl font-bold text-white">Inspection Details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Unit #</span>
            <input
              value={unitNumber}
              onChange={(event) => setUnitNumber(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Box Lock #</span>
            <input
              value={boxLockNumber}
              onChange={(event) => setBoxLockNumber(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">CS Lock #</span>
            <input
              value={csLockNumber}
              onChange={(event) => setCsLockNumber(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">EZ-IO #</span>
            <input
              value={ezIoNumber}
              onChange={(event) => setEzIoNumber(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Assisting Personnel (optional, comma-separated)
          </span>
          <input
            value={assistingText}
            onChange={(event) => setAssistingText(event.target.value)}
            placeholder="Names of anyone who assisted"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
          />
        </label>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      {sections.map((section) => (
        <section key={section.sectionName} className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white">{section.sectionName}</h2>
            {section.sectionName === "EZ-IO" ? (
              <button
                type="button"
                onClick={markEzIoNotApplicable}
                aria-label="Mark all EZ-IO items as PASS (N/A)"
                className="rounded-lg border border-sky-500/50 bg-sky-950/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-950/50"
              >
                N/A
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
            {section.items.map((item) => {
              const status = statusByItem.get(item.id);
              const isPass = status === "pass";
              const isExpired = status === "expired";
              const stateLabel = isPass ? "PASS" : isExpired ? "EXPIRED" : "TAP TO MARK";
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isPass || isExpired}
                  aria-label={`${item.itemLabel}: ${isPass ? "marked PASS" : isExpired ? "marked EXPIRED" : "mark PASS"}`}
                  onClick={() => toggleItem(item.id)}
                  className={`rounded-lg border p-2.5 text-left transition sm:rounded-xl sm:p-4 ${
                    isPass
                      ? "border-emerald-500/60 bg-emerald-950/40 ring-1 ring-emerald-500/40"
                      : isExpired
                        ? "border-red-500/60 bg-red-950/40 ring-1 ring-red-500/40"
                        : "border-white/10 bg-[#1b1b1b] hover:border-white/25"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug text-white sm:text-base">{item.itemLabel}</p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                        isPass
                          ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200"
                          : isExpired
                            ? "border-red-500/50 bg-red-950/40 text-red-200"
                            : "border-white/15 bg-white/[0.03] text-neutral-400"
                      }`}
                    >
                      {stateLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] uppercase leading-tight tracking-[0.12em] text-neutral-400 sm:text-xs sm:tracking-[0.16em]">
                    Qty: {item.requiredQuantity}
                    {item.sourceQuantityText && item.sourceQuantityText !== String(item.requiredQuantity)
                      ? ` · ${item.sourceQuantityText}`
                      : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
        <h2 className="text-2xl font-bold text-white">Complete This Inspection</h2>
        <p className="mt-3 text-sm text-neutral-300">
          By completing this inspection, you certify that you have verified the contents of this drug box. Items left
          unchecked are recorded as not present.
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={handleComplete}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-8 py-4 text-lg font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-900/60 disabled:text-white/70"
        >
          {saving ? "Recording…" : "Complete Inspection"}
        </button>
      </section>
    </div>
  );
}
