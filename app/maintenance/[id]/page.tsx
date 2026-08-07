import Link from "next/link";
import { notFound } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import EditMaintenanceButton from "@/components/maintenance/EditMaintenanceButton";
import {
  MAINTENANCE_ATTACHMENTS_BUCKET,
  MAINTENANCE_PHOTOS_BUCKET,
} from "@/lib/maintenance";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type MaintenanceRecordRow = {
  id: string;
  maintenance_number: string | null;
  apparatus_id: string | null;
  deficiency_id: string | null;
  maintenance_type: string | null;
  completed_by: string | null;
  service_date: string | null;
  description: string | null;
  parts_used: string | null;
  labor_hours: number | null;
  mileage: number | null;
  engine_hours: number | null;
  cost: number | null;
  notes: string | null;
  photos: string[] | null;
  attachments: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

interface MaintenanceDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null) {
  if (typeof value !== "number") {
    return "Not set";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function resolveStorageAssetUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  bucketName: string,
  path: string
) {
  const trimmedPath = path.trim();

  if (!trimmedPath) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmedPath)) {
    return trimmedPath;
  }

  return supabase.storage.from(bucketName).getPublicUrl(trimmedPath).data.publicUrl;
}

export default async function MaintenanceDetailPage({
  params,
}: MaintenanceDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("maintenance_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const record = data as MaintenanceRecordRow;

  const [apparatusResult, deficiencyResult, memberResult] = await Promise.all([
    record.apparatus_id
      ? supabase.from("apparatus").select("name").eq("id", record.apparatus_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    record.deficiency_id
      ? supabase
          .from("deficiencies")
          .select("id, deficiency_number")
          .eq("id", record.deficiency_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    record.completed_by
      ? supabase
          .from("members")
          .select("first_name, last_name")
          .eq("id", record.completed_by)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const apparatusName =
    typeof apparatusResult.data?.name === "string" && apparatusResult.data.name.trim()
      ? apparatusResult.data.name
      : "Unknown";

  const completedBy = (() => {
    const member = memberResult.data as Record<string, unknown> | null;

    if (!member) {
      return "Unknown";
    }

    const firstName = typeof member.first_name === "string" ? member.first_name.trim() : "";
    const lastName = typeof member.last_name === "string" ? member.last_name.trim() : "";
    return `${firstName} ${lastName}`.trim() || "Unknown";
  })();

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        <Link
          href="/maintenance"
          className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
        >
          Back to Maintenance
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
                Maintenance Record
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
                {record.maintenance_number ?? "Pending"}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-100">
                {record.maintenance_type ?? "Unknown"}
              </span>
              <EditMaintenanceButton record={record} />
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Apparatus</p>
              <p className="mt-2 text-sm font-semibold text-white">{apparatusName}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Linked Deficiency</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {deficiencyResult.data?.deficiency_number ?? record.deficiency_id ?? "Not linked"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Completed By</p>
              <p className="mt-2 text-sm font-semibold text-white">{completedBy}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Service Date</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatDateTime(record.service_date)}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Labor Hours</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {typeof record.labor_hours === "number" ? record.labor_hours : "Not set"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Cost</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(record.cost)}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Mileage</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {typeof record.mileage === "number" ? record.mileage : "Not set"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Engine Hours</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {typeof record.engine_hours === "number" ? record.engine_hours : "Not set"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Updated</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatDateTime(record.updated_at)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-[#0d0d0d] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Description</p>
            <p className="mt-3 text-sm leading-6 text-zinc-200">
              {record.description ?? "No description provided."}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-[#0d0d0d] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Parts Used</p>
            <p className="mt-3 text-sm leading-6 text-zinc-200">{record.parts_used ?? "Not provided."}</p>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-[#0d0d0d] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Notes</p>
            <p className="mt-3 text-sm leading-6 text-zinc-200">{record.notes ?? "Not provided."}</p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Photos</p>
              {record.photos && record.photos.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  {record.photos.map((photoPath, index) => (
                    <li key={`${photoPath}-${index}`}>
                      {(() => {
                        const photoUrl = resolveStorageAssetUrl(
                          supabase,
                          MAINTENANCE_PHOTOS_BUCKET,
                          photoPath
                        );

                        return (
                      <a
                        href={photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-zinc-600 transition hover:text-white"
                      >
                        {photoPath}
                      </a>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">No photos attached.</p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Attachments</p>
              {record.attachments && record.attachments.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  {record.attachments.map((attachmentPath, index) => (
                    <li key={`${attachmentPath}-${index}`}>
                      {(() => {
                        const attachmentUrl = resolveStorageAssetUrl(
                          supabase,
                          MAINTENANCE_ATTACHMENTS_BUCKET,
                          attachmentPath
                        );

                        return (
                      <a
                        href={attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-zinc-600 transition hover:text-white"
                      >
                        {attachmentPath}
                      </a>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">No attachments added.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
