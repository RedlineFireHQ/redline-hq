"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CertificationTypeRow = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type CertificationTypeFormState = {
  name: string;
  active: boolean;
};

interface CertificationTypesSectionProps {
  departmentId: string;
  currentMemberId: string;
  certificationTypes: CertificationTypeRow[];
}

function emptyFormState(): CertificationTypeFormState {
  return {
    name: "",
    active: true,
  };
}

export default function CertificationTypesSection({
  departmentId,
  currentMemberId,
  certificationTypes,
}: CertificationTypesSectionProps) {
  const router = useRouter();
  const [types, setTypes] = useState(certificationTypes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CertificationTypeFormState>(emptyFormState());

  const sortedTypes = useMemo(() => {
    return [...types].sort((left, right) => left.name.localeCompare(right.name));
  }, [types]);

  function openAddModal() {
    setSaveError(null);
    setEditingTypeId(null);
    setFormState(emptyFormState());
    setIsModalOpen(true);
  }

  function openEditModal(type: CertificationTypeRow) {
    setSaveError(null);
    setEditingTypeId(type.id);
    setFormState({
      name: type.name,
      active: type.active,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingTypeId(null);
    setSaveError(null);
    setFormState(emptyFormState());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = formState.name.trim();

    if (!name) {
      setSaveError("Certification type name is required.");
      return;
    }

    const duplicateExists = types.some((type) => {
      if (editingTypeId && type.id === editingTypeId) {
        return false;
      }

      return type.name.trim().toLowerCase() === name.toLowerCase();
    });

    if (duplicateExists) {
      setSaveError("A certification type with that name already exists in this department.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (editingTypeId) {
        const { error } = await supabase
          .from("certifications")
          .update({
            name,
            active: formState.active,
            updated_by: currentMemberId,
          })
          .eq("id", editingTypeId)
          .eq("department_id", departmentId);

        if (error) {
          if (error.code === "23505") {
            setSaveError("A certification type with that name already exists in this department.");
          } else {
            setSaveError(error.message || "Unable to update certification type.");
          }
          setIsSaving(false);
          return;
        }

        setTypes((current) =>
          current.map((type) =>
            type.id === editingTypeId
              ? {
                  ...type,
                  name,
                  active: formState.active,
                  updated_at: new Date().toISOString(),
                }
              : type,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("certifications")
          .insert({
            department_id: departmentId,
            name,
            active: formState.active,
            created_by: currentMemberId,
            updated_by: currentMemberId,
          })
          .select("id, name, active, created_at, updated_at")
          .single();

        if (error || !data) {
          if (error?.code === "23505") {
            setSaveError("A certification type with that name already exists in this department.");
          } else {
            setSaveError(error?.message || "Unable to create certification type.");
          }
          setIsSaving(false);
          return;
        }

        const insertedType: CertificationTypeRow = {
          id: String(data.id),
          name: typeof data.name === "string" ? data.name : name,
          active: typeof data.active === "boolean" ? data.active : formState.active,
          created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
          updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
        };

        setTypes((current) => [...current, insertedType]);
      }

      setIsModalOpen(false);
      setEditingTypeId(null);
      setFormState(emptyFormState());
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save certification type.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Certification Catalog</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Manage your department&apos;s certification names. This catalog is the source list used when assigning certifications to members and roles.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
        >
          + Add Certification
        </button>
      </div>

      {sortedTypes.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
          No certifications have been configured for this department yet.
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-neutral-800 bg-[#111111]">
          <table className="w-full">
            <thead className="border-b border-neutral-800 bg-neutral-950">
              <tr>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Name</th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Status</th>
                <th className="px-6 py-4 text-right text-xs uppercase tracking-[0.18em] text-neutral-400">Edit</th>
              </tr>
            </thead>
          </table>

          <div className="max-h-[17.5rem] overflow-y-auto">
            <table className="w-full">
              <tbody>
                {sortedTypes.map((type) => (
                  <tr key={type.id} className="border-b border-neutral-800 transition hover:bg-neutral-800/60">
                    <td className="px-6 py-4 font-medium text-white">{type.name}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${type.active ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-neutral-600/40 bg-neutral-800 text-neutral-300"}`}>
                        {type.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(type)}
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
        </div>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-2xl font-black tracking-tight text-white">
                {editingTypeId ? "Edit Certification" : "Add Certification"}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Keep the department certification catalog clean and reusable.
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

                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={formState.active}
                    onChange={(event) => setFormState((current) => ({ ...current, active: event.target.checked }))}
                    className="h-4 w-4 rounded border-white/10 bg-[#111111] text-red-500 focus:ring-red-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">Active</p>
                    <p className="text-xs text-neutral-400">Inactive types remain on historical records but are hidden from new certification entry.</p>
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
                  {isSaving ? "Saving..." : editingTypeId ? "Save Changes" : "Add Certification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}