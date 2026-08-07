"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MaintenanceFormModal, {
  type MaintenanceRecordEdit,
} from "@/components/maintenance/MaintenanceFormModal";

type EditMaintenanceButtonProps = {
  record: MaintenanceRecordEdit;
};

export default function EditMaintenanceButton({
  record,
}: EditMaintenanceButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
      >
        Edit
      </button>

      <MaintenanceFormModal
        isOpen={isOpen}
        mode="edit"
        title="Edit Maintenance Record"
        submitLabel="Save Changes"
        initialRecord={record}
        onClose={() => setIsOpen(false)}
        onSaved={() => {
          setIsOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
