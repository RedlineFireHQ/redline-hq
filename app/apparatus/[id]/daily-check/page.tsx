import PageLayout from "@/components/layout/PageLayout";
import InspectionStatus from "@/components/inspection/InspectionStatus";
import DailyCheckForm from "@/components/inspection/DailyCheckForm";
import Link from "next/link";

interface DailyCheckPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DailyCheckPage({
  params,
}: DailyCheckPageProps) {
  const { id } = await params;

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
            Daily Apparatus Check
          </p>

          <h1 className="mt-2 text-5xl font-black tracking-tight text-white">
            {id.replace("-", " ").toUpperCase()}
          </h1>

          <p className="mt-3 text-neutral-400">
            Complete today's operational tasks.
          </p>
        </div>

        <InspectionStatus />

        <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8">
          <h2 className="text-2xl font-bold text-white">
            Today's Tasks
          </h2>

          <p className="mt-2 text-neutral-400">
            Redline HQ has determined these tasks are due today.
          </p>

          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Daily Apparatus Inspection
                  </h3>

                  <p className="mt-1 text-sm text-neutral-400">
                    Confirm the apparatus is ready for emergency response.
                  </p>
                </div>

                <button className="rounded-lg border border-neutral-700 px-4 py-2 text-white transition hover:bg-neutral-800">
                  Begin
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Engine Hours
                  </h3>

                  <p className="mt-1 text-sm text-neutral-400">
                    Example recurring task. This will only appear on scheduled days.
                  </p>
                </div>

                <span className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-black">
                  Due Today
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Weekly Pump Check
                  </h3>

                  <p className="mt-1 text-sm text-neutral-400">
                    Example recurring task. Scheduled automatically by Redline HQ.
                  </p>
                </div>

                <span className="rounded-full bg-neutral-700 px-3 py-1 text-sm font-bold text-white">
                  Not Due
                </span>
              </div>
            </div>
          </div>
        </div>

        <DailyCheckForm apparatusId={id} />

        <div className="flex justify-between">
          <Link
            href={`/apparatus/${id}`}
            className="rounded-xl border border-neutral-700 px-6 py-4 text-white transition hover:bg-neutral-800"
          >
            Back
          </Link>

          <button className="rounded-xl bg-red-600 px-8 py-4 text-lg font-bold text-white transition hover:bg-red-700">
            Complete Inspection
          </button>
        </div>
      </div>
    </PageLayout>
  );
}