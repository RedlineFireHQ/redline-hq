"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { supabase } from "@/lib/supabase";

type SelectOption = {
  id: string;
  label: string;
};

type FormState = {
  apparatusId: string;
  description: string;
  location: string;
  categoryId: string;
  priorityId: string;
  statusId: string;
};

const initialFormState: FormState = {
  apparatusId: "",
  description: "",
  location: "",
  categoryId: "",
  priorityId: "",
  statusId: "",
};

function getRecordString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function normalizeSelectOption(record: Record<string, unknown>): SelectOption {
  const idValue = record.id;
  const id = typeof idValue === "string" ? idValue : String(idValue ?? "");
  const label =
    getRecordString(record, ["name", "label", "title", "value", "category_name", "priority_name"]) || id;

  return { id, label };
}

function resolveOptionId(options: SelectOption[], rawValue: string | null | undefined): string {
  const normalizedRawValue = rawValue?.trim();

  if (!normalizedRawValue) {
    return "";
  }

  const exactIdMatch = options.find((option) => option.id === normalizedRawValue);
  if (exactIdMatch) {
    return exactIdMatch.id;
  }

  const labelMatch = options.find(
    (option) => option.label.trim().toLowerCase() === normalizedRawValue.toLowerCase()
  );

  return labelMatch?.id ?? normalizedRawValue;
}

export default function EditDeficiencyPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const deficiencyId = params.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [apparatusOptions, setApparatusOptions] = useState<SelectOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<SelectOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<SelectOption[]>([]);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
      setIsLoading(true);
      setOptionsError(null);

      const [apparatusResult, categoriesResult, prioritiesResult, statusesResult, deficiencyResult] =
        await Promise.all([
          supabase.from("apparatus").select("*").order("name"),
          supabase.from("deficiency_categories").select("*").order("display_order"),
          supabase.from("deficiency_priorities").select("*").order("display_order"),
          supabase.from("deficiency_statuses").select("*").order("display_order"),
          supabase
            .from("deficiencies")
            .select("apparatus_id, description, location, category_id, priority, status, photo_path")
            .eq("id", deficiencyId)
            .maybeSingle(),
        ]);

      if (!isMounted) {
        return;
      }

      if (
        apparatusResult.error ||
        categoriesResult.error ||
        prioritiesResult.error ||
        statusesResult.error ||
        deficiencyResult.error ||
        !deficiencyResult.data
      ) {
        setOptionsError(
          apparatusResult.error?.message ||
            categoriesResult.error?.message ||
            prioritiesResult.error?.message ||
            statusesResult.error?.message ||
            deficiencyResult.error?.message ||
            "Unable to load edit options."
        );
        setIsLoading(false);
        return;
      }

      const normalizedApparatusOptions = (apparatusResult.data ?? []).map((record) =>
        normalizeSelectOption(record as Record<string, unknown>)
      );
      const normalizedCategoryOptions = (categoriesResult.data ?? []).map((record) =>
        normalizeSelectOption(record as Record<string, unknown>)
      );
      const normalizedPriorityOptions = (prioritiesResult.data ?? []).map((record) =>
        normalizeSelectOption(record as Record<string, unknown>)
      );
      const normalizedStatusOptions = (statusesResult.data ?? []).map((record) =>
        normalizeSelectOption(record as Record<string, unknown>)
      );

      setApparatusOptions(normalizedApparatusOptions);
      setCategoryOptions(normalizedCategoryOptions);
      setPriorityOptions(normalizedPriorityOptions);
      setStatusOptions(normalizedStatusOptions);

      const deficiency = deficiencyResult.data as Record<string, unknown>;
      const apparatusId = typeof deficiency.apparatus_id === "string" ? deficiency.apparatus_id : "";
      const description = typeof deficiency.description === "string" ? deficiency.description : "";
      const location = typeof deficiency.location === "string" ? deficiency.location : "";
      const categoryId = typeof deficiency.category_id === "string" ? deficiency.category_id : "";
      const priorityIdRaw = typeof deficiency.priority === "string" ? deficiency.priority : "";
      const statusIdRaw = typeof deficiency.status === "string" ? deficiency.status : "";

      setFormState({
        apparatusId,
        description,
        location,
        categoryId,
        priorityId: resolveOptionId(normalizedPriorityOptions, priorityIdRaw),
        statusId: resolveOptionId(normalizedStatusOptions, statusIdRaw),
      });

      const photoPath = typeof deficiency.photo_path === "string" ? deficiency.photo_path : "";
      const resolvedPhotoUrl = photoPath
        ? supabase.storage.from("deficiency-photos").getPublicUrl(photoPath).data.publicUrl
        : null;
      setPhotoUrl(resolvedPhotoUrl);
      setIsLoading(false);
    }

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [deficiencyId]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !formState.apparatusId ||
      !formState.categoryId ||
      !formState.priorityId ||
      !formState.statusId ||
      !formState.description.trim()
    ) {
      setSaveError("Complete all required fields before saving.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const updatePayload = {
      apparatus_id: formState.apparatusId,
      category_id: formState.categoryId,
      priority: formState.priorityId,
      status: formState.statusId,
      description: formState.description.trim(),
      location: formState.location.trim() || null,
    };

    const { error } = await supabase.from("deficiencies").update(updatePayload).eq("id", deficiencyId);

    if (error) {
      setSaveError(error.message);
      setIsSaving(false);
      return;
    }

    await supabase.from("deficiency_history").insert({
      deficiency_id: deficiencyId,
      member_id: null,
      event_type: "Edited",
      event_description: "Deficiency details updated.",
    });

    setIsSaving(false);
    router.push(`/operations/deficiencies/${deficiencyId}`);
    router.refresh();
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href={`/operations/deficiencies/${deficiencyId}`}
          className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
        >
          Back to Deficiency
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">Deficiency Workflow</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Edit Deficiency</h1>
          <p className="mt-2 text-zinc-400">Update deficiency details and readiness metadata.</p>

          <form onSubmit={handleSave} className="mt-8 space-y-6">
            {optionsError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{optionsError}</div>
            ) : null}

            {saveError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{saveError}</div>
            ) : null}

            {isLoading ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">Loading edit options...</div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Apparatus</span>
                <select
                  value={formState.apparatusId}
                  onChange={(event) => setFormState((current) => ({ ...current, apparatusId: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                >
                  <option value="">Select apparatus</option>
                  {apparatusOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Category</span>
                <select
                  value={formState.categoryId}
                  onChange={(event) => setFormState((current) => ({ ...current, categoryId: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                >
                  <option value="">Select category</option>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Priority</span>
                <select
                  value={formState.priorityId}
                  onChange={(event) => setFormState((current) => ({ ...current, priorityId: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                >
                  <option value="">Select priority</option>
                  {priorityOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Status</span>
                <select
                  value={formState.statusId}
                  onChange={(event) => setFormState((current) => ({ ...current, statusId: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                >
                  <option value="">Select status</option>
                  {statusOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Description</span>
                <textarea
                  rows={4}
                  value={formState.description}
                  onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Location</span>
                <input
                  type="text"
                  value={formState.location}
                  onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                />
              </label>
            </div>

            {photoUrl ? (
              <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Current Photo</p>
                <a href={photoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block overflow-hidden rounded-lg border border-white/10">
                  <img src={photoUrl} alt="Deficiency" className="h-44 w-auto max-w-full object-cover" />
                </a>
              </div>
            ) : null}

            <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
              <Link
                href={`/operations/deficiencies/${deficiencyId}`}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="rounded-xl border border-red-500/30 bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
