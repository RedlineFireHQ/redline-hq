import PageLayout from "@/components/layout/PageLayout";
import MemberReadinessCard from "@/components/personnel/MemberReadinessCard";
import { members } from "@/lib/members";
import { notFound } from "next/navigation";

interface PersonnelProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PersonnelProfilePage({
  params,
}: PersonnelProfilePageProps) {
  const { id } = await params;

  const member = members.find((m) => m.id === id);

  if (!member) {
    notFound();
  }

  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="text-5xl font-bold">
          {member.firstName} {member.lastName}
        </h1>

        <p className="mt-2 text-2xl text-neutral-400">
          {member.rank}
        </p>
      </div>

      <div className="mb-8">
        <MemberReadinessCard score={96} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-6 text-2xl font-semibold">
            Member Information
          </h2>

          <div className="space-y-4 text-neutral-300">
            <p>
              <strong>Email:</strong> {member.email}
            </p>

            <p>
              <strong>Phone:</strong> {member.phone}
            </p>

            <p>
              <strong>Assigned Apparatus:</strong>{" "}
              {member.apparatusAssignments.join(", ")}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-6 text-2xl font-semibold">
            Qualifications
          </h2>

          {member.qualifications.length > 0 ? (
            <ul className="space-y-3">
              {member.qualifications.map((qualification) => (
                <li
                  key={qualification.id}
                  className="rounded-lg bg-neutral-800 px-4 py-3"
                >
                  <div className="font-medium">
                    {qualification.name}
                  </div>

                  {qualification.earnedDate && (
                    <div className="mt-1 text-sm text-neutral-400">
                      Earned: {qualification.earnedDate}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-neutral-400">
              No qualifications on file.
            </p>
          )}
        </div>
      </div>
    </PageLayout>
  );
}