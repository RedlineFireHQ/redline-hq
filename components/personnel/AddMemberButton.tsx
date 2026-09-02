"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBER_RANK_OPTIONS, type AppPermissionOption } from "@/lib/app-permissions";

type AddMemberButtonProps = {
  permissionOptions: AppPermissionOption[];
};

type CreateMemberFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rank: string;
  active: boolean;
  hireStartDate: string;
  inactiveDate: string;
  specialPermissionsEnabled: boolean;
  permissionKeys: string[];
};

const initialState: CreateMemberFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  rank: "Firefighter",
  active: true,
  hireStartDate: "",
  inactiveDate: "",
  specialPermissionsEnabled: false,
  permissionKeys: [],
};

export default function AddMemberButton({ permissionOptions }: AddMemberButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<CreateMemberFormState>(initialState);

  const sortedPermissionOptions = useMemo(
    () => [...permissionOptions].sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label)),
    [permissionOptions],
  );

  function closeModal() {
    setIsOpen(false);
    setIsSaving(false);
    setErrorMessage(null);
    setFormState(initialState);
  }

  function togglePermission(permissionKey: string) {
    setFormState((current) => {
      const exists = current.permissionKeys.includes(permissionKey);
      return {
        ...current,
        permissionKeys: exists
          ? current.permissionKeys.filter((key) => key !== permissionKey)
          : [...current.permissionKeys, permissionKey],
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/personnel/members", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setErrorMessage(payload.error || "Unable to add member.");
        return;
      }

      closeModal();
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add member.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-red-600 px-5 py-3 font-semibold transition hover:bg-red-700"
      >
        + Add Member
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-900 p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white">Add Member</h2>
              <p className="mt-1 text-sm text-neutral-400">Create a new department member with a rank and optional special permissions.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-neutral-300">
                  First name
                  <input
                    value={formState.firstName}
                    onChange={(event) => setFormState((current) => ({ ...current, firstName: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    required
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Last name
                  <input
                    value={formState.lastName}
                    onChange={(event) => setFormState((current) => ({ ...current, lastName: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    required
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Email
                  <input
                    value={formState.email}
                    onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Phone
                  <input
                    value={formState.phone}
                    onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Rank
                  <select
                    value={formState.rank}
                    onChange={(event) => setFormState((current) => ({ ...current, rank: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                  >
                    {MEMBER_RANK_OPTIONS.map((rank) => (
                      <option key={rank} value={rank}>{rank}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-neutral-300">
                  Hire / Start Date
                  <input
                    type="date"
                    value={formState.hireStartDate}
                    onChange={(event) => setFormState((current) => ({ ...current, hireStartDate: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Exit / Inactive Date
                  {formState.active ? (
                    <input
                      type="text"
                      value=""
                      readOnly
                      disabled
                      placeholder="Set when member is inactive"
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white placeholder:text-neutral-500"
                    />
                  ) : (
                    <input
                      type="date"
                      value={formState.inactiveDate}
                      onChange={(event) => setFormState((current) => ({ ...current, inactiveDate: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                      required
                    />
                  )}
                </label>

                <label className="flex items-center gap-3 text-sm text-neutral-300 md:mt-7">
                  <input
                    type="checkbox"
                    checked={formState.active}
                    onChange={(event) => {
                      const nextActive = event.target.checked;
                      setFormState((current) => ({
                        ...current,
                        active: nextActive,
                        inactiveDate: nextActive ? "" : current.inactiveDate,
                      }));
                    }}
                  />
                  Active member
                </label>
              </div>

              {!formState.active ? (
                <p className="text-xs text-amber-300">
                  Inactive members require an Exit / Inactive Date and remain as historical personnel records.
                </p>
              ) : null}

              <label className="flex items-center gap-3 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  checked={formState.specialPermissionsEnabled}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      specialPermissionsEnabled: event.target.checked,
                      permissionKeys: event.target.checked ? current.permissionKeys : [],
                    }))
                  }
                />
                Enable special permissions
              </label>

              {formState.specialPermissionsEnabled ? (
                <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-neutral-400">Permission Access</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {sortedPermissionOptions.map((permission) => (
                      <label key={permission.key} className="flex items-start gap-2 rounded border border-neutral-800 p-2 text-sm text-neutral-200">
                        <input
                          type="checkbox"
                          checked={formState.permissionKeys.includes(permission.key)}
                          onChange={() => togglePermission(permission.key)}
                        />
                        <span>
                          <span className="font-semibold text-white">{permission.label}</span>
                          {permission.description ? <span className="block text-xs text-neutral-400">{permission.description}</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Create Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
