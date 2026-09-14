import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PrePlanListRow = {
  id: string;
  business_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  occupancy_id_number: string | null;
  updated_at: string;
};

interface PrePlansPageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sanitizeSearchInput(value: string) {
  return value.replaceAll(",", " ").trim();
}

export default async function PrePlansPage({ searchParams }: PrePlansPageProps) {
  const { q } = await searchParams;
  const queryText = typeof q === "string" ? q.trim() : "";
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;

  let rows: PrePlanListRow[] = [];
  let loadError: string | null = null;

  if (departmentId) {
    let request = supabase
      .from("pre_plans")
      .select("id, business_name, address, city, state, zip, occupancy_id_number, updated_at")
      .eq("department_id", departmentId)
      .eq("lifecycle_status", "active")
      .order("business_name", { ascending: true })
      .limit(250);

    if (queryText) {
      const token = sanitizeSearchInput(queryText);
      if (token) {
        const ilikePattern = `%${token}%`;
        request = request.or(
          [
            `business_name.ilike.${ilikePattern}`,
            `address.ilike.${ilikePattern}`,
            `city.ilike.${ilikePattern}`,
            `occupancy_id_number.ilike.${ilikePattern}`,
          ].join(","),
        );
      }
    }

    const { data, error } = await request;

    if (error) {
      loadError = error.message || "Unable to load pre-plans.";
    } else {
      rows = (data ?? []) as PrePlanListRow[];
    }
  }

  return (
    <PageLayout
      environmentBackgroundUrl="/branding/images/redlinepreplanpage.png"
      environmentBackgroundPosition="center center"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Operations</p>
            <h1
              className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
              style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
            >
              Pre-Plans
            </h1>
            <p className="mt-3 text-sm text-neutral-400">
              Department pre-incident plans for occupancy intelligence and contact readiness.
            </p>
          </div>

          <Link
            href="/pre-plans/new"
            className="inline-flex w-fit rounded-lg border border-red-500/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            + Create Pre-Plan
          </Link>
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-4">
          <form method="get" action="/pre-plans" className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="text"
              name="q"
              defaultValue={queryText}
              placeholder="Search business name, address, city, or occupancy ID..."
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex w-fit rounded-lg border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Search
            </button>
          </form>
        </section>

        {loadError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
            {loadError}
          </div>
        ) : null}

        {!departmentId ? (
          <div className="rounded-2xl border border-white/10 bg-[#111111] p-6 text-sm text-neutral-300">
            Unable to resolve your department membership.
          </div>
        ) : null}

        {departmentId ? (
          <section className="rounded-2xl border border-white/10 bg-[#111111] p-5">
            {rows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-10 text-center">
                <p className="text-lg font-bold text-white">No pre-plans found</p>
                <p className="mt-2 text-sm text-neutral-400">
                  Create your first pre-plan to capture occupancy and contact details.
                </p>
                <Link
                  href="/pre-plans/new"
                  className="mt-4 inline-flex rounded-lg border border-red-500/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Create Pre-Plan
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left">
                  <thead>
                    <tr>
                      {[
                        "Business",
                        "Address",
                        "City",
                        "State",
                        "ZIP",
                        "Occupancy ID",
                        "Updated",
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="transition hover:bg-white/[0.03]">
                        <td className="border-b border-white/5 px-3 py-3 text-sm font-semibold text-white">
                          <Link href={`/pre-plans/${row.id}`} className="underline-offset-4 hover:underline">
                            {row.business_name}
                          </Link>
                        </td>
                        <td className="border-b border-white/5 px-3 py-3 text-sm text-neutral-200">{row.address}</td>
                        <td className="border-b border-white/5 px-3 py-3 text-sm text-neutral-200">{row.city}</td>
                        <td className="border-b border-white/5 px-3 py-3 text-sm text-neutral-200">{row.state}</td>
                        <td className="border-b border-white/5 px-3 py-3 text-sm text-neutral-200">{row.zip}</td>
                        <td className="border-b border-white/5 px-3 py-3 text-sm text-neutral-200">
                          {row.occupancy_id_number ?? "-"}
                        </td>
                        <td className="border-b border-white/5 px-3 py-3 text-sm text-neutral-300">
                          {formatDateTime(row.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </PageLayout>
  );
}
