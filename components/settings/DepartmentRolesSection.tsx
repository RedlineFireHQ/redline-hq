"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type DepartmentRoleRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type DepartmentRoleFormState = {
  name: string;
  code: string;
  description: string;
  sort_order: string;
  active: boolean;
};

interface DepartmentRolesSectionProps {
  departmentId: string;
  currentMemberId: string;
  departmentRoles: DepartmentRoleRow[];
}

function emptyFormState(): DepartmentRoleFormState {
  return {
    name: "",
    code: "",
    description: "",
    sort_order: "0",
    active: true,
  };
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

export default function DepartmentRolesSection({
  departmentId,
  currentMemberId,
  departmentRoles,
}: DepartmentRolesSectionProps) {
  const router = useRouter();
  const [roles, setRoles] = useState(departmentRoles);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [formState, setFormState] = useState<DepartmentRoleFormState>(emptyFormState());

  const orderedRoles = useMemo(() => {
    const active = roles.filter((role) => role.active);
    const inactive = roles.filter((role) => !role.active);

    return [...active, ...inactive].sort((left, right) => {
      if (left.active !== right.active) {
        return left.active ? -1 : 1;
      }

      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
      }

      return left.name.localeCompare(right.name);
    });
  }, [roles]);

  function openAddModal() {
    setSaveError(null);
    setEditingRoleId(null);
    setFormState(emptyFormState());
    setIsModalOpen(true);
  }

  function openEditModal(role: DepartmentRoleRow) {
    setSaveError(null);
    setEditingRoleId(role.id);
    setFormState({
      name: role.name,
      code: role.code,
      description: role.description ?? "",
      sort_order: String(role.sort_order),
      active: role.active,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingRoleId(null);
    setSaveError(null);
    setFormState(emptyFormState());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = formState.name.trim();
    const code = formState.code.trim();
    const description = formState.description.trim();
    const sortOrderValue = Number.parseInt(formState.sort_order, 10);

    if (!name) {
      setSaveError("Role name is required.");
      return;
    }

    if (!code) {
      setSaveError("Role code is required.");
      return;
    }

    if (!Number.isFinite(sortOrderValue)) {
      setSaveError("Sort order must be a valid number.");
      return;
    }

    const duplicateName = roles.some((role) => {
      if (editingRoleId && role.id === editingRoleId) {
        return false;
      }

      return normalizeValue(role.name) === normalizeValue(name);
    });

    if (duplicateName) {
      setSaveError("A role with that name already exists in this department.");
      return;
    }

    const duplicateCode = roles.some((role) => {
      if (editingRoleId && role.id === editingRoleId) {
        return false;
      }

      return normalizeValue(role.code) === normalizeValue(code);
    });

    if (duplicateCode) {
      setSaveError("A role with that code already exists in this department.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (editingRoleId) {
        const { error } = await supabase
          .from("department_roles")
          .update({
            name,
            code,
            description: description || null,
            sort_order: sortOrderValue,
            active: formState.active,
            updated_by: currentMemberId,
          })
          .eq("id", editingRoleId)
          .eq("department_id", departmentId);

        if (error) {
          if (error.code === "23505") {
            setSaveError("A role with that name or code already exists in this department.");
          } else {
            setSaveError(error.message || "Unable to update department role.");
          }
          setIsSaving(false);
          return;
        }

        setRoles((current) =>
          current.map((role) =>
            role.id === editingRoleId
              ? {
                  ...role,
                  name,
                  code,
                  description: description || null,
                  sort_order: sortOrderValue,
                  active: formState.active,
                  updated_at: new Date().toISOString(),
                }
              : role,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("department_roles")
          .insert({
            department_id: departmentId,
            name,
            code,
            description: description || null,
            sort_order: sortOrderValue,
            active: formState.active,
            created_by: currentMemberId,
            updated_by: currentMemberId,
          })
          .select("id, name, code, description, active, sort_order, created_at, updated_at")
          .single();

        if (error || !data) {
          if (error?.code === "23505") {
            setSaveError("A role with that name or code already exists in this department.");
          } else {
            setSaveError(error?.message || "Unable to create department role.");
          }
          setIsSaving(false);
          return;
        }

        const insertedRole: DepartmentRoleRow = {
          id: String(data.id),
          name: typeof data.name === "string" ? data.name : name,
          code: typeof data.code === "string" ? data.code : code,
          description: typeof data.description === "string" ? data.description : null,
          active: typeof data.active === "boolean" ? data.active : formState.active,
          sort_order: typeof data.sort_order === "number" ? data.sort_order : sortOrderValue,
          created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
          updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
        };

        setRoles((current) => [...current, insertedRole]);
      }

      setIsModalOpen(false);
      setEditingRoleId(null);
      setSaveError(null);
      setFormState(emptyFormState());
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save department role.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Department Roles</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Define the department role catalog used to organize operational assignments and future role-based requirements.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
        >
          + Add Department Role
        </button>
      </div>

      {orderedRoles.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
          No department roles configured for this department yet.
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-neutral-800 bg-[#111111]">
          <table className="w-full">
            <thead className="border-b border-neutral-800 bg-neutral-950">
              <tr>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Name</th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Code</th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Description</th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Sort</th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Status</th>
                <th className="px-6 py-4 text-right text-xs uppercase tracking-[0.18em] text-neutral-400">Edit</th>
              </tr>
            </thead>
            <tbody>
              {orderedRoles.map((role) => (
                <tr key={role.id} className="border-b border-neutral-800 transition hover:bg-neutral-800/60">
                  <td className="px-6 py-4 font-medium text-white">{role.name}</td>
                  <td className="px-6 py-4 text-neutral-300">{role.code}</td>
                  <td className="px-6 py-4 text-neutral-300">{role.description?.trim() || "-"}</td>
                  <td className="px-6 py-4 text-neutral-300">{role.sort_order}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                        role.active
                          ? "border-green-500/30 bg-green-500/10 text-green-300"
                          : "border-neutral-600/40 bg-neutral-800 text-neutral-300"
                      }`}
                    >
                      {role.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openEditModal(role)}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-2xl font-black tracking-tight text-white">
                {editingRoleId ? "Edit Department Role" : "Add Department Role"}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Manage the department’s role catalog without changing the legacy member role access-control field.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
              {saveError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {saveError}
                </div>
              ) : null}

              <div className="grid gap-5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Name *</span>
                  <input
                    value={formState.name}
                    onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Code *</span>
                  <input
                    value={formState.code}
                    onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Description</span>
                  <textarea
                    rows={4}
                    value={formState.description}
                    onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Sort Order</span>
                  <input
                    type="number"
                    value={formState.sort_order}
                    onChange={(event) => setFormState((current) => ({ ...current, sort_order: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={formState.active}
                    onChange={(event) => setFormState((current) => ({ ...current, active: event.target.checked }))}
                    className="h-4 w-4 rounded border-white/10 bg-[#111111] text-red-500 focus:ring-red-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">Active</p>
                    <p className="text-xs text-neutral-400">Inactive roles remain saved to the department catalog but are hidden from active role selection when used later.</p>
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-white/10 bg-[#151515] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d1d1d]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : editingRoleId ? "Save Changes" : "Add Department Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
