"use client";

export type DepartmentRoleOption = {
  id: string;
  name: string;
  active: boolean;
};

interface DepartmentRoleSelectorProps {
  selectedRoleId: string | null;
  assignedRoleId?: string | null;
  departmentRoles: DepartmentRoleOption[];
  onChange: (roleId: string) => void;
  disabled?: boolean;
}

export default function DepartmentRoleSelector({
  selectedRoleId,
  assignedRoleId = null,
  departmentRoles,
  onChange,
  disabled = false,
}: DepartmentRoleSelectorProps) {
  const sortedRoles = [...departmentRoles].sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

  return (
    <label className="block text-sm text-neutral-300">
      Department Role
      <select
        value={selectedRoleId ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white focus:border-red-500/50 focus:outline-none"
      >
        <option value="">Unassigned</option>
        {sortedRoles.map((role) => (
          <option key={role.id} value={role.id} disabled={!role.active && role.id !== assignedRoleId}>
            {role.name}{role.active ? "" : " (Inactive)"}
          </option>
        ))}
      </select>
    </label>
  );
}
