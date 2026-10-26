import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DeletePediatricInspectionButton from "@/components/inventory/DeletePediatricInspectionButton";
import EmsInventorySwitch from "@/components/inventory/EmsInventorySwitch";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getPediatricInspectionDetail } from "@/lib/pediatric-bags/data";

interface PediatricHistoryDetailProps {
  params: Promise<{ inspectionId: string }>;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  if (status === "ready") return "Ready for Service";
  if (status === "needs_attention") return "Items Expired";
  if (status === "out_of_service") return "Out of Service";
  return status;
}

function itemStatusLabel(status: string) {
  if (status === "checked") return "PASS";
  if (status === "expired") return "EXPIRED";
  return status;
}

export default async function PediatricHistoryDetailPage({ params }: PediatricHistoryDetailProps) {
  const { inspectionId } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const result = await getPediatricInspectionDetail(supabase, inspectionId, currentMember.departmentId);

  if (result.status === "not_found") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <EmsInventorySwitch activeView="pediatric-bags" />

      {result.status === "missing_schema" ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6">
          <p className="text-sm font-semibold text-amber-200">Pediatric Bags are not set up yet.</p>
          <Link
            href="/inventory/ems-pediatric-bags"
            className="mt-4 inline-flex rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to Pediatric Bags
          </Link>
        </section>
      ) : result.status === "forbidden" ? (
        <section className="rounded-xl border border-red-500/30 bg-red-950/20 p-6">
          <p className="text-sm font-semibold text-red-200">You do not have access to this inspection.</p>
          <Link
            href="/inventory/ems-pediatric-bags"
            className="mt-4 inline-flex rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to Pediatric Bags
          </Link>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Inspection Record</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
                Pediatric Bag {result.inspection.bagLabel}
              </h1>
              <p className="mt-2 text-sm text-neutral-300">
                Completed {formatDateTime(result.inspection.createdAt)} — this is a permanent, read-only record.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {currentMember.role === "administrator" ? (
                <DeletePediatricInspectionButton
                  inspectionId={result.inspection.id}
                  bagLabel={result.inspection.bagLabel}
                  redirectAfterDelete="/inventory/ems-supplies?view=pediatric-bags"
                />
              ) : null}
              <Link
                href="/inventory/ems-pediatric-bags"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
              >
                Back to Pediatric Bags
              </Link>
            </div>
          </div>

          <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
            <h2 className="text-xl font-bold text-white">Completion Details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Result</dt>
                <dd className="mt-1 text-sm font-semibold text-white">{statusLabel(result.inspection.status)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Date / Time</dt>
                <dd className="mt-1 text-sm font-semibold text-white">{formatDateTime(result.inspection.createdAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Personnel</dt>
                <dd className="mt-1 text-sm font-semibold text-white">{result.personnel.join(", ")}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
            <h2 className="text-xl font-bold text-white">Checklist Snapshot</h2>
            <p className="mt-1 text-sm text-neutral-400">Exactly as recorded at inspection time.</p>
            <div className="mt-4 space-y-2">
              {result.results.map((item, index) => (
                <div
                  key={`${item.itemLabel}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{item.itemLabel}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {item.sectionName}
                      {item.requiredQuantity !== null ? ` · Qty: ${item.requiredQuantity}` : ""}
                      {item.sourceQuantityText ? ` · Source: ${item.sourceQuantityText}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-neutral-200">
                    {itemStatusLabel(item.resultStatus)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
