"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import MaintenanceFormModal from "@/components/maintenance/MaintenanceFormModal";

export default function PerformMaintenancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apparatusId = searchParams.get("apparatusId");
  const deficiencyId = searchParams.get("deficiencyId");
  const returnToParam = searchParams.get("returnTo");
  const returnTo =
    typeof returnToParam === "string" && returnToParam.startsWith("/")
      ? returnToParam
      : null;
  const lockApparatus = Boolean(apparatusId);

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/maintenance"
          className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
        >
          Back to Maintenance
        </Link>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
            Maintenance Workflow
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
            Perform Maintenance
          </h1>
          <p className="mt-2 text-zinc-400">
            Complete and save a Maintenance Record using the standard application workflow.
          </p>
        </div>

        <MaintenanceFormModal
          isOpen
          mode="create"
          title="Perform Maintenance"
          submitLabel="Save Record"
          presentation="inline"
          defaultApparatusId={apparatusId}
          defaultDeficiencyId={deficiencyId}
          lockApparatusSelection={lockApparatus}
          showCancelButton={false}
          onClose={() => router.push(returnTo ?? "/maintenance")}
          onSaved={(recordId) => {
            if (returnTo) {
              router.push(`${returnTo}?maintenanceUpdated=${encodeURIComponent(recordId)}`);
              router.refresh();
              return;
            }

            router.push(`/maintenance/${recordId}`);
            router.refresh();
          }}
        />
      </div>
    </PageLayout>
  );
}
