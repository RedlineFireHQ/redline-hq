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

function getMemberDisplayName(member: MemberOption): string {
  const firstName = member.first_name?.trim() ?? "";
  const lastName = member.last_name?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "Unnamed Member";
}

export default function AssignRepairPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const deficiencyId = params.id;

  const [members, setMembers] = useState<MemberOption[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMembers() {
      setIsLoadingMembers(true);
      setMembersError(null);

      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        setMembersError("Unable to load members right now.");
        setMembers([]);
        setIsLoadingMembers(false);
        return;
      }

      const normalizedMembers = (data ?? []).map((record) => {
        const row = record as Record<string, unknown>;
        return {
          id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
          first_name: typeof row.first_name === "string" ? row.first_name : null,
          last_name: typeof row.last_name === "string" ? row.last_name : null,
        } as MemberOption;
      });

      setMembers(normalizedMembers);
      setIsLoadingMembers(false);
    }

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleAssign() {
    if (!selectedMemberId) {
      setAssignError("Select a member before assigning.");
      return;
    }

    setIsAssigning(true);
    setAssignError(null);

    const updateResult = await supabase
      .from("deficiencies")
      .update({ assigned_to: selectedMemberId })
      .eq("id", deficiencyId)
      .select("id, assigned_to");

    if (updateResult.error) {
      setAssignError("Unable to assign repair right now.");
      setIsAssigning(false);
      return;
    }

    const selectedMember = members.find((member) => member.id === selectedMemberId);
    const selectedMemberName = selectedMember ? getMemberDisplayName(selectedMember) : "Unknown member";

    await supabase.from("deficiency_history").insert({
      deficiency_id: deficiencyId,
      member_id: selectedMemberId,
      event_type: "Assigned",
      event_description: `Assigned to ${selectedMemberName}.`,
    });

    setIsAssigning(false);
    router.push(`/operations/deficiencies/${deficiencyId}`);
    router.refresh();
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href={`/operations/deficiencies/${deficiencyId}`}
          className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
        >
          Back to Deficiency
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">Deficiency Workflow</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Assign Repair</h1>
          <p className="mt-2 text-zinc-400">Assign this repair to a firefighter within the standard application layout.</p>

          <div className="mt-8 space-y-5">
            {membersError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{membersError}</div>
            ) : null}

            {assignError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{assignError}</div>
            ) : null}

            {isLoadingMembers ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">Loading members...</div>
            ) : (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Member</span>
                <select
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                >
                  <option value="">Select firefighter</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{getMemberDisplayName(member)}</option>
                  ))}
                </select>
              </label>
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
              onClick={handleAssign}
              disabled={isAssigning || isLoadingMembers}
              className="rounded-xl border border-red-500/30 bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAssigning ? "Assigning..." : "Assign Repair"}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
