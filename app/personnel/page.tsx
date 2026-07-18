import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { members } from "@/lib/members";

export default function PersonnelPage() {
  return (
    <PageLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Personnel</h1>

          <p className="mt-2 text-neutral-400">
            Manage firefighters, officers, certifications, and availability.
          </p>
        </div>

        <button className="rounded-lg bg-red-600 px-5 py-3 font-semibold transition hover:bg-red-700">
          + Add Firefighter
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search firefighters..."
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-red-600 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
        <table className="w-full">
          <thead className="border-b border-neutral-800 bg-neutral-950">
            <tr>
              <th className="px-6 py-4 text-left">Name</th>
              <th className="px-6 py-4 text-left">Rank</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-left">Assigned Apparatus</th>
            </tr>
          </thead>

          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                className="border-b border-neutral-800 transition hover:bg-neutral-800"
              >
                <td className="px-6 py-4 font-medium">
                  <Link
                    href={`/personnel/${member.id}`}
                    className="text-white transition hover:text-red-500"
                  >
                    {member.firstName} {member.lastName}
                  </Link>
                </td>

                <td className="px-6 py-4">{member.rank}</td>

                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium text-white ${
                      member.active ? "bg-green-600" : "bg-red-600"
                    }`}
                  >
                    {member.active ? "Active" : "Inactive"}
                  </span>
                </td>

                <td className="px-6 py-4">
                  {member.apparatusAssignments.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}