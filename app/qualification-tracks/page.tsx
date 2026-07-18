import PageLayout from "@/components/layout/PageLayout";

export default function QualificationTracksPage() {
  return (
    <PageLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Qualification Tracks</h1>

          <p className="mt-2 text-neutral-400">
            Create and manage qualification tracks that determine member
            readiness.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-2xl font-semibold">Coming Soon</h2>

          <p className="mt-3 text-neutral-400">
            Qualification Tracks will allow departments to define the
            requirements for operational roles such as Firefighter, Driver,
            Officer, EMT, Rescue Technician, and more.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}