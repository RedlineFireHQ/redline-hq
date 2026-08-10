"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { supabase } from "@/lib/supabase";

type MemberOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export default function ResolveDeficiencyPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const deficiencyId = params.id;

  const [repairNotes, setRepairNotes] = useState("");
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [selectedResolvedByMemberId, setSelectedResolvedByMemberId] = useState("");
  const [resolvedStatusId, setResolvedStatusId] = useState("");
  const [deficiencyApparatusId, setDeficiencyApparatusId] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createMaintenanceAfterResolve, setCreateMaintenanceAfterResolve] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
      setIsLoadingContext(true);
      setErrorMessage(null);

      const [membersResult, statusesResult, deficiencyResult] = await Promise.all([
        supabase.from("members").select("id, first_name, last_name").order("last_name").order("first_name"),
        supabase.from("deficiency_statuses").select("id, name").order("display_order"),
        supabase.from("deficiencies").select("id, apparatus_id").eq("id", deficiencyId).maybeSingle(),
      ]);

      if (!isMounted) {
        return;
      }

      if (membersResult.error || statusesResult.error || deficiencyResult.error) {
        setErrorMessage(
          membersResult.error?.message ||
            statusesResult.error?.message ||
            deficiencyResult.error?.message ||
            "Unable to load resolve workflow context."
        );
        setIsLoadingContext(false);
        return;
      }

      const normalizedMembers: MemberOption[] = (membersResult.data ?? []).map((memberRow) => {
        const row = memberRow as Record<string, unknown>;
        return {
          id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
          first_name: typeof row.first_name === "string" ? row.first_name : null,
          last_name: typeof row.last_name === "string" ? row.last_name : null,
        };
      });

      const resolvedStatus = (statusesResult.data ?? []).find((statusRecord) => {
        const nameValue = (statusRecord as { name?: unknown }).name;
        return typeof nameValue === "string" && nameValue.trim().toLowerCase() === "resolved";
      });

      const statusIdValue = (resolvedStatus as { id?: unknown } | undefined)?.id;
      const resolvedId = typeof statusIdValue === "string" ? statusIdValue : "";

      const apparatusIdValue = (deficiencyResult.data as { apparatus_id?: unknown } | null)?.apparatus_id;
      const apparatusId = typeof apparatusIdValue === "string" ? apparatusIdValue : null;

      if (normalizedMembers.length === 0) {
        setErrorMessage("Unable to resolve deficiency: no members available.");
        setIsLoadingContext(false);
        return;
      }

      if (!resolvedId) {
        setErrorMessage("Unable to resolve deficiency: Resolved status is unavailable.");
        setIsLoadingContext(false);
        return;
      }

      setMemberOptions(normalizedMembers);
      setResolvedStatusId(resolvedId);
      setDeficiencyApparatusId(apparatusId);
      setIsLoadingContext(false);
    }

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [deficiencyId]);

  async function handleResolve() {
    if (!resolvedStatusId || !selectedResolvedByMemberId) {
      setErrorMessage("Select who resolved this deficiency.");
      return;
    }

    setIsResolving(true);
    setErrorMessage(null);

    const now = new Date().toISOString();
    const updatePayload = {
      status: resolvedStatusId,
      resolved_by: selectedResolvedByMemberId,
      resolved_at: now,
      repair_notes: repairNotes.trim() || null,
      updated_at: now,
    };

    const updateResult = await supabase.from("deficiencies").update(updatePayload).eq("id", deficiencyId);

    if (updateResult.error) {
      setErrorMessage(updateResult.error.message);
      setIsResolving(false);
      return;
    }

    await supabase.from("deficiency_history").insert({
      deficiency_id: deficiencyId,
      member_id: selectedResolvedByMemberId,
      event_type: "Resolved",
      event_description: `Resolved. ${repairNotes}`,
    });

    const { data: deficiencyLinkRow, error: deficiencyLinkError } = await supabase
      .from("deficiencies")
      .select("fire_hose_id")
      .eq("id", deficiencyId)
      .maybeSingle();

    if (deficiencyLinkError) {
      console.error("[fire-hose][deficiency-resolve] failed to read deficiency fire_hose_id link", {
        deficiencyId,
        error: deficiencyLinkError,
      });
      setErrorMessage(deficiencyLinkError.message || "Unable to verify linked fire hose.");
      setIsResolving(false);
      return;
    }

    if (deficiencyLinkRow?.fire_hose_id) {
      const linkedHoseId = deficiencyLinkRow.fire_hose_id;

      const { data: linkedDeficiencies, error: linkedDeficienciesError } = await supabase
        .from("deficiencies")
        .select("id, status_info:deficiency_statuses!fk_deficiencies_status(name)")
        .eq("fire_hose_id", linkedHoseId);

      if (linkedDeficienciesError) {
        console.error("[fire-hose][deficiency-resolve] failed to read linked deficiencies", {
          deficiencyId,
          linkedHoseId,
          error: linkedDeficienciesError,
        });
        setErrorMessage(linkedDeficienciesError.message || "Unable to verify linked deficiencies.");
        setIsResolving(false);
        return;
      }

      if ((linkedDeficiencies ?? []).length > 0) {
        const unresolvedCount = (linkedDeficiencies ?? []).reduce((count, row) => {
          const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
          const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
          const isUnresolved = statusName !== "resolved" && statusName !== "closed";
          return isUnresolved ? count + 1 : count;
        }, 0);

        if (unresolvedCount === 0) {
          const { data: hoseUpdateRow, error: hoseUpdateError } = await supabase
            .from("fire_hose")
            .update({ status: "Ready" })
            .eq("id", linkedHoseId)
            .select("id, status")
            .single();

          if (hoseUpdateError || !hoseUpdateRow || hoseUpdateRow.id !== linkedHoseId) {
            console.error("[fire-hose][deficiency-resolve] fire_hose ready-status update mismatch", {
              expectedHoseId: linkedHoseId,
              actualRow: hoseUpdateRow ?? null,
              error: hoseUpdateError ?? null,
            });
            setErrorMessage(hoseUpdateError?.message || "Unable to update linked fire hose status.");
            setIsResolving(false);
            return;
          }
        }
      }
    }

    setIsResolving(false);

    if (createMaintenanceAfterResolve) {
      const query = new URLSearchParams({ deficiencyId });
      if (deficiencyApparatusId) {
        query.set("apparatusId", deficiencyApparatusId);
      }
      router.push(`/maintenance/perform?${query.toString()}`);
      return;
    }

    router.push(`/operations/deficiencies/${deficiencyId}`);
    router.refresh();
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href={`/operations/deficiencies/${deficiencyId}`}
          className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
        >
          Back to Deficiency
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">Deficiency Workflow</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Resolve Deficiency</h1>
          <p className="mt-2 text-zinc-400">Capture repair completion details and close this deficiency.</p>

          <div className="mt-8 space-y-6">
            {errorMessage ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</div>
            ) : null}

            {isLoadingContext ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">Loading resolve details...</div>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-zinc-200">Repair Notes</span>
                  <textarea
                    rows={5}
                    value={repairNotes}
                    onChange={(event) => setRepairNotes(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                    placeholder="Describe what was repaired and any follow-up actions."
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-zinc-200">Resolved By</span>
                  <select
                    value={selectedResolvedByMemberId}
                    onChange={(event) => setSelectedResolvedByMemberId(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-zinc-300"
                  >
                    <option value="">Select member</option>
                    {memberOptions.map((member) => {
                      const firstName = member.first_name ?? "";
                      const lastName = member.last_name ?? "";
                      const fullName = `${firstName} ${lastName}`.trim() || member.id;

                      return (
                        <option key={member.id} value={member.id}>{fullName}</option>
                      );
                    })}
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#151515] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={createMaintenanceAfterResolve}
                    onChange={(event) => setCreateMaintenanceAfterResolve(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-[#121212] text-emerald-500"
                  />
                  <span className="text-sm text-zinc-200">Perform Maintenance after resolving</span>
                </label>
              </>
            )}
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-white/10 pt-6">
            <Link
              href={`/operations/deficiencies/${deficiencyId}`}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleResolve}
              disabled={isResolving || isLoadingContext || !selectedResolvedByMemberId}
              className="rounded-xl border border-emerald-500/30 bg-emerald-600/80 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResolving ? "Resolving..." : "Resolve Deficiency"}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
