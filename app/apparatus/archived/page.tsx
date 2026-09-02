import Link from "next/link";
import Image from "next/image";
import PageLayout from "@/components/layout/PageLayout";
import { getApparatusImagePath } from "@/lib/apparatus-images";
import { getArchivedApparatus } from "@/lib/database";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function ArchivedApparatusPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const archivedApparatus = currentMember?.departmentId
    ? await getArchivedApparatus(currentMember.departmentId, supabase)
    : [];

  return (
    <PageLayout
      environmentBackgroundUrl="/branding/images/apparatuspageimage.png"
      environmentBackgroundPosition="left center"
    >
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
              Fleet Readiness
            </p>

            <h1
              className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
              style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
            >
              Archived Apparatus
            </h1>

            <p className="mt-3 max-w-3xl text-lg text-neutral-400">
              Apparatus removed from active fleet operations but retained for historical records.
            </p>
          </div>

          <Link
            href="/apparatus"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Back to Active Apparatus
          </Link>
        </div>

        {archivedApparatus.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#111111] p-8 text-center">
            <h2 className="text-2xl font-bold text-white">No Archived Apparatus</h2>
            <p className="mt-2 text-neutral-400">
              Archived apparatus will appear here when they are removed from the active fleet.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {archivedApparatus.map((unit) => {
              const imageUrl = getApparatusImagePath(unit.name);
              const apparatusName = unit.name?.trim() || unit.id;
              const apparatusType = unit.type?.trim() || "Unknown";

              return (
                <Link
                  key={unit.id}
                  href={`/apparatus/${unit.id}/information`}
                  className="group block overflow-hidden rounded-2xl border border-white/10 bg-[#111111] text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_18px_45px_rgba(239,43,45,.14)]"
                >
                  <div className="relative h-40 w-full border-b border-white/10 bg-gradient-to-br from-[#1a1a1a] via-[#151515] to-[#101010]">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={apparatusName}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(180,0,0,.14),transparent_60%)]" />
                  </div>

                  <div className="space-y-4 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-black tracking-tight text-white">{apparatusName}</h2>
                      <span className="rounded-full border border-amber-500/35 bg-amber-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.12em] text-amber-300">
                        Archived
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                          Apparatus Type
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">{apparatusType}</p>
                      </div>

                      <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                          Lifecycle Status
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">Archived</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-4">
                    <span className="inline-flex h-[42px] w-full items-center justify-center rounded-xl border border-white/15 bg-neutral-900 px-4 text-sm font-semibold text-white transition group-hover:bg-neutral-800">
                      Open Apparatus Details
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}