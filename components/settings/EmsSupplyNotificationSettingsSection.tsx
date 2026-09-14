"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NOTIFICATION_TYPE = "ems_supply_low_stock";

type MemberOptionRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  active: boolean;
};

type RecipientRow = {
  id: string;
  member_id: string;
  active: boolean;
};

interface EmsSupplyNotificationSettingsSectionProps {
  departmentId: string;
  members: MemberOptionRow[];
  recipient: RecipientRow | null;
}

function memberDisplayName(member: MemberOptionRow | undefined) {
  if (!member) {
    return "Unknown member";
  }
  const full = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
  return full || "Unknown member";
}

export default function EmsSupplyNotificationSettingsSection({
  departmentId,
  members,
  recipient,
}: EmsSupplyNotificationSettingsSectionProps) {
  const router = useRouter();
  const [currentRecipient, setCurrentRecipient] = useState(recipient);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeMembers = useMemo(() => members.filter((member) => member.active), [members]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const assignedMember = currentRecipient ? memberById.get(currentRecipient.member_id) : undefined;
  const assignedInactive = Boolean(currentRecipient && assignedMember && !assignedMember.active);

  async function handleChange(memberId: string) {
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      if (!memberId) {
        if (currentRecipient) {
          const { error: deleteError } = await supabase
            .from("department_notification_recipients")
            .delete()
            .eq("id", currentRecipient.id)
            .eq("department_id", departmentId);

          if (deleteError) {
            setError(deleteError.message || "Unable to clear the responsible member.");
            return;
          }

          setCurrentRecipient(null);
        }

        setSuccessMessage("Automatic EMS supply notifications turned off.");
        router.refresh();
        return;
      }

      const { data, error: saveError } = currentRecipient
        ? await supabase
            .from("department_notification_recipients")
            .update({ member_id: memberId, active: true })
            .eq("id", currentRecipient.id)
            .eq("department_id", departmentId)
            .select("id, member_id, active")
            .single()
        : await supabase
            .from("department_notification_recipients")
            .insert({
              department_id: departmentId,
              notification_type: NOTIFICATION_TYPE,
              member_id: memberId,
              active: true,
            })
            .select("id, member_id, active")
            .single();

      if (saveError || !data) {
        setError(saveError?.message || "Unable to save the responsible member.");
        return;
      }

      setCurrentRecipient({
        id: String(data.id),
        member_id: typeof data.member_id === "string" ? data.member_id : memberId,
        active: data.active === true,
      });
      setSuccessMessage(`Assigned ${memberDisplayName(memberById.get(memberId))}.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the responsible member.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="border-b border-neutral-800 pb-5">
        <h2 className="text-2xl font-semibold text-white">EMS Supply Notifications</h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Choose who is notified when an EMS supply drops to or below its reorder threshold.
          Notifications are sent once each time an item crosses the threshold, not for every
          further reduction.
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

      <div className="mt-5 flex flex-col gap-2 rounded-xl border border-white/10 bg-[#141414] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-white">Responsible Member</p>
          {assignedInactive ? (
            <p className="mt-0.5 text-xs text-amber-300">
              Assigned member is inactive — low stock notifications will not be sent.
            </p>
          ) : null}
        </div>

        <select
          value={currentRecipient?.member_id ?? ""}
          disabled={isSaving}
          onChange={(event) => void handleChange(event.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white sm:w-64"
        >
          <option value="">No automatic notification</option>
          {activeMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {memberDisplayName(member)}
            </option>
          ))}
          {assignedInactive && assignedMember ? (
            <option value={assignedMember.id}>{memberDisplayName(assignedMember)} (inactive)</option>
          ) : null}
        </select>
      </div>
    </section>
  );
}
