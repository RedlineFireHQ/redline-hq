"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { supabase } from "@/lib/supabase";

type SelectOption = {
  id: string;
  label: string;
};

type ReportFormState = {
  categoryId: string;
  priorityId: string;
  apparatusId: string;
  description: string;
  location: string;
  photo: File | null;
};

const initialFormState: ReportFormState = {
  categoryId: "",
  priorityId: "",
  apparatusId: "",
  description: "",
  location: "",
  photo: null,
};

const STATION_SUPPLY_OPTION: SelectOption = {
  id: "station-supply",
  label: "Station Supply",
};

const FIRE_HOSE_CATEGORY_TOKEN = "fire hose";

function getRecordString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function normalizeOption(record: Record<string, unknown>): SelectOption {
  const idValue = record.id;
  const id = typeof idValue === "string" ? idValue : String(idValue ?? "");
  const label =
    getRecordString(record, ["name", "label", "title", "value", "category_name", "priority_name"]) || id;

  return { id, label };
}

export default function ReportDeficiencyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnToParam = searchParams.get("returnTo");
  const apparatusIdParam = searchParams.get("apparatusId");
  const inventoryCategoryParam = searchParams.get("inventoryCategory");
  const inventoryItemIdParam = searchParams.get("inventoryItemId");
  const inventoryItemLabelParam = searchParams.get("inventoryItemLabel");
  const failedHoseIdsParam = searchParams.get("failedHoseIds");
  const failedIndexParam = searchParams.get("failedIndex");
  const safeReturnTo =
    typeof returnToParam === "string" && returnToParam.startsWith("/") ? returnToParam : null;

  const inventoryCategory = typeof inventoryCategoryParam === "string" ? inventoryCategoryParam : "";
  const inventoryItemId = typeof inventoryItemIdParam === "string" ? inventoryItemIdParam : "";
  const inventoryItemLabel = typeof inventoryItemLabelParam === "string" ? inventoryItemLabelParam : "";
  const failedHoseIds =
    typeof failedHoseIdsParam === "string" && failedHoseIdsParam.trim().length > 0
      ? failedHoseIdsParam.split(",").map((value) => value.trim()).filter(Boolean)
      : [];
  const failedIndexCandidate = Number.parseInt(failedIndexParam ?? "0", 10);
  const failedIndex = Number.isFinite(failedIndexCandidate) ? Math.max(0, failedIndexCandidate) : 0;

  const [formState, setFormState] = useState<ReportFormState>({
    ...initialFormState,
    apparatusId: apparatusIdParam ?? "",
  });
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [priorities, setPriorities] = useState<SelectOption[]>([]);
  const [apparatusOptions, setApparatusOptions] = useState<SelectOption[]>([]);
  const [openStatusId, setOpenStatusId] = useState("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedInventoryItemLabel, setResolvedInventoryItemLabel] = useState(inventoryItemLabel);

  const backHref = safeReturnTo ?? "/deficiencies";

  useEffect(() => {
    setResolvedInventoryItemLabel(inventoryItemLabel);
  }, [inventoryItemLabel]);

  useEffect(() => {
    if (inventoryCategory.trim().toLowerCase() !== "fire-hose") {
      return;
    }

    if (!inventoryItemId || inventoryItemLabel) {
      return;
    }

    let isMounted = true;

    async function loadInventoryLabel() {
      const { data, error } = await supabase
        .from("fire_hose")
        .select("inventory_number")
        .eq("id", inventoryItemId)
        .maybeSingle();

      if (!isMounted || error) {
        return;
      }

      const nextLabel = typeof data?.inventory_number === "string" ? data.inventory_number : "";
      setResolvedInventoryItemLabel(nextLabel);
    }

    void loadInventoryLabel();

    return () => {
      isMounted = false;
    };
  }, [inventoryCategory, inventoryItemId, inventoryItemLabel]);

  useEffect(() => {
    if (inventoryCategory.trim().toLowerCase() !== "fire-hose") {
      return;
    }

    setFormState((current) => ({
      ...current,
      description: "",
      location: "",
      photo: null,
      apparatusId: current.apparatusId || STATION_SUPPLY_OPTION.id,
    }));
  }, [inventoryCategory, inventoryItemId]);

  const canSubmit = useMemo(() => {
    return (
      Boolean(formState.categoryId) &&
      Boolean(formState.priorityId) &&
      Boolean(formState.apparatusId) &&
      Boolean(formState.description.trim()) &&
      Boolean(openStatusId)
    );
  }, [formState, openStatusId]);

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
      setIsLoadingOptions(true);
      setErrorMessage(null);

      const [categoriesResult, prioritiesResult, apparatusResult, statusesResult] = await Promise.all([
        supabase.from("deficiency_categories").select("*").order("display_order"),
        supabase.from("deficiency_priorities").select("*").order("display_order"),
        supabase.from("apparatus").select("*").order("name"),
        supabase.from("deficiency_statuses").select("id, name").order("display_order"),
      ]);

      if (!isMounted) {
        return;
      }

      if (
        categoriesResult.error ||
        prioritiesResult.error ||
        apparatusResult.error ||
        statusesResult.error
      ) {
        setErrorMessage(
          categoriesResult.error?.message ||
            prioritiesResult.error?.message ||
            apparatusResult.error?.message ||
            statusesResult.error?.message ||
            "Unable to load deficiency form options."
        );
        setIsLoadingOptions(false);
        return;
      }

      setCategories((categoriesResult.data ?? []).map((record) => normalizeOption(record as Record<string, unknown>)));
      setPriorities((prioritiesResult.data ?? []).map((record) => normalizeOption(record as Record<string, unknown>)));
      setApparatusOptions((apparatusResult.data ?? []).map((record) => normalizeOption(record as Record<string, unknown>)));

      if (inventoryCategory.trim().toLowerCase() === "fire-hose") {
        const fireHoseCategory = (categoriesResult.data ?? [])
          .map((record) => normalizeOption(record as Record<string, unknown>))
          .find((option) => option.label.trim().toLowerCase().includes(FIRE_HOSE_CATEGORY_TOKEN));

        if (fireHoseCategory) {
          setFormState((current) => ({
            ...current,
            categoryId: current.categoryId || fireHoseCategory.id,
            apparatusId: current.apparatusId || STATION_SUPPLY_OPTION.id,
          }));
        }
      }

      const resolvedOpenStatus = (statusesResult.data ?? []).find((statusRow) => {
        const status = statusRow as Record<string, unknown>;
        return typeof status.name === "string" && status.name.trim().toLowerCase() === "open";
      }) as Record<string, unknown> | undefined;

      const resolvedOpenStatusId = typeof resolvedOpenStatus?.id === "string" ? resolvedOpenStatus.id : "";
      setOpenStatusId(resolvedOpenStatusId);
      setIsLoadingOptions(false);
    }

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [inventoryCategory]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setErrorMessage("Complete all required fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const deficiencyId = crypto.randomUUID();
    let uploadedPhotoPath: string | null = null;

    if (formState.photo) {
      const sanitizedName = formState.photo.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "photo.jpg";
      const photoPath = `${deficiencyId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from("deficiency-photos")
        .upload(photoPath, formState.photo, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        setErrorMessage(uploadError.message || "Unable to upload photo.");
        setIsSubmitting(false);
        return;
      }

      uploadedPhotoPath = photoPath;
    }

    const now = new Date().toISOString();
    const isFireHoseDeficiency = inventoryCategory.trim().toLowerCase() === "fire-hose";
    const payload = {
      id: deficiencyId,
      category_id: formState.categoryId,
      priority: formState.priorityId,
      apparatus_id: formState.apparatusId === STATION_SUPPLY_OPTION.id ? null : formState.apparatusId,
      description: formState.description.trim(),
      location: formState.location.trim() || null,
      reported_at: now,
      created_at: now,
      status: openStatusId,
      photo_path: uploadedPhotoPath,
      fire_hose_id: isFireHoseDeficiency && inventoryItemId ? inventoryItemId : null,
    };

    console.log("[fire-hose][deficiency-create] payload", JSON.stringify(payload, null, 2));
    console.log("[fire-hose][deficiency-create] context", {
      inventoryCategory,
      inventoryItemId,
      isFireHoseDeficiency,
      currentUrl: typeof window !== "undefined" ? window.location.href : null,
      searchParams: searchParams.toString(),
    });

    const insertResult = await supabase.from("deficiencies").insert(payload).select("id").single();

    if (insertResult.error) {
      setErrorMessage(insertResult.error.message || "Unable to submit deficiency right now.");
      setIsSubmitting(false);
      return;
    }

    const insertedDeficiencyId =
      typeof insertResult.data?.id === "string" ? insertResult.data.id : deficiencyId;

    await supabase.from("deficiency_history").insert({
      deficiency_id: insertedDeficiencyId,
      event_type: "Reported",
      event_description: "Deficiency reported.",
      member_id: null,
    });

    if (isFireHoseDeficiency && inventoryItemId) {
      const { data: updatedHose, error: hoseUpdateError } = await supabase
        .from("fire_hose")
        .update({ status: "Out of Service" })
        .eq("id", inventoryItemId)
        .select("id, status")
        .single();

      if (hoseUpdateError || !updatedHose || updatedHose.id !== inventoryItemId) {
        const message = hoseUpdateError?.message || "Failed to update expected fire hose row.";
        console.error("[fire-hose][deficiency-create] update mismatch", {
          expectedHoseId: inventoryItemId,
          actualRow: updatedHose ?? null,
          error: hoseUpdateError ?? null,
        });
        setErrorMessage(message);
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);

    if (
      inventoryCategory.trim().toLowerCase() === "fire-hose" &&
      failedHoseIds.length > 0 &&
      failedIndex < failedHoseIds.length - 1
    ) {
      const nextIndex = failedIndex + 1;
      const nextHoseId = failedHoseIds[nextIndex];
      const params = new URLSearchParams();

      if (safeReturnTo) {
        params.set("returnTo", safeReturnTo);
      }

      if (apparatusIdParam) {
        params.set("apparatusId", apparatusIdParam);
      }

      params.set("inventoryCategory", "fire-hose");
      params.set("inventoryItemId", nextHoseId);
      params.set("failedHoseIds", failedHoseIds.join(","));
      params.set("failedIndex", String(nextIndex));

      router.push(`/deficiencies/report?${params.toString()}`);
      return;
    }

    if (safeReturnTo) {
      router.push(safeReturnTo);
      return;
    }

    router.push(`/operations/deficiencies/${insertedDeficiencyId}`);
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
        >
          Back
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">Deficiency Workflow</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Report Deficiency</h1>
          <p className="mt-2 text-zinc-400">Capture a new deficiency using the standard application layout.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {errorMessage ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</div>
            ) : null}

            {isLoadingOptions ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">Loading form options...</div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              {inventoryCategory.trim().toLowerCase() === "fire-hose" && resolvedInventoryItemLabel ? (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-zinc-200">Inventory Item</span>
                  <div className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-zinc-300">
                    {resolvedInventoryItemLabel}
                  </div>
                </label>
              ) : null}

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Apparatus</span>
                <select
                  value={formState.apparatusId}
                  onChange={(event) => setFormState((current) => ({ ...current, apparatusId: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                >
                  <option value="">Select apparatus</option>
                  {[STATION_SUPPLY_OPTION, ...apparatusOptions].map((option) => (
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
                  {categories.map((option) => (
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
                  {priorities.map((option) => (
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

              <div className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Photo</span>
                <input
                  id="deficiency-photo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      photo: event.target.files && event.target.files.length > 0 ? event.target.files[0] : null,
                    }))
                  }
                  className="sr-only"
                />
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="deficiency-photo-upload"
                    className="inline-flex cursor-pointer items-center rounded-xl border border-red-500/30 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
                  >
                    Add Photo
                  </label>
                  <span className="text-sm text-zinc-300">
                    {formState.photo ? formState.photo.name : "No photo selected"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
              <Link
                href={backHref}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting || isLoadingOptions}
                className="rounded-xl border border-red-500/30 bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Submit Deficiency"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
