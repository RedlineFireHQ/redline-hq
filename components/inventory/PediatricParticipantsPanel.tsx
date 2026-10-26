"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type PediatricParticipant = {
  memberId: string;
  name: string;
};

type PediatricParticipantsPanelProps = {
  departmentId: string;
  sessionId: string;
  currentMemberId: string;
  currentMemberName: string;
  initialParticipants: PediatricParticipant[];
  availableMembers: PediatricParticipant[];
};

/**
 * Participating-personnel picker for a pediatric bag check. Mirrors the
 * apparatus InspectionHelpersPanel pattern. The logged-in inspector is always
 * recorded; this adds other personnel who helped. Writes go to
 * pediatric_bag_check_session_members, scoped to the active department.
 */
export default function PediatricParticipantsPanel({
  departmentId,
  sessionId,
  currentMemberId,
  currentMemberName,
  initialParticipants,
  availableMembers,
}: PediatricParticipantsPanelProps) {
  const [participants, setParticipants] = useState<PediatricParticipant[]>(initialParticipants);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(participants.map((p) => p.memberId)), [participants]);

  const filteredAvailable = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availableMembers
      .filter((m) => !selectedIds.has(m.memberId) && m.memberId !== currentMemberId)
      .filter((m) => (term ? m.name.toLowerCase().includes(term) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availableMembers, selectedIds, currentMemberId, search]);

  async function handleAdd(member: PediatricParticipant) {
    setActionError(null);
    setPendingMemberId(member.memberId);

    const { error } = await supabase.from("pediatric_bag_check_session_members").upsert(
      [
        {
          session_id: sessionId,
          department_id: departmentId,
          member_id: member.memberId,
          added_by_member_id: currentMemberId,
        },
      ],
      { onConflict: "session_id,member_id", ignoreDuplicates: true },
    );

    if (error) {
      setActionError(error.message || "Unable to add participant.");
      setPendingMemberId(null);
      return;
    }

    setParticipants((current) => [...current, member].sort((a, b) => a.name.localeCompare(b.name)));
    setSearch("");
    setPendingMemberId(null);
  }

  async function handleRemove(member: PediatricParticipant) {
    setActionError(null);
    setPendingMemberId(member.memberId);

    const { error } = await supabase
      .from("pediatric_bag_check_session_members")
      .delete()
      .eq("session_id", sessionId)
      .eq("member_id", member.memberId);

    if (error) {
      setActionError(error.message || "Unable to remove participant.");
      setPendingMemberId(null);
      return;
    }

    setParticipants((current) => current.filter((p) => p.memberId !== member.memberId));
    setPendingMemberId(null);
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Personnel</p>
          <h3 className="mt-1 text-lg font-bold text-white">Participating Personnel</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-neutral-200">
          {participants.length + 1} Total Participants
        </span>
      </div>

      <p className="mt-3 text-sm text-neutral-300">
        Inspector: <span className="font-semibold text-white">{currentMemberName}</span> (recorded automatically)
      </p>

      {actionError ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {actionError}
        </p>
      ) : null}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Current Participants</p>
        {participants.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">No additional personnel added yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {participants.map((p) => (
              <li
                key={p.memberId}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2"
              >
                <p className="text-sm text-neutral-200">{`✓ ${p.name}`}</p>
                <button
                  type="button"
                  onClick={() => void handleRemove(p)}
                  disabled={pendingMemberId === p.memberId}
                  className="text-xs font-semibold text-neutral-400 transition hover:text-red-300 disabled:opacity-60"
                >
                  {pendingMemberId === p.memberId ? "Removing..." : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Add Personnel</p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search personnel by name"
          className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none"
        />
        {filteredAvailable.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">
            {availableMembers.filter((m) => m.memberId !== currentMemberId).length === 0
              ? "No other personnel available in this department."
              : "No matches."}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {filteredAvailable.map((member) => (
              <li
                key={member.memberId}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2"
              >
                <p className="text-sm text-neutral-200">{member.name}</p>
                <button
                  type="button"
                  onClick={() => void handleAdd(member)}
                  disabled={pendingMemberId === member.memberId}
                  className="text-xs font-semibold text-sky-300 transition hover:text-sky-200 disabled:opacity-60"
                >
                  {pendingMemberId === member.memberId ? "Adding..." : "Add"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
