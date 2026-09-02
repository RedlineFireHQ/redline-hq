"use client";

import { useMemo, useState } from "react";

export type RopeInspectionMemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
};

export type RopeInspectionFormValues = {
  inspectionDate: string;
  primaryInspectorMemberId: string;
  participantMemberIds: string[];
  result: "Pass" | "Fail";
  notes: string;
};

type RopeInspectionModalProps = {
  isOpen: boolean;
  ropeName: string;
  currentMemberId: string;
  currentMemberName: string;
  memberOptions: RopeInspectionMemberOption[];
  isSaving?: boolean;
  onClose: () => void;
  onSave: (values: RopeInspectionFormValues) => void;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function sortMembers(items: RopeInspectionMemberOption[]) {
  return [...items].sort((left, right) => {
    const leftFirst = left.firstName.trim();
    const rightFirst = right.firstName.trim();
    const leftLast = left.lastName.trim();
    const rightLast = right.lastName.trim();
    const leftHasFirst = leftFirst.length > 0;
    const rightHasFirst = rightFirst.length > 0;

    if (leftHasFirst !== rightHasFirst) {
      return leftHasFirst ? -1 : 1;
    }

    if (leftHasFirst && rightHasFirst) {
      const firstCompare = leftFirst.localeCompare(rightFirst, undefined, { sensitivity: "base" });
      if (firstCompare !== 0) {
        return firstCompare;
      }
    }

    const leftHasLast = leftLast.length > 0;
    const rightHasLast = rightLast.length > 0;

    if (leftHasLast !== rightHasLast) {
      return leftHasLast ? -1 : 1;
    }

    const lastCompare = leftLast.localeCompare(rightLast, undefined, { sensitivity: "base" });
    if (lastCompare !== 0) {
      return lastCompare;
    }

    return left.id.localeCompare(right.id, undefined, { sensitivity: "base" });
  });
}

function formatToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function RopeInspectionModal({
  isOpen,
  ropeName,
  currentMemberId,
  currentMemberName,
  memberOptions,
  isSaving = false,
  onClose,
  onSave,
}: RopeInspectionModalProps) {
  const [formValues, setFormValues] = useState<RopeInspectionFormValues>(() => ({
    inspectionDate: formatToday(),
    primaryInspectorMemberId: currentMemberId,
    participantMemberIds: [],
    result: "Pass",
    notes: "",
  }));
  const [participantSearch, setParticipantSearch] = useState("");

  const sortedMemberOptions = useMemo(() => sortMembers(memberOptions), [memberOptions]);

  const selectedParticipantIdSet = useMemo(
    () => new Set(formValues.participantMemberIds),
    [formValues.participantMemberIds],
  );

  const availableParticipants = useMemo(() => {
    const normalizedSearch = normalizeText(participantSearch);
    return sortedMemberOptions.filter((member) => {
      if (member.id === formValues.primaryInspectorMemberId) {
        return false;
      }

      if (selectedParticipantIdSet.has(member.id)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return normalizeText(member.displayName).includes(normalizedSearch);
    });
  }, [formValues.primaryInspectorMemberId, participantSearch, selectedParticipantIdSet, sortedMemberOptions]);

  const selectedParticipants = useMemo(
    () =>
      sortedMemberOptions.filter((member) => formValues.participantMemberIds.includes(member.id)),
    [formValues.participantMemberIds, sortedMemberOptions],
  );

  if (!isOpen) {
    return null;
  }

  const primaryInspectorLabel =
    sortedMemberOptions.find((member) => member.id === formValues.primaryInspectorMemberId)?.displayName ??
    currentMemberName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Inspection</p>
            <h3 className="mt-1 text-xl font-black text-white">Inspect Rope</h3>
            <p className="mt-1 text-sm text-neutral-400">{ropeName}</p>
          </div>

          <span className="rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-300">
            {selectedParticipants.length + 1} Participants
          </span>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Inspection Date
              </span>
              <input
                type="date"
                value={formValues.inspectionDate}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, inspectionDate: event.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Primary Inspector
              </span>
              <select
                value={formValues.primaryInspectorMemberId}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    primaryInspectorMemberId: event.target.value,
                    participantMemberIds: current.participantMemberIds.filter((id) => id !== event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              >
                {sortedMemberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">Defaults to {primaryInspectorLabel}.</p>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Result
              </span>
              <div className="grid grid-cols-2 gap-3">
                {(["Pass", "Fail"] as const).map((result) => {
                  const isActive = formValues.result === result;
                  const activeClasses =
                    result === "Pass"
                      ? "border-green-500/50 bg-green-600 text-white"
                      : "border-red-500/50 bg-red-600 text-white";
                  return (
                    <button
                      key={result}
                      type="button"
                      onClick={() => setFormValues((current) => ({ ...current, result }))}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? activeClasses
                          : "border-white/10 bg-[#1b1b1b] text-neutral-200 hover:bg-[#202020]"
                      }`}
                    >
                      {result}
                    </button>
                  );
                })}
              </div>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Notes / Findings
              </span>
              <textarea
                rows={4}
                value={formValues.notes}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="No frays, no cuts, no glazing, no contamination..."
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
              />
            </label>

            <div className="md:col-span-2 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-neutral-700 bg-[#1b1b1b] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                  Current Participants
                </p>
                <p className="mt-1 text-sm text-neutral-500">Primary inspector is shown separately.</p>

                {selectedParticipants.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-400">No additional participants.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedParticipants.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-[#202020] px-3 py-2"
                      >
                        <p className="text-sm text-neutral-200">{member.displayName}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setFormValues((current) => ({
                              ...current,
                              participantMemberIds: current.participantMemberIds.filter((id) => id !== member.id),
                            }));
                          }}
                          className="rounded-md border border-white/10 px-2 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-white/5"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-neutral-700 bg-[#1b1b1b] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                  Add Participants
                </p>
                <input
                  type="search"
                  value={participantSearch}
                  onChange={(event) => setParticipantSearch(event.target.value)}
                  placeholder="Search members..."
                  className="mt-3 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
                />

                {availableParticipants.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-400">No additional members match that search.</p>
                ) : (
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                    {availableParticipants.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-[#202020] px-3 py-2"
                      >
                        <p className="text-sm text-neutral-200">{member.displayName}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setFormValues((current) => ({
                              ...current,
                              participantMemberIds: [...current.participantMemberIds, member.id],
                            }));
                            setParticipantSearch("");
                          }}
                          className="rounded-md border border-white/10 px-2 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-white/5"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onSave(formValues)}
            disabled={isSaving}
            className="rounded-lg border border-red-500/40 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Inspection"}
          </button>
        </div>
      </div>
    </div>
  );
}