"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TrainingCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type TrainingCategoryFormState = {
  name: string;
  description: string;
  active: boolean;
};

interface TrainingCategoriesSectionProps {
  departmentId: string;
  currentMemberId: string;
  trainingCategories: TrainingCategoryRow[];
}

function emptyFormState(): TrainingCategoryFormState {
  return {
    name: "",
    description: "",
    active: true,
  };
}

function normalizeCategoryName(value: string) {
  return value.trim().toLowerCase();
}

export default function TrainingCategoriesSection({
  departmentId,
  currentMemberId,
  trainingCategories,
}: TrainingCategoriesSectionProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(trainingCategories);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TrainingCategoryFormState>(emptyFormState());

  const orderedCategories = useMemo(() => {
    const active = categories.filter((category) => category.active);
    const inactive = categories.filter((category) => !category.active);
    return [...active, ...inactive];
  }, [categories]);

  function openAddModal() {
    setSaveError(null);
    setEditingCategoryId(null);
    setFormState(emptyFormState());
    setIsModalOpen(true);
  }

  function openEditModal(category: TrainingCategoryRow) {
    setSaveError(null);
    setEditingCategoryId(category.id);
    setFormState({
      name: category.name,
      description: category.description ?? "",
      active: category.active,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingCategoryId(null);
    setSaveError(null);
    setFormState(emptyFormState());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = formState.name.trim();
    const description = formState.description.trim();

    if (!name) {
      setSaveError("Category name is required.");
      return;
    }

    const normalizedName = normalizeCategoryName(name);
    const duplicateExists = categories.some((category) => {
      if (editingCategoryId && category.id === editingCategoryId) {
        return false;
      }

      return normalizeCategoryName(category.name) === normalizedName;
    });

    if (duplicateExists) {
      setSaveError("A training category with that name already exists in this department.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (editingCategoryId) {
        const { error } = await supabase
          .from("training_categories")
          .update({
            name,
            description: description || null,
            active: formState.active,
            updated_by: currentMemberId,
          })
          .eq("id", editingCategoryId)
          .eq("department_id", departmentId);

        if (error) {
          if (error.code === "23505") {
            setSaveError("A training category with that name already exists in this department.");
          } else {
            setSaveError(error.message || "Unable to update training category.");
          }
          setIsSaving(false);
          return;
        }

        setCategories((current) =>
          current.map((category) =>
            category.id === editingCategoryId
              ? {
                  ...category,
                  name,
                  description: description || null,
                  active: formState.active,
                  updated_at: new Date().toISOString(),
                }
              : category,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("training_categories")
          .insert({
            department_id: departmentId,
            name,
            description: description || null,
            active: formState.active,
            created_by: currentMemberId,
            updated_by: currentMemberId,
          })
          .select("id, name, description, active, created_at, updated_at")
          .single();

        if (error || !data) {
          if (error?.code === "23505") {
            setSaveError("A training category with that name already exists in this department.");
          } else {
            setSaveError(error?.message || "Unable to create training category.");
          }
          setIsSaving(false);
          return;
        }

        const insertedCategory: TrainingCategoryRow = {
          id: String(data.id),
          name: typeof data.name === "string" ? data.name : name,
          description: typeof data.description === "string" ? data.description : null,
          active: typeof data.active === "boolean" ? data.active : formState.active,
          created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
          updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
        };

        setCategories((current) => [...current, insertedCategory]);
      }

      setIsModalOpen(false);
      setEditingCategoryId(null);
      setFormState(emptyFormState());
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save training category.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Training Categories</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Define the training categories used by your department when logging training.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
        >
          + Add Training Category
        </button>
      </div>

      {orderedCategories.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
          <p>No training categories configured yet.</p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
          >
            + Add Training Category
          </button>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-neutral-800 bg-[#111111]">
          <table className="w-full">
            <thead className="border-b border-neutral-800 bg-neutral-950">
              <tr>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Name</th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Description</th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Status</th>
                <th className="px-6 py-4 text-right text-xs uppercase tracking-[0.18em] text-neutral-400">Edit</th>
              </tr>
            </thead>
          </table>

          <div className="max-h-[17.5rem] overflow-y-auto">
            <table className="w-full">
              <tbody>
                {orderedCategories.map((category) => (
                  <tr key={category.id} className="border-b border-neutral-800 transition hover:bg-neutral-800/60">
                    <td className="px-6 py-4 font-medium text-white">{category.name}</td>
                    <td className="px-6 py-4 text-neutral-300">{category.description?.trim() || "-"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                          category.active
                            ? "border-green-500/30 bg-green-500/10 text-green-300"
                            : "border-neutral-600/40 bg-neutral-800 text-neutral-300"
                        }`}
                      >
                        {category.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(category)}
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
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
          >
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-2xl font-black tracking-tight text-white">
                {editingCategoryId ? "Edit Training Category" : "Add Training Category"}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Keep category options clean and aligned with how your department logs training.
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
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Category Name *</span>
                  <input
                    value={formState.name}
                    onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
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

                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={formState.active}
                    onChange={(event) => setFormState((current) => ({ ...current, active: event.target.checked }))}
                    className="h-4 w-4 rounded border-white/10 bg-[#111111] text-red-500 focus:ring-red-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">Active</p>
                    <p className="text-xs text-neutral-400">Inactive categories stay on historical records but are hidden from new training event entry.</p>
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
                  {isSaving ? "Saving..." : editingCategoryId ? "Save Changes" : "Add Training Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}