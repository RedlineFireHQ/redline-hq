"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { EMS_CORE_TOPICS, type EmsCoreTopicCode } from "@/lib/ems/requirements";
import { triggerEmsAllocationRecalculation } from "@/lib/ems/recalculate-client";
import { supabase } from "@/lib/supabase";

type TrainingCategoryRow = {
  id: string;
  name: string;
  active: boolean;
};

type EmsCourseDefinitionRow = {
  id: string;
  course_name: string;
  active: boolean;
};

export type SubmittedTrainingRow = {
  id: string;
  member_id: string;
  title: string;
  category_id: string | null;
  training_date: string;
  hours: number | null;
  is_ems_training: boolean;
  ems_core_topic: string | null;
  ems_course_definition_id: string | null;
  ems_needs_review: boolean;
  ems_provider_name: string | null;
  description: string | null;
  notes: string | null;
  status: string;
  review_required: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmittedTrainingEvidenceRow = {
  id: string;
  submission_id: string;
  member_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
};

type OutsideTrainingFormState = {
  title: string;
  categoryId: string;
  emsCoreTopic: EmsCoreTopicCode;
  emsCourseDefinitionId: string;
  emsNeedsReview: boolean;
  emsProviderName: string;
  dateCompleted: string;
  hours: string;
  trainingMethod: string[];
  instructorName: string;
  location: string;
  details: string;
};

const TRAINING_METHOD_OPTIONS = [
  "Classroom / Discussion",
  "Hands-On",
  "Demonstration",
  "Drill / Scenario",
  "Video / Online",
  "Self-Reported Training",
  "Other",
] as const;

const TRAINING_METHOD_DELIMITER = " | ";

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function emptyOutsideTrainingFormState(defaultCategoryId: string): OutsideTrainingFormState {
  return {
    title: "",
    categoryId: defaultCategoryId,
    emsCoreTopic: "other",
    emsCourseDefinitionId: "",
    emsNeedsReview: false,
    emsProviderName: "",
    dateCompleted: getTodayDateKey(),
    hours: "",
    trainingMethod: [],
    instructorName: "",
    location: "",
    details: "",
  };
}

function isEmsCategoryName(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase() === "ems";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildOutsideSubmissionNotes(input: {
  trainingMethod: string;
  instructorName: string;
  location: string;
}) {
  const lines: string[] = [];

  if (input.trainingMethod.trim()) {
    lines.push(`Method: ${input.trainingMethod.trim()}`);
  }

  if (input.instructorName.trim()) {
    lines.push(`Instructor: ${input.instructorName.trim()}`);
  }

  if (input.location.trim()) {
    lines.push(`Location: ${input.location.trim()}`);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

interface SubmitTrainingModalProps {
  departmentId: string;
  currentMemberId: string;
  categories: TrainingCategoryRow[];
  emsCourseDefinitions: EmsCourseDefinitionRow[];
  variant?: "inline" | "modal";
  open?: boolean;
  onClose?: () => void;
  onSubmitted?: (submission: SubmittedTrainingRow, evidence: SubmittedTrainingEvidenceRow | null) => void;
}

export default function SubmitTrainingModal({
  departmentId,
  currentMemberId,
  categories,
  emsCourseDefinitions,
  variant = "modal",
  open = true,
  onClose,
  onSubmitted,
}: SubmitTrainingModalProps) {
  const router = useRouter();

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );

  const activeEmsCourseDefinitions = useMemo(
    () =>
      emsCourseDefinitions
        .filter((course) => course.active)
        .sort((a, b) => a.course_name.localeCompare(b.course_name)),
    [emsCourseDefinitions],
  );

  const [outsideFormState, setOutsideFormState] = useState<OutsideTrainingFormState>(
    emptyOutsideTrainingFormState(activeCategories[0]?.id ?? ""),
  );
  const [outsideProofFile, setOutsideProofFile] = useState<File | null>(null);
  const [outsideSaveError, setOutsideSaveError] = useState<string | null>(null);
  const [outsideSuccessMessage, setOutsideSuccessMessage] = useState<string | null>(null);
  const [isSavingOutside, setIsSavingOutside] = useState(false);
  const outsideProofInputRef = useRef<HTMLInputElement | null>(null);

  const isModal = variant === "modal";

  async function handleSubmitOutsideTraining(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = outsideFormState.title.trim();
    const trainingMethod = outsideFormState.trainingMethod.join(TRAINING_METHOD_DELIMITER);
    const instructorName = outsideFormState.instructorName.trim();
    const location = outsideFormState.location.trim();
    const details = outsideFormState.details.trim();
    const emsProviderName = outsideFormState.emsProviderName.trim();
    const selectedCategoryForEms = activeCategories.find((category) => category.id === outsideFormState.categoryId);
    const isEmsTraining = isEmsCategoryName(selectedCategoryForEms?.name);
    const emsCourseDefinitionId = isEmsTraining ? (outsideFormState.emsCourseDefinitionId || null) : null;
    const emsCoreTopic = isEmsTraining ? outsideFormState.emsCoreTopic : null;
    const emsNeedsReview =
      isEmsTraining && (outsideFormState.emsNeedsReview || outsideFormState.emsCoreTopic === "other");

    if (!title) {
      setOutsideSaveError("Training title is required.");
      return;
    }

    if (!outsideFormState.categoryId) {
      setOutsideSaveError("Select a training category.");
      return;
    }

    if (!outsideFormState.dateCompleted.trim()) {
      setOutsideSaveError("Date completed is required.");
      return;
    }

    if (!outsideFormState.hours.trim()) {
      setOutsideSaveError("Training hours are required.");
      return;
    }

    const hours = Number.parseFloat(outsideFormState.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setOutsideSaveError("Training hours must be greater than 0.");
      return;
    }

    const selectedCategory = activeCategories.find((category) => category.id === outsideFormState.categoryId);
    if (!selectedCategory) {
      setOutsideSaveError("Select an active training category.");
      return;
    }

    setIsSavingOutside(true);
    setOutsideSaveError(null);
    setOutsideSuccessMessage(null);

    try {
      const { data: submissionData, error: submissionError } = await supabase
        .from("training_outside_submissions")
        .insert({
          department_id: departmentId,
          member_id: currentMemberId,
          title,
          category_id: outsideFormState.categoryId,
          training_date: outsideFormState.dateCompleted,
          hours,
          is_ems_training: isEmsTraining,
          ems_core_topic: emsCoreTopic,
          ems_course_definition_id: emsCourseDefinitionId,
          ems_needs_review: emsNeedsReview,
          ems_provider_name: emsProviderName || instructorName || null,
          description: details || null,
          notes:
            buildOutsideSubmissionNotes({
              trainingMethod,
              instructorName,
              location,
            }) || null,
          status: "submitted",
          created_by: currentMemberId,
          updated_by: currentMemberId,
        })
        .select(
          "id, member_id, title, category_id, training_date, hours, is_ems_training, ems_core_topic, ems_course_definition_id, ems_needs_review, ems_provider_name, description, notes, status, review_required, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
        )
        .single();

      if (submissionError || !submissionData) {
        setOutsideSaveError(submissionError?.message || "Unable to submit self-reported training.");
        setIsSavingOutside(false);
        return;
      }

      const insertedSubmission: SubmittedTrainingRow = {
        id: String(submissionData.id),
        member_id: typeof submissionData.member_id === "string" ? submissionData.member_id : currentMemberId,
        title: typeof submissionData.title === "string" ? submissionData.title : title,
        category_id: typeof submissionData.category_id === "string" ? submissionData.category_id : outsideFormState.categoryId,
        training_date:
          typeof submissionData.training_date === "string" ? submissionData.training_date : outsideFormState.dateCompleted,
        hours:
          typeof submissionData.hours === "number" && Number.isFinite(submissionData.hours)
            ? submissionData.hours
            : typeof submissionData.hours === "string"
              ? Number.parseFloat(submissionData.hours)
              : hours,
        is_ems_training: submissionData.is_ems_training === true,
        ems_core_topic: typeof submissionData.ems_core_topic === "string" ? submissionData.ems_core_topic : emsCoreTopic,
        ems_course_definition_id:
          typeof submissionData.ems_course_definition_id === "string"
            ? submissionData.ems_course_definition_id
            : emsCourseDefinitionId,
        ems_needs_review: submissionData.ems_needs_review === true,
        ems_provider_name: typeof submissionData.ems_provider_name === "string" ? submissionData.ems_provider_name : emsProviderName || instructorName || null,
        description: typeof submissionData.description === "string" ? submissionData.description : details || null,
        notes: typeof submissionData.notes === "string" ? submissionData.notes : null,
        status: typeof submissionData.status === "string" ? submissionData.status : "pending_review",
        review_required:
          typeof submissionData.review_required === "boolean" ? submissionData.review_required : true,
        reviewed_by: typeof submissionData.reviewed_by === "string" ? submissionData.reviewed_by : null,
        reviewed_at: typeof submissionData.reviewed_at === "string" ? submissionData.reviewed_at : null,
        review_notes: typeof submissionData.review_notes === "string" ? submissionData.review_notes : null,
        created_at: typeof submissionData.created_at === "string" ? submissionData.created_at : new Date().toISOString(),
        updated_at: typeof submissionData.updated_at === "string" ? submissionData.updated_at : new Date().toISOString(),
      };

      let uploadWarning: string | null = null;
      let insertedEvidence: SubmittedTrainingEvidenceRow | null = null;

      if (outsideProofFile) {
        const sanitizedName = sanitizeFileName(outsideProofFile.name || "proof.pdf");
        const storagePath = `${departmentId}/${currentMemberId}/${insertedSubmission.id}/${Date.now()}-${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from("training-evidence")
          .upload(storagePath, outsideProofFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          uploadWarning = uploadError.message || "Proof upload failed.";
        } else {
          const { data: evidenceData, error: evidenceError } = await supabase
            .from("training_outside_submission_evidence")
            .insert({
              department_id: departmentId,
              submission_id: insertedSubmission.id,
              member_id: currentMemberId,
              file_name: outsideProofFile.name,
              file_path: storagePath,
              file_size_bytes: outsideProofFile.size,
              mime_type: outsideProofFile.type || null,
              uploaded_by: currentMemberId,
            })
            .select("id, submission_id, member_id, created_at")
            .single();

          if (evidenceError || !evidenceData) {
            uploadWarning = evidenceError?.message || "Proof record could not be saved.";
          } else {
            insertedEvidence = {
              id: String(evidenceData.id),
              submission_id: typeof evidenceData.submission_id === "string" ? evidenceData.submission_id : insertedSubmission.id,
              member_id: typeof evidenceData.member_id === "string" ? evidenceData.member_id : currentMemberId,
              file_name: outsideProofFile.name,
              file_path: storagePath,
              mime_type: outsideProofFile.type || null,
              created_at: typeof evidenceData.created_at === "string" ? evidenceData.created_at : new Date().toISOString(),
            };
          }
        }
      }

      setOutsideFormState(emptyOutsideTrainingFormState(activeCategories[0]?.id ?? ""));
      setOutsideProofFile(null);
      if (outsideProofInputRef.current) {
        outsideProofInputRef.current.value = "";
      }

      onSubmitted?.(insertedSubmission, insertedEvidence);

      await triggerEmsAllocationRecalculation(currentMemberId);
      router.refresh();

      if (isModal) {
        onClose?.();
      } else {
        setOutsideSuccessMessage(
          uploadWarning
            ? `Self-reported training submitted. ${uploadWarning}`
            : "Outside training submitted for review.",
        );
      }
    } catch (error) {
      setOutsideSaveError(error instanceof Error ? error.message : "Unable to submit self-reported training.");
    } finally {
      setIsSavingOutside(false);
    }
  }

  const formBody = (
    <>
      {outsideSaveError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {outsideSaveError}
        </div>
      ) : null}

      {!isModal && outsideSuccessMessage ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {outsideSuccessMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmitOutsideTraining} className="mt-5 space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Title *</span>
            <input
              value={outsideFormState.title}
              onChange={(event) => setOutsideFormState((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Category *</span>
            <select
              value={outsideFormState.categoryId}
              onChange={(event) => setOutsideFormState((current) => ({ ...current, categoryId: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="">Select category</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Date Completed *</span>
            <input
              type="date"
              value={outsideFormState.dateCompleted}
              onChange={(event) => setOutsideFormState((current) => ({ ...current, dateCompleted: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Hours *</span>
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={outsideFormState.hours}
              onChange={(event) => setOutsideFormState((current) => ({ ...current, hours: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Method</span>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-[#1b1b1b] p-2">
              {TRAINING_METHOD_OPTIONS.map((option) => (
                <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-white hover:bg-white/[0.06]">
                  <input
                    type="checkbox"
                    checked={outsideFormState.trainingMethod.includes(option)}
                    onChange={(event) =>
                      setOutsideFormState((current) => ({
                        ...current,
                        trainingMethod: event.target.checked
                          ? [...current.trainingMethod, option]
                          : current.trainingMethod.filter((method) => method !== option),
                      }))
                    }
                    className="h-4 w-4 rounded border-white/20 bg-[#111111] accent-red-600"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </label>

          {isEmsCategoryName(activeCategories.find((category) => category.id === outsideFormState.categoryId)?.name) ? (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">EMS Core Topic</span>
                <select
                  value={outsideFormState.emsCoreTopic}
                  onChange={(event) => setOutsideFormState((current) => ({ ...current, emsCoreTopic: event.target.value as EmsCoreTopicCode }))}
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                >
                  {EMS_CORE_TOPICS.map((topic) => (
                    <option key={topic.code} value={topic.code}>{topic.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">EMS Course / Training</span>
                <select
                  value={outsideFormState.emsCourseDefinitionId}
                  onChange={(event) => setOutsideFormState((current) => ({ ...current, emsCourseDefinitionId: event.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                >
                  <option value="">Unlisted / Other (Needs Review)</option>
                  {activeEmsCourseDefinitions.map((course) => (
                    <option key={course.id} value={course.id}>{course.course_name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Provider / Sponsor</span>
                <input
                  value={outsideFormState.emsProviderName}
                  onChange={(event) => setOutsideFormState((current) => ({ ...current, emsProviderName: event.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                />
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300 md:col-span-2">
                <input
                  type="checkbox"
                  checked={outsideFormState.emsNeedsReview}
                  onChange={(event) => setOutsideFormState((current) => ({ ...current, emsNeedsReview: event.target.checked }))}
                />
                Mark as NEEDS REVIEW
              </label>
            </>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Instructor</span>
            <input
              value={outsideFormState.instructorName}
              onChange={(event) => setOutsideFormState((current) => ({ ...current, instructorName: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Location</span>
            <input
              value={outsideFormState.location}
              onChange={(event) => setOutsideFormState((current) => ({ ...current, location: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Details / Notes</span>
            <textarea
              rows={4}
              value={outsideFormState.details}
              onChange={(event) => setOutsideFormState((current) => ({ ...current, details: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Supporting Document (Optional)</span>
            <input
              ref={outsideProofInputRef}
              type="file"
              onChange={(event) => setOutsideProofFile((event.target.files ?? [])[0] ?? null)}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-red-500"
            />
            <p className="mt-2 text-xs text-zinc-500">
              Certificate, completion card, transcript, or other proof (not required).
            </p>
          </label>
        </div>

        <div className="flex justify-end gap-3">
          {isModal && onClose ? (
            <button
              type="button"
              onClick={onClose}
              disabled={isSavingOutside}
              className="rounded-xl border border-white/10 bg-[#151515] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d1d1d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSavingOutside || activeCategories.length === 0}
            className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-neutral-400"
          >
            {isSavingOutside ? "Submitting..." : "Submit Training"}
          </button>
        </div>
      </form>
    </>
  );

  if (!isModal) {
    return (
      <section id="submit-training" className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-2xl font-semibold text-white">Submit Training</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Required: title, category, date completed, and hours. Optional proof can be uploaded now or provided later.
        </p>
        {formBody}
      </section>
    );
  }

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
      >
        <div className="border-b border-white/10 px-6 py-5">
          <h3 className="text-2xl font-black tracking-tight text-white">Add Training</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Submit your personal training for department review. Required: title, category, date completed, and hours.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">{formBody}</div>
      </div>
    </div>,
    document.body,
  );
}
