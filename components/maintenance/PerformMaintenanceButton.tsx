"use client";

import Link from "next/link";

type PerformMaintenanceButtonProps = {
  apparatusId: string;
  returnTo?: string;
  className?: string;
};

export default function PerformMaintenanceButton({
  apparatusId,
  returnTo,
  className,
}: PerformMaintenanceButtonProps) {
  const params = new URLSearchParams();
  params.set("apparatusId", apparatusId);

  if (returnTo && returnTo.startsWith("/")) {
    params.set("returnTo", returnTo);
  }

  return (
    <Link
      href={`/maintenance/perform?${params.toString()}`}
      className={
        className ??
        "rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
      }
    >
        Perform Maintenance
    </Link>
  );
}
