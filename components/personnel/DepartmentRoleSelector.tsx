"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type DepartmentRoleOption = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

interface DepartmentRoleSelectorProps {
  departmentId: string;
  memberId: string;
  currentMemberId: string;
  selectedRoleId: string | null;
  departmentRoles: DepartmentRoleOption[];
}

export default function DepartmentRoleSelector({
  departmentId,
  memberId,
  currentMemberId,
  selectedRoleId,
  departmentRoles,
}: DepartmentRoleSelectorProps) {
  const router = useRouter();
  const [selectedValue, setSelectedValue] = useState<string>(selectedRoleId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const sortedRoles = [...departmentRoles].sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

  const selectedRole = departmentRoles.find((role) => role.id === selectedValue) ?? null;
  const existingAssignedInactiveRole =
    selectedRoleId && selectedRole ? (!selectedRole.active ? selectedRole : null) : null;

  async function handleSave() {
    setSaveError(null);
    setSaveSuccess(null);
    setIsSaving(true);

    try {
      const nextRoleId = selectedValue || null;

      const { data, error } = await supabase.rpc("update_department_member_role", {
        p_member_id: memberId,
        p_department_role_id: nextRoleId,
      });

      if (error) {
        setSaveError(error.message || "Unable to save department role.");
        return;
      }

      const updatedMemberId = typeof data === "string" ? data : "";
      if (!updatedMemberId || updatedMemberId !== memberId) {
        setSaveError("Department role update did not affect the target member. Verify the member and department match before retrying.");
        return;
      }

      setSaveSuccess("Department role updated.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save department role.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Department Role
          </p>

          <label className="mt-2 block">
            <span className="sr-only">Department role selector</span>
            <select
              value={selectedValue}
              onChange={(event) => setSelectedValue(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {sortedRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}{role.active ? "" : " (Inactive)"}
                </option>
              ))}
            </select>
          </label>

          {existingAssignedInactiveRole ? (
            <p className="mt-2 text-xs text-amber-300">
              Currently assigned: {existingAssignedInactiveRole.name} (Inactive)
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Role"}
        </button>
      </div>

      {saveError ? (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {saveError}
        </div>
      ) : null}

      {saveSuccess ? (
        <div className="mt-3 rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-200">
          {saveSuccess}
        </div>
      ) : null}
    </div>
  );
}
