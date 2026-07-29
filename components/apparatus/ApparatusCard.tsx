import Link from "next/link";
import { Apparatus } from "@/lib/types";
import StatusBadge from "@/components/ui/StatusBadge";

interface ApparatusCardProps {
  apparatus: Apparatus;
}

function getReadinessStatus(apparatus: Apparatus) {
  if ((apparatus as any).status) {
    return (apparatus as any).status;
  }

  return apparatus.inService ? "ready" : "out_of_service";
}

export default function ApparatusCard({
  apparatus,
}: ApparatusCardProps) {
  const readiness = getReadinessStatus(apparatus);

  return (
    <div className="group overflow-hidden rounded-2xl border border-neutral-800 bg-[#2E2E2E] transition-all duration-300 hover:-translate-y-1 hover:border-[#E1181B] hover:shadow-2xl hover:shadow-red-900/20">
      {/* Header */}
      <div className="border-b border-neutral-800 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              {apparatus.type}
            </p>

            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white">
              {apparatus.name}
            </h2>
          </div>

          {readiness === "ready" && (
            <StatusBadge status="success">
              Ready for Service
            </StatusBadge>
          )}

          {readiness === "needs_attention" && (
            <StatusBadge status="warning">
              Needs Attention
            </StatusBadge>
          )}

          {readiness === "out_of_service" && (
            <StatusBadge status="danger">
              Out of Service
            </StatusBadge>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 p-6">
        <StatusRow
          label="Monthly Check"
          value="Due Soon"
          color="text-amber-400"
        />

        <StatusRow
          label="Maintenance"
          value="Current"
          color="text-green-400"
        />

        <StatusRow
          label="Inspection"
          value="Current"
          color="text-green-400"
        />

        <StatusRow
          label="Assigned Members"
          value="2"
          color="text-white"
        />
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-800 p-5">
        <Link
          href={`/apparatus/${apparatus.id}`}
          className="block w-full rounded-xl bg-[#E1181B] py-3 text-center text-sm font-bold tracking-wide text-white transition-colors hover:bg-red-600"
        >
          VIEW APPARATUS
        </Link>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-neutral-400">
        {label}
      </span>

      <span className={`text-sm font-semibold ${color}`}>
        {value}
      </span>
    </div>
  );
}