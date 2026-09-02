"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TrainingCategoryRow = {
  id: string;
  name: string;
  active: boolean;
};

type CertificationTypeRow = {
  id: string;
  name: string;
  active: boolean;
};

type ReadinessRequirementRow = {
  id: string;
  name: string;
  requirement_kind: string;
  period_type: string;
  minimum_hours: number | string | null;
  category_id: string | null;
  due_frequency_rule: string | null;
  required_topic: string | null;
  active: boolean;
  sort_order: number;
  config_json: unknown;
  created_at: string;
  updated_at: string;
};

type RequirementEditorType =
  | "annual_hours"
  | "category_hours"
  | "required_certification"
  | "topic"
  | "recurring";

type RequirementFormState = {
  name: string;
  editorType: RequirementEditorType;
  periodType: string;
  minimumHours: string;
  categoryId: string;
  certificationId: string;
  requiredTopic: string;
  dueFrequencyRule: string;
  sortOrder: string;
  active: boolean;
};

interface ReadinessRequirementsSectionProps {
  departmentId: string;
  currentMemberId: string;
  trainingCategories: TrainingCategoryRow[];
  certificationTypes: CertificationTypeRow[];
  readinessRequirements: ReadinessRequirementRow[];
}

function parseConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      requirementSource: "",
      certificationId: "",
    };
  }

  const record = value as Record<string, unknown>;
  const sourceRaw = record.requirement_source ?? record.requirementSource ?? record.source;
  const certificationRaw = record.certification_id ?? record.certificationId;

  return {
    requirementSource: typeof sourceRaw === "string" ? sourceRaw : "",
    certificationId: typeof certificationRaw === "string" ? certificationRaw : "",
  };
}

function kindLabel(row: ReadinessRequirementRow) {
  const config = parseConfig(row.config_json);
  if (row.requirement_kind === "annual_hours") {
    return "Annual Hours";
  }

  if (row.requirement_kind === "category_hours") {
    return "Category Hours";
  }

  if (row.requirement_kind === "topic") {
    return "Topic";
  }

  if (row.requirement_kind === "recurring" && config.requirementSource === "certification") {
    return "Required Certification";
  }

  if (row.requirement_kind === "recurring") {
    return "Recurring";
  }

  return "Requirement";
}

function emptyFormState(): RequirementFormState {
  return {
    name: "",
    editorType: "annual_hours",
    periodType: "annual",
    minimumHours: "",
    categoryId: "",
    certificationId: "",
    requiredTopic: "",
    dueFrequencyRule: "",
    sortOrder: "0",
    active: true,
  };
}

function getEditorTypeFromRequirement(row: ReadinessRequirementRow): RequirementEditorType {
  const config = parseConfig(row.config_json);
  if (row.requirement_kind === "recurring" && config.requirementSource === "certification") {
    return "required_certification";
  }

  if (row.requirement_kind === "annual_hours") {
    return "annual_hours";
  }

  if (row.requirement_kind === "category_hours") {
    return "category_hours";
  }

  if (row.requirement_kind === "topic") {
    return "topic";
  }

  return "recurring";
}

export default function ReadinessRequirementsSection({
  departmentId,
  currentMemberId,
  trainingCategories,
  certificationTypes,
  readinessRequirements,
}: ReadinessRequirementsSectionProps) {
  const router = useRouter();
  const [requirements, setRequirements] = useState(readinessRequirements);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null);
  const [formState, setFormState] = useState<RequirementFormState>(emptyFormState());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const categoryById = useMemo(() => {
    return new Map(trainingCategories.map((row) => [row.id, row.name]));
  }, [trainingCategories]);

  const certificationById = useMemo(() => {
    return new Map(certificationTypes.map((row) => [row.id, row.name]));
  }, [certificationTypes]);

  const sortedRequirements = useMemo(() => {
    return [...requirements].sort((a, b) => {
      if (a.sort_order === b.sort_order) {
        return a.name.localeCompare(b.name);
      }

      return a.sort_order - b.sort_order;
    });
  }, [requirements]);

  function openAddModal() {
    setSaveError(null);
    setEditingRequirementId(null);
    setFormState(emptyFormState());
    setIsModalOpen(true);
  }

  function openEditModal(row: ReadinessRequirementRow) {
    const config = parseConfig(row.config_json);
    setSaveError(null);
    setEditingRequirementId(row.id);
    setFormState({
      name: row.name,
      editorType: getEditorTypeFromRequirement(row),
      periodType: row.period_type,
      minimumHours:
        typeof row.minimum_hours === "number"
          ? String(row.minimum_hours)
          : typeof row.minimum_hours === "string"
            ? row.minimum_hours
            : "",
      categoryId: row.category_id ?? "",
      certificationId: config.certificationId,
      requiredTopic: row.required_topic ?? "",
      dueFrequencyRule: row.due_frequency_rule ?? "",
      sortOrder: String(row.sort_order),
      active: row.active,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingRequirementId(null);
    setSaveError(null);
    setFormState(emptyFormState());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = formState.name.trim();
    const minimumHoursValue = Number.parseFloat(formState.minimumHours);
    const sortOrderValue = Number.parseInt(formState.sortOrder, 10);

    if (!trimmedName) {
      setSaveError("Requirement name is required.");
      return;
    }

    if (!Number.isFinite(sortOrderValue)) {
      setSaveError("Sort order must be a valid number.");
      return;
    }

    if (
      (formState.editorType === "annual_hours" ||
        formState.editorType === "category_hours" ||
        formState.editorType === "topic") &&
      (!Number.isFinite(minimumHoursValue) || minimumHoursValue <= 0)
    ) {
      setSaveError("Minimum hours is required and must be greater than 0.");
      return;
    }

    if (formState.editorType === "category_hours" && !formState.categoryId) {
      setSaveError("Category is required for category-hour requirements.");
      return;
    }

    if (formState.editorType === "required_certification" && !formState.certificationId) {
      setSaveError("Certification is required for required certification rules.");
      return;
    }

    if (formState.editorType === "topic" && !formState.requiredTopic.trim()) {
      setSaveError("Required topic is required for topic requirements.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const isCertificationRule = formState.editorType === "required_certification";

    const requirementKind =
      formState.editorType === "required_certification"
        ? "recurring"
        : formState.editorType;

    const configJson: Record<string, unknown> = {};

    if (isCertificationRule) {
      configJson.requirement_source = "certification";
      configJson.certification_id = formState.certificationId;
      configJson.rule = "certification_current";
    }

    if (formState.editorType === "recurring") {
      configJson.requirement_source = "custom";
    }

    const payload = {
      name: trimmedName,
      requirement_kind: requirementKind,
      period_type: formState.periodType,
      minimum_hours:
        formState.editorType === "annual_hours" ||
        formState.editorType === "category_hours" ||
        formState.editorType === "topic"
          ? minimumHoursValue
          : null,
      category_id: formState.editorType === "category_hours" ? formState.categoryId : null,
      due_frequency_rule:
        formState.editorType === "recurring"
          ? formState.dueFrequencyRule.trim() || null
          : null,
      required_topic:
        formState.editorType === "topic"
          ? formState.requiredTopic.trim()
          : null,
      active: formState.active,
      sort_order: sortOrderValue,
      config_json: configJson,
      updated_by: currentMemberId,
    };

    try {
      if (editingRequirementId) {
        const { error } = await supabase
          .from("training_requirements")
          .update(payload)
          .eq("id", editingRequirementId)
          .eq("department_id", departmentId);

        if (error) {
          setSaveError(error.message || "Unable to update readiness requirement.");
          setIsSaving(false);
          return;
        }

        setRequirements((current) =>
          current.map((row) =>
            row.id === editingRequirementId
              ? {
                  ...row,
                  ...payload,
                  id: row.id,
                  created_at: row.created_at,
                  updated_at: new Date().toISOString(),
                }
              : row,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("training_requirements")
          .insert({
            ...payload,
            department_id: departmentId,
            created_by: currentMemberId,
          })
          .select("id, name, requirement_kind, period_type, minimum_hours, category_id, due_frequency_rule, required_topic, active, sort_order, config_json, created_at, updated_at")
          .single();

        if (error || !data) {
          setSaveError(error?.message || "Unable to create readiness requirement.");
          setIsSaving(false);
          return;
        }

        const inserted: ReadinessRequirementRow = {
          id: String(data.id),
          name: typeof data.name === "string" ? data.name : payload.name,
          requirement_kind:
            typeof data.requirement_kind === "string"
              ? data.requirement_kind
              : payload.requirement_kind,
          period_type: typeof data.period_type === "string" ? data.period_type : payload.period_type,
          minimum_hours:
            typeof data.minimum_hours === "number" || typeof data.minimum_hours === "string"
              ? data.minimum_hours
              : payload.minimum_hours,
          category_id: typeof data.category_id === "string" ? data.category_id : payload.category_id,
          due_frequency_rule:
            typeof data.due_frequency_rule === "string" ? data.due_frequency_rule : payload.due_frequency_rule,
          required_topic:
            typeof data.required_topic === "string" ? data.required_topic : payload.required_topic,
          active: typeof data.active === "boolean" ? data.active : payload.active,
          sort_order: typeof data.sort_order === "number" ? data.sort_order : payload.sort_order,
          config_json: data.config_json,
          created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
          updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
        };

        setRequirements((current) => [...current, inserted]);
      }

      closeModal();
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save readiness requirement.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Readiness Requirements</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Define operational readiness requirements, including hours, category goals, certification rules, and recurring expectations.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
        >
          + Add Requirement
        </button>
      </div>

      {sortedRequirements.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
          <p>No readiness requirements configured yet.</p>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-neutral-500">Readiness scores stay unavailable until requirements are configured.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-neutral-800 bg-[#111111]">
          <table className="w-full">
            <thead className="border-b border-neutral-800 bg-neutral-950">
              <tr>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Requirement</th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Kind</th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">Status</th>
                <th className="px-6 py-4 text-right text-xs uppercase tracking-[0.18em] text-neutral-400">Edit</th>
              </tr>
            </thead>
            <tbody>
              {sortedRequirements.map((row) => {
                const config = parseConfig(row.config_json);
                const certName = config.certificationId ? certificationById.get(config.certificationId) : null;
                const categoryName = row.category_id ? categoryById.get(row.category_id) : null;

                return (
                  <tr key={row.id} className="border-b border-neutral-800 transition hover:bg-neutral-800/60">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{row.name}</p>
                      {certName ? <p className="mt-1 text-xs text-neutral-400">Certification: {certName}</p> : null}
                      {categoryName ? <p className="mt-1 text-xs text-neutral-400">Category: {categoryName}</p> : null}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-200">{kindLabel(row)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${row.active ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-neutral-600/40 bg-neutral-800 text-neutral-300"}`}>
                        {row.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(row)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-2xl font-black tracking-tight text-white">
                {editingRequirementId ? "Edit Readiness Requirement" : "Add Readiness Requirement"}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                These settings define department readiness expectations.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
              {saveError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {saveError}
                </div>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Requirement Name *</span>
                  <input
                    value={formState.name}
                    onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Requirement Type *</span>
                  <select
                    value={formState.editorType}
                    onChange={(event) => setFormState((current) => ({ ...current, editorType: event.target.value as RequirementEditorType }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  >
                    <option value="annual_hours">Required Annual Training Hours</option>
                    <option value="category_hours">Required Training Hours By Category</option>
                    <option value="required_certification">Required Certification</option>
                    <option value="topic">Required Topic Hours</option>
                    <option value="recurring">Other Recurring Requirement</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Period *</span>
                  <select
                    value={formState.periodType}
                    onChange={(event) => setFormState((current) => ({ ...current, periodType: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  >
                    <option value="annual">Annual</option>
                    <option value="rolling_30_days">Rolling 30 Days</option>
                    <option value="rolling_90_days">Rolling 90 Days</option>
                    <option value="rolling_365_days">Rolling 365 Days</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Sort Order *</span>
                  <input
                    type="number"
                    step="1"
                    value={formState.sortOrder}
                    onChange={(event) => setFormState((current) => ({ ...current, sortOrder: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                {(formState.editorType === "annual_hours" ||
                  formState.editorType === "category_hours" ||
                  formState.editorType === "topic") ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Minimum Hours *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.minimumHours}
                      onChange={(event) => setFormState((current) => ({ ...current, minimumHours: event.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                    />
                  </label>
                ) : null}

                {formState.editorType === "category_hours" ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Category *</span>
                    <select
                      value={formState.categoryId}
                      onChange={(event) => setFormState((current) => ({ ...current, categoryId: event.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                    >
                      <option value="">Select a category</option>
                      {trainingCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {formState.editorType === "required_certification" ? (
                  <label className="block md:col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Required Certification *</span>
                    <select
                      value={formState.certificationId}
                      onChange={(event) => setFormState((current) => ({ ...current, certificationId: event.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                    >
                      <option value="">Select a certification type</option>
                      {certificationTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {formState.editorType === "topic" ? (
                  <label className="block md:col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Required Topic *</span>
                    <input
                      value={formState.requiredTopic}
                      onChange={(event) => setFormState((current) => ({ ...current, requiredTopic: event.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                    />
                  </label>
                ) : null}

                {formState.editorType === "recurring" ? (
                  <label className="block md:col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Recurring Rule Description</span>
                    <input
                      value={formState.dueFrequencyRule}
                      onChange={(event) => setFormState((current) => ({ ...current, dueFrequencyRule: event.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                    />
                  </label>
                ) : null}

                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={formState.active}
                    onChange={(event) => setFormState((current) => ({ ...current, active: event.target.checked }))}
                    className="h-4 w-4 rounded border-white/10 bg-[#111111] text-red-500 focus:ring-red-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">Active Requirement</p>
                    <p className="text-xs text-neutral-400">Inactive requirements stay on history but are not counted in readiness scoring.</p>
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
                  {isSaving ? "Saving..." : editingRequirementId ? "Save Changes" : "Add Requirement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
