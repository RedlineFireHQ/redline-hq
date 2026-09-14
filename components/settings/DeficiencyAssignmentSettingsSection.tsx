"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type DeficiencyCategoryRow = {
  id: string;
  name: string;
  active: boolean;
};

type MemberOptionRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  active: boolean;
};

type AssignmentSettingRow = {
  id: number;
  category_id: string;
  member_id: string;
  active: boolean;
};

interface DeficiencyAssignmentSettingsSectionProps {
  departmentId: string;
  categories: DeficiencyCategoryRow[];
  members: MemberOptionRow[];
  assignmentSettings: AssignmentSettingRow[];
}

function memberDisplayName(member: MemberOptionRow | undefined) {
  if (!member) {
    return "Unknown member";
  }
  const full = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
  return full || "Unknown member";
}

export default function DeficiencyAssignmentSettingsSection({
  departmentId,
  categories,
  members,
  assignmentSettings,
}: DeficiencyAssignmentSettingsSectionProps) {
  const router = useRouter();
  const [settings, setSettings] = useState(assignmentSettings);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );

  const activeMembers = useMemo(
    () => members.filter((member) => member.active),
    [members],
  );

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  const settingByCategoryId = useMemo(
    () => new Map(settings.map((setting) => [setting.category_id, setting])),
    [settings],
  );

  async function handleAssign(categoryId: string, memberId: string) {
    setError(null);
    setSuccessMessage(null);
    setSavingCategoryId(categoryId);

    try {
      if (!memberId) {
        const existing = settingByCategoryId.get(categoryId);
        if (existing) {
          const { error: deleteError } = await supabase
            .from("deficiency_notification_settings")
            .delete()
            .eq("id", existing.id)
            .eq("department_id", departmentId);

          if (deleteError) {
            setError(deleteError.message || "Unable to clear the responsible member.");
            return;
          }

          setSettings((current) => current.filter((setting) => setting.id !== existing.id));
        }

        setSuccessMessage("Assignment cleared.");
        router.refresh();
        return;
      }

      const existing = settingByCategoryId.get(categoryId);

      const { data, error: saveError } = existing
        ? await supabase
            .from("deficiency_notification_settings")
            .update({ member_id: memberId, active: true })
            .eq("id", existing.id)
            .eq("department_id", departmentId)
            .select("id, category_id, member_id, active")
            .single()
        : await supabase
            .from("deficiency_notification_settings")
            .insert({
              department_id: departmentId,
              category_id: categoryId,
              member_id: memberId,
              active: true,
            })
            .select("id, category_id, member_id, active")
            .single();

      if (saveError || !data) {
        setError(saveError?.message || "Unable to save the responsible member.");
        return;
      }

      const nextRow: AssignmentSettingRow = {
        id: typeof data.id === "number" ? data.id : Number(data.id),
        category_id: typeof data.category_id === "string" ? data.category_id : categoryId,
        member_id: typeof data.member_id === "string" ? data.member_id : memberId,
        active: data.active === true,
      };

      setSettings((current) => {
        const existingIndex = current.findIndex((setting) => setting.category_id === categoryId);
        if (existingIndex === -1) {
          return [...current, nextRow];
        }
        const copy = [...current];
        copy[existingIndex] = nextRow;
        return copy;
      });

      const member = memberById.get(nextRow.member_id);
      setSuccessMessage(`Assigned ${memberDisplayName(member)}.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the responsible member.");
    } finally {
      setSavingCategoryId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="border-b border-neutral-800 pb-5">
        <h2 className="text-2xl font-semibold text-white">Deficiency Assignment</h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Choose which department member is automatically assigned new deficiencies for each category.
          Leave a category unset to keep new deficiencies unassigned until someone assigns them manually.
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {successMessage}
        </div>
      ) : null}

      {activeCategories.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
          <p>No active deficiency categories configured yet.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {activeCategories.map((category) => {
            const setting = settingByCategoryId.get(category.id);
            const assignedMember = setting ? memberById.get(setting.member_id) : undefined;
            const assignedInactive = Boolean(setting && assignedMember && !assignedMember.active);
            const isSaving = savingCategoryId === category.id;

            return (
              <div
                key={category.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#141414] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-white">{category.name}</p>
                  {setting && assignedInactive ? (
                    <p className="mt-0.5 text-xs text-amber-300">
                      Assigned member is inactive — new deficiencies will not be auto-assigned.
                    </p>
                  ) : null}
                </div>

                <select
                  value={setting?.member_id ?? ""}
                  disabled={isSaving}
                  onChange={(event) => void handleAssign(category.id, event.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white sm:w-64"
                >
                  <option value="">No automatic assignment</option>
                  {activeMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {memberDisplayName(member)}
                    </option>
                  ))}
                  {setting && assignedMember && !assignedMember.active ? (
                    <option value={assignedMember.id}>{memberDisplayName(assignedMember)} (inactive)</option>
                  ) : null}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
