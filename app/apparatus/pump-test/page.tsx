import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import PumpTestForm from "@/components/apparatus/PumpTestForm";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

export default async function PumpTestPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    return (
      <PageLayout environmentBackgroundUrl="/branding/images/apparatuspageimage.png" environmentBackgroundPosition="left center">
        <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Apparatus</p>
          <h1 className="mt-3 text-3xl font-black text-white">Pump Test</h1>
          <p className="mt-3 text-neutral-400">Unable to determine your department.</p>
        </div>
      </PageLayout>
    );
  }

  const { data: apparatusData } = await supabase
    .from("apparatus")
    .select("id, name, type")
    .eq("department_id", currentMember.departmentId)
    .eq("lifecycle_status", "active")
    .order("name", { ascending: true });

  const apparatusOptions = ((apparatusData ?? []) as Array<{ id: string; name: string | null; type: string | null }>).map((apparatus) => ({
    id: apparatus.id,
    name: apparatus.name ?? "Untitled Apparatus",
    type: apparatus.type,
  }));

  return (
    <PageLayout environmentBackgroundUrl="/branding/images/apparatuspageimage.png" environmentBackgroundPosition="left center">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Apparatus</p>
            <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Pump Test</h1>
            <p className="mt-3 text-neutral-400">Record a Pass or Fail result for an apparatus pump test.</p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/apparatus"
              className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              Back to Apparatus
            </Link>
            <Link
              href="/apparatus/pump-test-history"
              className="inline-flex rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
            >
              Pump Test History
            </Link>
          </div>
        </div>

        <PumpTestForm departmentId={currentMember.departmentId} apparatusOptions={apparatusOptions} />
      </div>
    </PageLayout>
  );
}
