"use client";

import { useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type HelperParticipant = {
  memberId: string;
  name: string;
};

type InspectionHelpersPanelProps = {
  departmentId: string;
  currentMemberId: string;
  activeCheckSessionId: string;
  helperParticipants: HelperParticipant[];
  availableHelpers: HelperParticipant[];
  helperErrorMessage: string | null;
  initialSearch: string;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function sortHelpersByName(items: HelperParticipant[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

export default function InspectionHelpersPanel({
  departmentId,
  currentMemberId,
  activeCheckSessionId,
  helperParticipants,
  availableHelpers,
  helperErrorMessage,
  initialSearch,
}: InspectionHelpersPanelProps) {
  const [search, setSearch] = useState(initialSearch);
  const [currentHelpers, setCurrentHelpers] = useState(helperParticipants);
  const [availableMemberOptions, setAvailableMemberOptions] = useState(availableHelpers);
  const [actionError, setActionError] = useState(helperErrorMessage);
  const [pendingAction, setPendingAction] = useState<{ memberId: string; action: "add" | "remove" } | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const filteredAvailableHelpers = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    if (!normalizedSearch) {
      return availableMemberOptions;
    }

    return availableMemberOptions.filter((member) => normalizeText(member.name).includes(normalizedSearch));
  }, [availableMemberOptions, search]);

  async function handleAdd(member: HelperParticipant) {
    setPendingAction({ memberId: member.memberId, action: "add" });
    setActionError(null);

    const { error } = await supabase
      .from("apparatus_check_session_members")
      .upsert(
        [
          {
            session_id: activeCheckSessionId,
            department_id: departmentId,
            member_id: member.memberId,
            added_by_member_id: currentMemberId,
          },
        ],
        {
          onConflict: "session_id,member_id",
          ignoreDuplicates: true,
        },
      );

    if (error) {
      setActionError(error.message || "Unable to add helper participant.");
      setPendingAction(null);
      return;
    }

    setCurrentHelpers((current) => [...current, member]);
    setAvailableMemberOptions((current) => current.filter((item) => item.memberId !== member.memberId));
    setSearch("");
    setPendingAction(null);
    searchInputRef.current?.focus();
  }

  async function handleRemove(helper: HelperParticipant) {
    setPendingAction({ memberId: helper.memberId, action: "remove" });
    setActionError(null);

    const { error } = await supabase
      .from("apparatus_check_session_members")
      .delete()
      .eq("session_id", activeCheckSessionId)
      .eq("member_id", helper.memberId);

    if (error) {
      setActionError(error.message || "Unable to remove helper participant.");
      setPendingAction(null);
      return;
    }

    setCurrentHelpers((current) => current.filter((item) => item.memberId !== helper.memberId));
    setAvailableMemberOptions((current) => sortHelpersByName([...current, helper]));
    setPendingAction(null);
    searchInputRef.current?.focus();
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Participants</p>
          <h3 className="mt-1 text-lg font-bold text-white">Inspection Helpers</h3>
          <p className="mt-1 text-sm text-neutral-400">
            Add firefighters who are helping with this apparatus check so they receive participation credit.
          </p>
        </div>
        <p className="rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-300">
          {helperParticipants.length + 1} Total Participants
        </p>
      </div>

      {actionError ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {actionError}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-700 bg-[#1B1B1B] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Current Helpers</p>
          {currentHelpers.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">No helpers added yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {currentHelpers.map((helper) => (
                <div
                  key={helper.memberId}
                  className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
                >
                  <p className="text-sm text-neutral-200">{`\u2713 ${helper.name}`}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void handleRemove(helper);
                    }}
                    disabled={pendingAction?.memberId === helper.memberId}
                    className="rounded-md border border-neutral-600 px-2 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800"
                  >
                    {pendingAction?.memberId === helper.memberId && pendingAction.action === "remove" ? "Removing..." : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-700 bg-[#1B1B1B] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Available Members</p>
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members..."
            className="mt-3 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
          />

          {availableMemberOptions.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">All available members are already added.</p>
          ) : filteredAvailableHelpers.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">No members match that search.</p>
          ) : (
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
              {filteredAvailableHelpers.map((member) => (
                <div
                  key={member.memberId}
                  className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
                >
                  <p className="text-sm text-neutral-200">{member.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void handleAdd(member);
                    }}
                    disabled={pendingAction?.memberId === member.memberId}
                    className="rounded-md border border-neutral-600 px-2 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800"
                  >
                    {pendingAction?.memberId === member.memberId && pendingAction.action === "add" ? "Adding..." : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}