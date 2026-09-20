"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EMS_CORE_TOPICS, type EmsCoreTopicCode } from "@/lib/ems/requirements";
import { triggerEmsAllocationRecalculationForMembers } from "@/lib/ems/recalculate-client";
import { supabase } from "@/lib/supabase";

type Category = { id: string; name: string; active: boolean };
type EmsCourse = { id: string; course_name: string; active: boolean };
type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

const METHODS = [
  "Classroom / Discussion",
  "Hands-On",
  "Demonstration",
  "Drill / Scenario",
  "Video / Online",
  "Self-Reported Training",
  "Other",
];

function today() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function fileToPayload(file: File) {
  return new Promise<{
    fileName: string;
    mimeType: string;
    base64Data: string;
  }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const comma = dataUrl.indexOf(",");
      resolve({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function MobileTrainingForm({
  departmentId,
  memberId,
  categories,
  emsCourses,
  members,
}: {
  departmentId: string;
  memberId: string;
  categories: Category[];
  emsCourses: EmsCourse[];
  members: Member[];
}) {
  const router = useRouter();
  const evidenceRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(
    categories.find((category) => category.active)?.id ?? "",
  );
  const [dateCompleted, setDateCompleted] = useState(today());
  const [hours, setHours] = useState("");
  const [methods, setMethods] = useState<string[]>([]);
  const [provider, setProvider] = useState("");
  const [location, setLocation] = useState("");
  const [details, setDetails] = useState("");
  const [emsTopic, setEmsTopic] = useState<EmsCoreTopicCode>("other");
  const [emsCourseId, setEmsCourseId] = useState("");
  const [emsNeedsReview, setEmsNeedsReview] = useState(false);
  const [evidence, setEvidence] = useState<File | null>(null);
  const [openDetails, setOpenDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [participants, setParticipants] = useState<string[]>([memberId]);
  const [participantSearch, setParticipantSearch] = useState("");
  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );
  const isEms =
    activeCategories
      .find((category) => category.id === categoryId)
      ?.name.trim()
      .toLowerCase() === "ems";
  const visibleMembers = members.filter((member) =>
    `${member.first_name ?? ""} ${member.last_name ?? ""}`
      .toLowerCase()
      .includes(participantSearch.trim().toLowerCase()),
  );
  const memberName = (member: Member) =>
    `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsedHours = Number.parseFloat(hours);
    if (
      !title.trim() ||
      !categoryId ||
      !dateCompleted ||
      !Number.isFinite(parsedHours) ||
      parsedHours <= 0
    ) {
      setError(
        "Enter a training topic, category, date, and training hours greater than 0.",
      );
      return;
    }
    if (
      methods.length === 0 ||
      !provider.trim() ||
      !location.trim() ||
      !details.trim()
    ) {
      setError(
        "Training method, instructor, location, and description/details are required.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const trainingMethod = methods.join(" | ");
      const submission = await supabase.rpc(
        "create_outside_training_submission",
        {
          p_department_id: departmentId,
          p_title: title.trim(),
          p_category_id: categoryId,
          p_training_date: dateCompleted,
          p_hours: parsedHours,
          p_is_ems_training: isEms,
          p_ems_core_topic: isEms ? emsTopic : null,
          p_ems_course_definition_id: isEms ? emsCourseId || null : null,
          p_ems_needs_review: isEms && (emsNeedsReview || emsTopic === "other"),
          p_ems_provider_name: isEms ? provider.trim() || null : null,
          p_description: details.trim() || null,
          p_notes:
            [
              trainingMethod ? `Method: ${trainingMethod}` : "",
              provider.trim() && !isEms ? `Instructor: ${provider.trim()}` : "",
              location.trim() ? `Location: ${location.trim()}` : "",
            ]
              .filter(Boolean)
              .join("\n") || null,
          p_participant_ids: Array.from(new Set(participants)),
        },
      );
      const submissionId =
        typeof submission.data === "string" ? submission.data : null;
      if (submission.error || !submissionId)
        throw new Error(
          submission.error?.message || "Unable to submit training.",
        );
      if (evidence) {
        const payload = await fileToPayload(evidence);
        const safeName = payload.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${departmentId}/${memberId}/${submissionId}/${Date.now()}-${safeName}`;
        const upload = await supabase.storage.from("training-evidence").upload(
          path,
          Uint8Array.from(atob(payload.base64Data), (char) =>
            char.charCodeAt(0),
          ),
          { contentType: payload.mimeType, upsert: false },
        );
        if (!upload.error)
          await supabase
            .from("training_outside_submission_evidence")
            .insert({
              department_id: departmentId,
              submission_id: submissionId,
              member_id: memberId,
              file_name: payload.fileName,
              file_path: path,
              file_size_bytes: evidence.size,
              mime_type: payload.mimeType,
              uploaded_by: memberId,
            });
      }
      await triggerEmsAllocationRecalculationForMembers(
        Array.from(new Set(participants)),
      );
      setSaved(true);
      window.setTimeout(() => router.push("/mobile"), 900);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit training.",
      );
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <main className="min-h-screen bg-[#0b0c0e] px-4 py-10 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-7">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
            Training saved
          </p>
          <h1 className="mt-3 text-3xl font-black">Training submitted</h1>
          <p className="mt-3 text-base leading-6 text-white/75">
            Your training was submitted for the existing department review
            workflow.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0c0e] px-4 pb-10 pt-4 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/mobile"
          className="inline-flex min-h-12 items-center text-sm font-bold text-white/65"
        >
          Back to Field Actions
        </Link>
        <header className="mt-5 border-b border-white/10 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ef2b2d]">
            Field Action
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Log Training</h1>
          <p className="mt-2 text-sm text-white/60">
            Record training you just completed.
          </p>
        </header>
        {error ? (
          <p className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </p>
        ) : null}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <section className="rounded-2xl border border-white/10 bg-[#17181b] p-5">
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#ef2b2d]">
              Training Record
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2 text-sm font-bold text-white/80">
                Training Topic *
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white outline-none focus:border-red-500/70"
                />
              </label>
              <label className="text-sm font-bold text-white/80">
                Category *
                <select
                  required
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white"
                >
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-white/80">
                Date Completed *
                <input
                  required
                  type="date"
                  value={dateCompleted}
                  onChange={(event) => setDateCompleted(event.target.value)}
                  className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white [color-scheme:dark]"
                />
              </label>
              <label className="text-sm font-bold text-white/80">
                Hours *
                <input
                  required
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white"
                />
              </label>
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-[#17181b] p-5">
            <button
              type="button"
              onClick={() => setOpenDetails((value) => !value)}
              className="flex min-h-12 w-full items-center justify-between text-left"
            >
              <span className="text-xs font-black uppercase tracking-[0.18em] text-white">
                Additional Details
              </span>
              <span className="text-xl text-[#ef2b2d]">
                {openDetails ? "−" : "+"}
              </span>
            </button>
            {openDetails ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-bold text-white/80">
                    Training Method *
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {METHODS.map((method) => (
                      <label
                        key={method}
                        className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-[#101010] px-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={methods.includes(method)}
                          onChange={(event) =>
                            setMethods((current) =>
                              event.target.checked
                                ? [...current, method]
                                : current.filter((item) => item !== method),
                            )
                          }
                          className="h-5 w-5 accent-red-600"
                        />
                        {method}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block text-sm font-bold text-white/80">
                  Instructor *
                  <input
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                    className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white"
                  />
                </label>
                <label className="block text-sm font-bold text-white/80">
                  Location *
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white"
                  />
                </label>
                <label className="block text-sm font-bold text-white/80">
                  Description / Details *
                  <textarea
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    rows={5}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-4 text-base text-white"
                  />
                </label>
                {isEms ? (
                  <div className="space-y-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-red-100">
                      EMS Details
                    </p>
                    <label className="block text-sm font-bold">
                      EMS Core Topic
                      <select
                        value={emsTopic}
                        onChange={(event) =>
                          setEmsTopic(event.target.value as EmsCoreTopicCode)
                        }
                        className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-white"
                      >
                        {EMS_CORE_TOPICS.map((topic) => (
                          <option key={topic.code} value={topic.code}>
                            {topic.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-bold">
                      EMS Course / Training
                      <select
                        value={emsCourseId}
                        onChange={(event) => setEmsCourseId(event.target.value)}
                        className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-white"
                      >
                        <option value="">Unlisted / Other</option>
                        {emsCourses
                          .filter((course) => course.active)
                          .map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.course_name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="flex min-h-12 items-center gap-3 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={emsNeedsReview}
                        onChange={(event) =>
                          setEmsNeedsReview(event.target.checked)
                        }
                        className="h-5 w-5 accent-red-600"
                      />
                      Mark as Needs Review
                    </label>
                  </div>
                ) : null}
                <div className="rounded-xl border border-white/10 bg-[#101010] p-4">
                  <p className="text-sm font-black text-white">Participants</p>
                  <p className="mt-1 text-sm leading-5 text-white/60">
                    Selected firefighters will receive credit when this training
                    is approved.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {participants.map((participantId) => {
                      const participant = members.find(
                        (member) => member.id === participantId,
                      );
                      const isSubmitter = participantId === memberId;

                      return (
                        <button
                          key={participantId}
                          type="button"
                          disabled={isSubmitter}
                          onClick={() =>
                            setParticipants((current) =>
                              current.filter((id) => id !== participantId),
                            )
                          }
                          className="min-h-12 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-100 disabled:cursor-default disabled:opacity-100"
                        >
                          {participant
                            ? memberName(participant)
                            : isSubmitter
                              ? "You"
                              : participantId}
                          {isSubmitter ? " (You)" : " - Remove"}
                        </button>
                      );
                    })}
                  </div>
                  <label className="mt-4 block text-sm font-bold text-white/80">
                    Search firefighters...
                    <input
                      value={participantSearch}
                      onChange={(event) =>
                        setParticipantSearch(event.target.value)
                      }
                      placeholder="Search firefighters..."
                      className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#17181b] px-4 text-base text-white outline-none placeholder:text-white/35 focus:border-red-500/70"
                    />
                  </label>
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                    {visibleMembers.map((member) => {
                      const isSelected = participants.includes(member.id);
                      const isSubmitter = member.id === memberId;

                      return (
                        <button
                          key={member.id}
                          type="button"
                          disabled={isSubmitter}
                          onClick={() => {
                            setParticipants((current) =>
                              isSelected
                                ? current.filter((id) => id !== member.id)
                                : Array.from(new Set([...current, member.id])),
                            );
                            if (!isSelected) setParticipantSearch("");
                          }}
                          className={`flex min-h-14 w-full items-center justify-between rounded-xl border px-4 text-left text-sm font-bold disabled:cursor-default disabled:opacity-100 ${isSelected ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-[#17181b] text-white"}`}
                        >
                          <span>
                            {memberName(member)}{isSubmitter ? " (You)" : ""}
                          </span>
                          <span className="text-xs font-black uppercase tracking-wide">
                            {isSelected ? "Selected" : "Add"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="block text-sm font-bold text-white/80">
                  Add Documentation
                  <input
                    ref={evidenceRef}
                    type="file"
                    accept="image/*,.pdf"
                    capture="environment"
                    onChange={(event) =>
                      setEvidence(event.target.files?.[0] ?? null)
                    }
                    className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-sm text-white/75"
                  />
                  {evidence ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEvidence(null);
                        if (evidenceRef.current) evidenceRef.current.value = "";
                      }}
                      className="mt-2 min-h-11 rounded-lg border border-white/15 px-3 text-xs font-black uppercase"
                    >
                      Remove {evidence.name}
                    </button>
                  ) : null}
                </label>
              </div>
            ) : null}
          </section>
          <button
            type="submit"
            disabled={saving}
            className="sticky bottom-3 min-h-16 w-full rounded-2xl bg-[#ef2b2d] text-base font-black uppercase tracking-wide text-white disabled:opacity-50"
          >
            {saving ? "Saving Training..." : "Save Training"}
          </button>
        </form>
      </div>
    </main>
  );
}
