import Link from "next/link";
import { redirect } from "next/navigation";
import { getApparatus } from "@/lib/database";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MobileApparatusChecksPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const apparatus = (await getApparatus(supabase)).filter(
    (unit) => unit.department_id === currentMember.departmentId,
  );

  return (
    <main className="min-h-screen bg-[#101010] px-4 pb-8 pt-5 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">
          Back to Field Actions
        </Link>

        <header className="mt-5 border-b border-white/10 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ef2b2d]">Field Action</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Apparatus Checks</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/60 sm:text-base">
            Select the apparatus you are checking now.
          </p>
        </header>

        {apparatus.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <p className="text-lg font-bold">No active apparatus available</p>
            <p className="mt-2 text-sm text-white/60">Ask an officer or administrator to review the apparatus roster.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apparatus.map((unit) => (
              <Link
                key={unit.id}
                href={`/mobile/apparatus-checks/${unit.id}`}
                className="flex min-h-36 flex-col justify-between rounded-2xl border border-white/12 bg-[#202020] p-5 shadow-[0_12px_24px_rgba(0,0,0,.22)] transition active:scale-[0.99] hover:border-red-500/50 hover:bg-[#292929]"
              >
                <div>
                  <p className="text-2xl font-black tracking-tight text-white">{unit.name}</p>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-white/55">{unit.type ?? "Apparatus"}</p>
                </div>
                <span className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#ef2b2d] px-4 text-sm font-black uppercase tracking-[0.08em] text-white">
                  Start Check
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
