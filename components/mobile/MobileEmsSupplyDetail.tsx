"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, MapPin } from "lucide-react";
import {
  displayUnit,
  formatNumber,
  statusClasses,
  statusLabel,
  stockStatus,
  type RecentActivity,
  type SupplyItem,
} from "./MobileEmsSupplies";

type Props = { supplyId: string; canAudit: boolean };

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ActivityRow({
  activity,
  unit,
}: {
  activity: RecentActivity;
  unit: string;
}) {
  const direction = activity.quantityDelta > 0 ? "+" : "";
  return (
    <li className="rounded-2xl border border-white/10 bg-[#121212] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">
            {activity.transactionType}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {formatActivityDate(activity.occurredAt)} · {activity.performerName}
          </p>
        </div>
        <span className="text-sm font-black text-white">
          {direction}
          {formatNumber(activity.quantityDelta)} {unit}
        </span>
      </div>
      {activity.notes ? (
        <p className="mt-3 text-sm leading-5 text-white/55">{activity.notes}</p>
      ) : null}
    </li>
  );
}

export default function MobileEmsSupplyDetail({ supplyId, canAudit }: Props) {
  const [item, setItem] = useState<SupplyItem | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [physicalCount, setPhysicalCount] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [auditNotes, setAuditNotes] = useState("");
  const [auditSaving, setAuditSaving] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  async function loadDetail() {
    const response = await fetch(
      `/api/ems/supplies/${encodeURIComponent(supplyId)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      item?: SupplyItem;
      recentActivity?: RecentActivity[];
      error?: string;
    };
    if (!response.ok || !payload.ok || !payload.item)
      throw new Error(payload.error || "Unable to load this supply.");
    setItem(payload.item);
    setActivity(payload.recentActivity || []);
  }

  useEffect(() => {
    let active = true;
    loadDetail()
      .catch((requestError) => {
        if (active)
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load this supply.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [supplyId]);

  const difference =
    item &&
    physicalCount.trim() !== "" &&
    Number.isFinite(Number(physicalCount))
      ? Number(physicalCount) - Number(item.quantity_on_hand)
      : null;

  function openAudit() {
    if (!item) return;
    setPhysicalCount(String(item.quantity_on_hand));
    setAuditReason("");
    setAuditNotes("");
    setAuditError(null);
    setAuditOpen(true);
  }

  async function saveAudit() {
    if (!item) return;
    const count = Number(physicalCount);
    if (!Number.isInteger(count) || count < 0)
      return setAuditError("Enter a whole number of units.");
    if (!auditReason.trim()) return setAuditError("Reason is required.");
    setAuditSaving(true);
    setAuditError(null);
    try {
      const response = await fetch("/api/ems/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transactionType: "Correction",
          supplyItemId: item.id,
          newQuantity: count,
          reason: auditReason.trim(),
          notes: auditNotes.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "Unable to save audit.");
      setAuditOpen(false);
      await loadDetail();
    } catch (saveError) {
      setAuditError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save audit.",
      );
    } finally {
      setAuditSaving(false);
    }
  }

  if (loading)
    return (
      <main className="min-h-screen bg-[#080808] px-4 py-5 text-white">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/mobile/ems-supplies"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/60"
          >
            <ArrowLeft className="h-4 w-4" />
            EMS Supplies
          </Link>
          <div className="mt-5 rounded-2xl border border-white/10 bg-[#121212] p-5 text-sm text-white/55">
            Loading supply...
          </div>
        </div>
      </main>
    );
  if (error || !item)
    return (
      <main className="min-h-screen bg-[#080808] px-4 py-5 text-white">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/mobile/ems-supplies"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/60"
          >
            <ArrowLeft className="h-4 w-4" />
            EMS Supplies
          </Link>
          <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm font-bold text-red-100">
            {error || "Supply not found."}
          </div>
        </div>
      </main>
    );

  const status = stockStatus(item);
  const unit = displayUnit(item);
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080808] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4 pb-4">
        <Link
          href="/mobile/ems-supplies"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/60"
        >
          <ArrowLeft className="h-4 w-4" />
          EMS Supplies
        </Link>
        <header className="rounded-[24px] border border-white/12 bg-[linear-gradient(145deg,rgba(37,21,22,0.98),rgba(12,12,12,0.98))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.38)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6565]">
            {item.item_category || "EMS supply"}
          </p>
          <h1 className="mt-2 break-words text-3xl font-black tracking-tight">
            {item.item_name}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusClasses(status)}`}
            >
              {statusLabel(status)}
            </span>
            {item.location ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-white/55">
                <MapPin className="h-4 w-4" />
                {item.location}
              </span>
            ) : null}
          </div>
        </header>
        <section className="rounded-[20px] border border-white/10 bg-[#121212] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
            Current stock
          </p>
          <p className="mt-2 text-4xl font-black text-white">
            {formatNumber(item.quantity_on_hand)}{" "}
            <span className="text-lg text-white/55">{unit}</span>
          </p>
        </section>
        <div className="space-y-3">
          <Link
            href={`/mobile/ems-supplies?manual=${encodeURIComponent(item.id)}`}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-wide text-white"
          >
            Add to Checkout
          </Link>
          {canAudit ? (
            <button
              type="button"
              onClick={openAudit}
              className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-wide text-white/80"
            >
              Audit Quantity
            </button>
          ) : null}
        </div>
        {item.notes ? (
          <section className="rounded-[20px] border border-white/10 bg-[#121212] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
              Notes
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">
              {item.notes}
            </p>
          </section>
        ) : null}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ClipboardList className="h-4 w-4 text-[#ef2b2d]" />
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
              Recent activity
            </h2>
          </div>
          {activity.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#121212] p-5 text-sm text-white/50">
              No activity has been recorded for this supply.
            </div>
          ) : (
            <ul className="space-y-3">
              {activity.map((row) => (
                <ActivityRow key={row.id} activity={row} unit={unit} />
              ))}
            </ul>
          )}
        </section>
        {auditOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center">
            <section className="w-full max-w-2xl rounded-[24px] border border-white/12 bg-[#111111] p-5">
              <h2 className="text-2xl font-black">Audit Quantity</h2>
              {auditError ? (
                <p className="mt-4 text-sm font-bold text-red-100">
                  {auditError}
                </p>
              ) : null}
              <div className="mt-5 space-y-4">
                <p className="font-black">
                  System Quantity: {formatNumber(item.quantity_on_hand)} {unit}
                </p>
                <label className="block text-sm font-black">
                  Physical Count
                  <input
                    value={physicalCount}
                    onChange={(event) => setPhysicalCount(event.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white"
                  />
                </label>
                <p className="font-black">
                  Difference:{" "}
                  {difference === null
                    ? "-"
                    : `${difference > 0 ? "+" : ""}${difference} ${unit}`}
                </p>
                <label className="block text-sm font-black">
                  Reason
                  <input
                    value={auditReason}
                    onChange={(event) => setAuditReason(event.target.value)}
                    className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white"
                  />
                </label>
                <label className="block text-sm font-black">
                  Notes
                  <textarea
                    value={auditNotes}
                    onChange={(event) => setAuditNotes(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-[#080808] p-4 text-base text-white"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAuditOpen(false)}
                    className="min-h-14 flex-1 rounded-2xl border border-white/15 font-black"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveAudit()}
                    disabled={auditSaving}
                    className="min-h-14 flex-1 rounded-2xl bg-[#ef2b2d] font-black"
                  >
                    {auditSaving ? "Saving..." : "Save Audit"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
