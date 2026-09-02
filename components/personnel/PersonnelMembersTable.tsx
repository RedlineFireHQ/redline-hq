"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PersonnelMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  rank: string | null;
  active: boolean | null;
  department_role_name: string | null;
  role_requirement_label: string;
};

export default function PersonnelMembersTable({
  members,
}: {
  members: PersonnelMemberRow[];
}) {
  const visibleRowCount = 6;
  const headerHeightPx = 56;
  const rowHeightPx = 57;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");

  function isMemberActive(member: PersonnelMemberRow) {
    return member.active !== false;
  }

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return members.filter((member) => {
      const memberIsActive = isMemberActive(member);
      if (statusFilter === "active" && !memberIsActive) {
        return false;
      }

      if (statusFilter === "inactive" && memberIsActive) {
        return false;
      }

      if (!query) {
        return true;
      }

      const firstName = member.first_name?.trim().toLowerCase() ?? "";
      const lastName = member.last_name?.trim().toLowerCase() ?? "";
      const fullName = `${firstName} ${lastName}`.trim();
      const rank = member.rank?.trim().toLowerCase() ?? "";
      const departmentRole = member.department_role_name?.trim().toLowerCase() ?? "";

      return (
        firstName.includes(query) ||
        lastName.includes(query) ||
        fullName.includes(query) ||
        rank.includes(query) ||
        departmentRole.includes(query)
      );
    });
  }, [members, searchTerm, statusFilter]);

  const activeCount = useMemo(
    () => members.filter((member) => isMemberActive(member)).length,
    [members],
  );

  const inactiveCount = Math.max(0, members.length - activeCount);

  return (
    <>
      <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search firefighters..."
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-red-600 focus:outline-none"
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "active" | "inactive" | "all")}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white focus:border-red-600 focus:outline-none"
        >
          <option value="active">Active ({activeCount})</option>
          <option value="inactive">Inactive ({inactiveCount})</option>
          <option value="all">All Members ({members.length})</option>
        </select>
      </div>

      <div
        className="overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900"
        style={{ maxHeight: `${headerHeightPx + visibleRowCount * rowHeightPx}px` }}
      >
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950">
            <tr>
              <th className="px-6 py-4 text-left">Name</th>
              <th className="px-6 py-4 text-left">Rank</th>
              <th className="px-6 py-4 text-left">Department Role</th>
              <th className="px-6 py-4 text-left">Role Requirements</th>
              <th className="px-6 py-4 text-left">Status</th>
            </tr>
          </thead>

          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td className="px-6 py-8 text-center text-neutral-400" colSpan={5}>
                  No firefighters found matching your search.
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr key={member.id} className="h-[57px] border-b border-neutral-800 transition hover:bg-neutral-800">
                  <td className="px-6 py-4 font-medium">
                    <Link
                      href={`/personnel/${member.id}`}
                      className="text-white transition hover:text-red-500"
                    >
                      {`${member.first_name?.trim() ?? ""} ${member.last_name?.trim() ?? ""}`.trim() || "Unknown Member"}
                    </Link>
                  </td>

                  <td className="px-6 py-4">{member.rank?.trim() || "Unassigned"}</td>

                  <td className="px-6 py-4">{member.department_role_name?.trim() || "No role"}</td>

                  <td className="px-6 py-4">
                    {(() => {
                      const statusLabel = member.role_requirement_label.trim();
                      const normalizedLabel = statusLabel.toLowerCase();
                      const badgeClassName =
                        normalizedLabel === "complete"
                          ? "bg-green-600"
                          : normalizedLabel.includes("missing")
                            ? "bg-amber-600"
                            : "bg-neutral-600";

                      return (
                        <span className={`rounded-full px-3 py-1 text-sm font-medium text-white ${badgeClassName}`}>
                          {statusLabel}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="px-6 py-4">
                    {(() => {
                      const isActive = isMemberActive(member);
                      const statusLabel = isActive ? "Active" : "Inactive";

                      return (
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium text-white ${
                            isActive ? "bg-green-600" : "bg-red-600"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}