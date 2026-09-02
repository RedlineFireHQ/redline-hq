"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock3, MapPin, Plus, UserRound } from "lucide-react";
import { EMS_CORE_TOPICS, type EmsCoreTopicCode } from "@/lib/ems/requirements";
import { triggerEmsAllocationRecalculation, triggerEmsAllocationRecalculationForMembers } from "@/lib/ems/recalculate-client";
import { parseHours } from "@/lib/readiness/member-readiness";
import { supabase } from "@/lib/supabase";

type CurrentMemberRole = "firefighter" | "officer" | "administrator";

type TrainingCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type TrainingEventRow = {
  id: string;
  title: string;
  category_id: string | null;
  topic: string | null;
  training_type: string | null;
  is_ems_training: boolean;
  ems_core_topic: string | null;
  ems_course_definition_id: string | null;
  ems_needs_review: boolean;
  ems_provider_name: string | null;
  description: string | null;
  location: string | null;
  instructor_name: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
  hours_credit: number | null;
  status: string;
  supporting_document_id: string | null;
  created_at: string;
  updated_at: string;
};

type TrainingAttendanceRow = {
  id: string;
  training_event_id: string;
  member_id: string;
  attendance_status: string;
  completion_status: string;
};

type DepartmentMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

type DepartmentDocumentRow = {
  id: string;
  title: string;
  category: string | null;
  document_number: string | null;
  status: string | null;
};

type TrainingOutsideSubmissionRow = {
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

type TrainingOutsideEvidenceRow = {
  id: string;
  submission_id: string;
  member_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
};

type TrainingAssignmentRow = {
  id: string;
  title: string;
  category_id: string | null;
  description: string | null;
  due_at: string | null;
  hours_credit: number | null;
  is_required: boolean;
  review_required: boolean;
  status: string;
  external_video_url: string | null;
  external_audio_url: string | null;
  supporting_document_id: string | null;
  created_at: string;
  updated_at: string;
};

type TrainingAssignmentMemberRow = {
  id: string;
  training_assignment_id: string;
  member_id: string;
  due_at: string | null;
  completion_status: string;
  completed_at: string | null;
  hours_earned: number | null;
  completion_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

type TrainingAssignmentEvidenceRow = {
  id: string;
  assignment_member_id: string;
  member_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
};

type EmsCourseDefinitionRow = {
  id: string;
  course_name: string;
  active: boolean;
};

type HomeworkMaterialOpenState = {
  document: boolean;
  video: boolean;
  audio: boolean;
};

interface TrainingWorkspaceProps {
  departmentId: string;
  currentMemberId: string;
  currentMemberRole: CurrentMemberRole;
  canManageTraining: boolean;
  canAssignHomework: boolean;
  canReviewTraining: boolean;
  categories: TrainingCategoryRow[];
  events: TrainingEventRow[];
  attendanceRows: TrainingAttendanceRow[];
  members: DepartmentMemberRow[];
  documents: DepartmentDocumentRow[];
  pendingReviews: number;
  outsideSubmissions: TrainingOutsideSubmissionRow[];
  outsideEvidenceRows: TrainingOutsideEvidenceRow[];
  assignments: TrainingAssignmentRow[];
  assignmentMembers: TrainingAssignmentMemberRow[];
  assignmentEvidenceRows: TrainingAssignmentEvidenceRow[];
  emsCourseDefinitions: EmsCourseDefinitionRow[];
  initialAddTrainingEventOpen?: boolean;
}

type TrainingEventFormState = {
  title: string;
  categoryId: string;
  emsCoreTopic: EmsCoreTopicCode;
  emsCourseDefinitionId: string;
  emsNeedsReview: boolean;
  emsProviderName: string;
  trainingMethod: string;
  date: string;
  startTime: string;
  hoursCredit: string;
  instructorName: string;
  location: string;
  details: string;
};

type OutsideTrainingFormState = {
  title: string;
  categoryId: string;
  trainingKind: "general" | "ems";
  emsCoreTopic: EmsCoreTopicCode;
  emsCourseDefinitionId: string;
  emsNeedsReview: boolean;
  emsProviderName: string;
  dateCompleted: string;
  hours: string;
  trainingMethod: string;
  instructorName: string;
  location: string;
  details: string;
};

type HomeworkAssignmentFormState = {
  title: string;
  categoryId: string;
  dueDate: string;
  hoursCredit: string;
  description: string;
  isRequired: boolean;
  reviewRequired: boolean;
  supportingDocumentId: string;
  uploadedMaterialTitle: string;
  externalVideoUrl: string;
  externalAudioUrl: string;
  assignDepartmentWide: boolean;
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

const MILITARY_TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const totalMinutes = index * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
});

function emptyFormState(defaultCategoryId: string): TrainingEventFormState {
  return {
    title: "",
    categoryId: defaultCategoryId,
    emsCoreTopic: "other",
    emsCourseDefinitionId: "",
    emsNeedsReview: false,
    emsProviderName: "",
    trainingMethod: "",
    date: getTodayDateKey(),
    startTime: "",
    hoursCredit: "",
    instructorName: "",
    location: "",
    details: "",
  };
}

function emptyOutsideTrainingFormState(defaultCategoryId: string): OutsideTrainingFormState {
  return {
    title: "",
    categoryId: defaultCategoryId,
    trainingKind: "general",
    emsCoreTopic: "other",
    emsCourseDefinitionId: "",
    emsNeedsReview: false,
    emsProviderName: "",
    dateCompleted: getTodayDateKey(),
    hours: "",
    trainingMethod: "",
    instructorName: "",
    location: "",
    details: "",
  };
}

function emptyHomeworkAssignmentFormState(defaultCategoryId: string): HomeworkAssignmentFormState {
  return {
    title: "",
    categoryId: defaultCategoryId,
    dueDate: "",
    hoursCredit: "",
    description: "",
    isRequired: true,
    reviewRequired: false,
    supportingDocumentId: "",
    uploadedMaterialTitle: "",
    externalVideoUrl: "",
    externalAudioUrl: "",
    assignDepartmentWide: false,
  };
}

function minutesFromMilitary(value: string) {
  if (!/^\d{4}$/.test(value)) {
    return null;
  }

  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(2, 4));

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function toIsoDateTime(dateKey: string, military: string) {
  return new Date(`${dateKey}T${military.slice(0, 2)}:${military.slice(2, 4)}:00`).toISOString();
}

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function memberDisplayName(member: DepartmentMemberRow) {
  const first = typeof member.first_name === "string" ? member.first_name.trim() : "";
  const last = typeof member.last_name === "string" ? member.last_name.trim() : "";
  return `${first} ${last}`.trim() || "Unknown Member";
}

function normalizeSearchValue(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function formatHours(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(2);
}

function formatDateOnly(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function isDateInYear(value: string | null | undefined, year: number) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getFullYear() === year;
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

function extractOutsideMetadata(notes: string | null) {
  const result = {
    method: "",
    instructor: "",
    location: "",
  };

  if (!notes) {
    return result;
  }

  const lines = notes.split("\n").map((line) => line.trim());
  for (const line of lines) {
    if (line.toLowerCase().startsWith("method:")) {
      result.method = line.slice("Method:".length).trim();
      continue;
    }

    if (line.toLowerCase().startsWith("instructor:")) {
      result.instructor = line.slice("Instructor:".length).trim();
      continue;
    }

    if (line.toLowerCase().startsWith("location:")) {
      result.location = line.slice("Location:".length).trim();
    }
  }

  return result;
}

function outsideStatusStyles(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === "approved") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (normalized === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (normalized === "pending_review" || normalized === "submitted") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-white/10 bg-white/[0.04] text-neutral-200";
}

function homeworkStatusStyles(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === "approved") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (normalized === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (normalized === "pending_review" || normalized === "submitted") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-white/10 bg-white/[0.04] text-neutral-200";
}

function normalizeHomeworkStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === "approved") {
    return "Complete";
  }

  if (normalized === "pending_review" || normalized === "submitted") {
    return "Pending Review";
  }

  if (normalized === "in_progress") {
    return "In Progress";
  }

  if (normalized === "rejected") {
    return "Rejected";
  }

  if (normalized === "assigned") {
    return "Assigned";
  }

  return "Assigned";
}

function getCategoryNameById(categories: TrainingCategoryRow[], categoryId: string | null) {
  if (!categoryId) {
    return "Uncategorized";
  }

  const match = categories.find((category) => category.id === categoryId);
  return match?.name || "Uncategorized";
}

function isEmsCategoryName(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase() === "ems";
}

function resolveDocumentCategorySlug(category: string | null | undefined) {
  if (!category) {
    return null;
  }

  const normalizedCategory = category.trim();
  const categoryMap: Record<string, string> = {
    SOPs: "sops",
    "EMS Protocols": "ems-protocols",
    "City / Department Policies": "city-department-policies",
    "Mutual Aid Agreements": "mutual-aid-agreements",
    "Department Documents": "department-documents",
  };

  return categoryMap[normalizedCategory] ?? null;
}

export default function TrainingWorkspace({
  departmentId,
  currentMemberId,
  currentMemberRole,
  canManageTraining,
  canAssignHomework,
  canReviewTraining,
  categories,
  events,
  attendanceRows,
  members,
  documents,
  pendingReviews,
  outsideSubmissions,
  outsideEvidenceRows,
  assignments,
  assignmentMembers,
  assignmentEvidenceRows,
  emsCourseDefinitions,
}: TrainingWorkspaceProps) {
  const router = useRouter();
  const outsideProofInputRef = useRef<HTMLInputElement | null>(null);
  const homeworkEvidenceInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const homeworkMaterialInputRef = useRef<HTMLInputElement | null>(null);
  const [eventRows, setEventRows] = useState(events);
  const [outsideSubmissionRows, setOutsideSubmissionRows] = useState(outsideSubmissions);
  const [outsideEvidenceState, setOutsideEvidenceState] = useState(outsideEvidenceRows);
  const [assignmentRows, setAssignmentRows] = useState(assignments);
  const [assignmentMemberRows, setAssignmentMemberRows] = useState(assignmentMembers);
  const [assignmentEvidenceState, setAssignmentEvidenceState] = useState(assignmentEvidenceRows);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingHomework, setIsSavingHomework] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [homeworkSaveError, setHomeworkSaveError] = useState<string | null>(null);
  const [homeworkSuccessMessage, setHomeworkSuccessMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [homeworkMemberSearch, setHomeworkMemberSearch] = useState("");
  const [selectedHomeworkMemberIds, setSelectedHomeworkMemberIds] = useState<Set<string>>(new Set());
  const [outsideFormState, setOutsideFormState] = useState<OutsideTrainingFormState>(
    emptyOutsideTrainingFormState(categories.find((category) => category.active)?.id ?? ""),
  );
  const [homeworkFormState, setHomeworkFormState] = useState<HomeworkAssignmentFormState>(
    emptyHomeworkAssignmentFormState(categories.find((category) => category.active)?.id ?? ""),
  );
  const [outsideProofFile, setOutsideProofFile] = useState<File | null>(null);
  const [outsideSaveError, setOutsideSaveError] = useState<string | null>(null);
  const [outsideSuccessMessage, setOutsideSuccessMessage] = useState<string | null>(null);
  const [isSavingOutside, setIsSavingOutside] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState<string | null>(null);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const [homeworkReviewError, setHomeworkReviewError] = useState<string | null>(null);
  const [homeworkReviewSuccessMessage, setHomeworkReviewSuccessMessage] = useState<string | null>(null);
  const [reviewingAssignmentMemberId, setReviewingAssignmentMemberId] = useState<string | null>(null);
  const [homeworkProgressError, setHomeworkProgressError] = useState<string | null>(null);
  const [homeworkProgressSuccessMessage, setHomeworkProgressSuccessMessage] = useState<string | null>(null);
  const [homeworkCompletionNotesByMemberId, setHomeworkCompletionNotesByMemberId] = useState<Record<string, string>>({});
  const [homeworkReviewNotesByMemberId, setHomeworkReviewNotesByMemberId] = useState<Record<string, string>>({});
  const [homeworkEvidenceFileByMemberId, setHomeworkEvidenceFileByMemberId] = useState<Record<string, File | null>>({});
  const [homeworkMaterialFile, setHomeworkMaterialFile] = useState<File | null>(null);
  const [submittingHomeworkMemberId, setSubmittingHomeworkMemberId] = useState<string | null>(null);
  const [openingHomeworkMemberId, setOpeningHomeworkMemberId] = useState<string | null>(null);
  const [manualOpenedHomeworkMemberIds, setManualOpenedHomeworkMemberIds] = useState<Set<string>>(new Set());
  const [homeworkOpenedMaterialsByMemberId, setHomeworkOpenedMaterialsByMemberId] = useState<Record<string, HomeworkMaterialOpenState>>({});
  const [confirmHomeworkCompletionMemberId, setConfirmHomeworkCompletionMemberId] = useState<string | null>(null);
  const [confirmHomeworkSubmitMemberId, setConfirmHomeworkSubmitMemberId] = useState<string | null>(null);
  const [completedTogetherSourceAssignmentMemberId, setCompletedTogetherSourceAssignmentMemberId] = useState<string | null>(null);
  const [completedTogetherMemberSearch, setCompletedTogetherMemberSearch] = useState("");
  const [selectedCompletedTogetherMemberIds, setSelectedCompletedTogetherMemberIds] = useState<Set<string>>(new Set());
  const [completedTogetherError, setCompletedTogetherError] = useState<string | null>(null);
  const [isSubmittingCompletedTogether, setIsSubmittingCompletedTogether] = useState(false);

  useEffect(() => {
    if (!isHomeworkModalOpen && !isModalOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const previousHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
    };
  }, [isHomeworkModalOpen, isModalOpen]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );

  const activeEmsCourseDefinitions = useMemo(
    () => emsCourseDefinitions.filter((course) => course.active).sort((a, b) => a.course_name.localeCompare(b.course_name)),
    [emsCourseDefinitions],
  );

  const [formState, setFormState] = useState<TrainingEventFormState>(
    emptyFormState(activeCategories[0]?.id ?? ""),
  );

  const membersTrainedCount = useMemo(() => {
    const memberIds = new Set(
      attendanceRows
        .filter((row) => row.attendance_status === "attending")
        .map((row) => row.member_id),
    );

    return memberIds.size;
  }, [attendanceRows]);

  const currentYear = new Date().getFullYear();

  const trainingHoursThisYear = useMemo(() => {
    const eventHoursById = new Map(
      eventRows.map((event) => [
        event.id,
        {
          startsAt: event.starts_at,
          hoursCredit: parseHours(event.hours_credit),
        },
      ]),
    );

    const memberAttendanceHours = attendanceRows
      .filter((row) => row.member_id === currentMemberId && row.attendance_status === "attending")
      .reduce((total, row) => {
        const event = eventHoursById.get(row.training_event_id);
        if (!event || !isDateInYear(event.startsAt, currentYear)) {
          return total;
        }
        return total + event.hoursCredit;
      }, 0);

    const memberApprovedOutsideHours = outsideSubmissionRows
      .filter((row) => row.member_id === currentMemberId && row.status === "approved")
      .reduce((total, row) => {
        if (!isDateInYear(row.training_date, currentYear)) {
          return total;
        }
        return total + parseHours(row.hours);
      }, 0);

    const assignmentByIdMap = new Map(assignmentRows.map((row) => [row.id, row]));
    const memberApprovedHomeworkHours = assignmentMemberRows
      .filter((row) => row.member_id === currentMemberId && row.completion_status === "approved")
      .reduce((total, row) => {
        const completedTimestamp = row.completed_at ?? row.updated_at ?? row.created_at;
        if (!isDateInYear(completedTimestamp, currentYear)) {
          return total;
        }

        const assignment = assignmentByIdMap.get(row.training_assignment_id);
        const assignmentHours = assignment ? parseHours(assignment.hours_credit) : 0;
        const rowHours = parseHours(row.hours_earned);
        return total + (rowHours > 0 ? rowHours : assignmentHours);
      }, 0);

    return memberAttendanceHours + memberApprovedOutsideHours + memberApprovedHomeworkHours;
  }, [
    assignmentMemberRows,
    assignmentRows,
    attendanceRows,
    currentMemberId,
    currentYear,
    eventRows,
    outsideSubmissionRows,
  ]);

  const attendanceByEventId = useMemo(() => {
    const map = new Map<string, { attended: number; completed: number }>();

    for (const row of attendanceRows) {
      const current = map.get(row.training_event_id) ?? { attended: 0, completed: 0 };

      if (row.attendance_status === "attending") {
        current.attended += 1;
      }

      if (row.completion_status === "approved") {
        current.completed += 1;
      }

      map.set(row.training_event_id, current);
    }

    return map;
  }, [attendanceRows]);

  const sortedEvents = useMemo(() => {
    return [...eventRows].sort((left, right) => new Date(right.starts_at).getTime() - new Date(left.starts_at).getTime());
  }, [eventRows]);

  const departmentMembers = useMemo(
    () => members.map((member) => ({ ...member, full_name: memberDisplayName(member) })),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const search = normalizeSearchValue(memberSearch);
    if (!search) {
      return departmentMembers;
    }

    return departmentMembers.filter((member) => {
      const first = normalizeSearchValue(member.first_name ?? "");
      const last = normalizeSearchValue(member.last_name ?? "");
      const full = normalizeSearchValue(member.full_name);
      return first.includes(search) || last.includes(search) || full.includes(search);
    });
  }, [departmentMembers, memberSearch]);

  const hasManagementCapabilities =
    canManageTraining || canAssignHomework || canReviewTraining;

  const outsideEvidenceCountBySubmissionId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of outsideEvidenceState) {
      const current = map.get(row.submission_id) ?? 0;
      map.set(row.submission_id, current + 1);
    }
    return map;
  }, [outsideEvidenceState]);

  const outsideEvidenceBySubmissionId = useMemo(() => {
    const map = new Map<string, TrainingOutsideEvidenceRow[]>();
    for (const row of outsideEvidenceState) {
      const current = map.get(row.submission_id) ?? [];
      current.push(row);
      map.set(row.submission_id, current);
    }
    return map;
  }, [outsideEvidenceState]);

  const myOutsideSubmissions = useMemo(() => {
    return [...outsideSubmissionRows]
      .filter((row) => row.member_id === currentMemberId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  }, [currentMemberId, outsideSubmissionRows]);

  const pendingOutsideSubmissions = useMemo(() => {
    if (!canReviewTraining) {
      return [];
    }

    return [...outsideSubmissionRows]
      .filter((row) => row.status === "pending_review")
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  }, [canReviewTraining, outsideSubmissionRows]);

  const departmentMemberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of departmentMembers) {
      map.set(member.id, member.full_name);
    }
    return map;
  }, [departmentMembers]);

  const assignmentById = useMemo(() => {
    return new Map(assignmentRows.map((row) => [row.id, row]));
  }, [assignmentRows]);

  const documentById = useMemo(() => {
    return new Map(documents.map((row) => [row.id, row]));
  }, [documents]);

  const assignmentMembersByAssignmentId = useMemo(() => {
    const map = new Map<string, TrainingAssignmentMemberRow[]>();
    for (const row of assignmentMemberRows) {
      const current = map.get(row.training_assignment_id) ?? [];
      current.push(row);
      map.set(row.training_assignment_id, current);
    }
    return map;
  }, [assignmentMemberRows]);

  const assignmentEvidenceByMemberRowId = useMemo(() => {
    const map = new Map<string, TrainingAssignmentEvidenceRow[]>();
    for (const row of assignmentEvidenceState) {
      const current = map.get(row.assignment_member_id) ?? [];
      current.push(row);
      map.set(row.assignment_member_id, current);
    }
    return map;
  }, [assignmentEvidenceState]);

  const pendingAssignmentReviews = useMemo(() => {
    if (!canReviewTraining) {
      return [];
    }

    return assignmentMemberRows
      .filter((row) => row.completion_status === "pending_review" || row.completion_status === "submitted")
      .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());
  }, [assignmentMemberRows, canReviewTraining]);

  const sortedAssignments = useMemo(() => {
    return [...assignmentRows].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  }, [assignmentRows]);

  const myHomeworkRows = useMemo(() => {
    return assignmentMemberRows
      .filter((row) => row.member_id === currentMemberId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  }, [assignmentMemberRows, currentMemberId]);

  const autoOpenedHomeworkMemberIds = useMemo(() => {
    const next = new Set<string>();

    for (const row of assignmentMemberRows) {
      const normalizedStatus = row.completion_status.trim().toLowerCase();
      if (
        normalizedStatus === "in_progress" ||
        normalizedStatus === "pending_review" ||
        normalizedStatus === "submitted" ||
        normalizedStatus === "approved"
      ) {
        next.add(row.id);
      }
    }

    return next;
  }, [assignmentMemberRows]);

  const openedHomeworkMemberIds = useMemo(() => {
    const next = new Set(manualOpenedHomeworkMemberIds);

    for (const rowId of autoOpenedHomeworkMemberIds) {
      next.add(rowId);
    }

    return next;
  }, [autoOpenedHomeworkMemberIds, manualOpenedHomeworkMemberIds]);

  const filteredHomeworkMembers = useMemo(() => {
    const search = normalizeSearchValue(homeworkMemberSearch);
    if (!search) {
      return departmentMembers;
    }

    return departmentMembers.filter((member) => {
      const first = normalizeSearchValue(member.first_name ?? "");
      const last = normalizeSearchValue(member.last_name ?? "");
      const full = normalizeSearchValue(member.full_name);
      return first.includes(search) || last.includes(search) || full.includes(search);
    });
  }, [departmentMembers, homeworkMemberSearch]);

  const completedTogetherSourceAssignmentMember = useMemo(() => {
    if (!completedTogetherSourceAssignmentMemberId) {
      return null;
    }

    return assignmentMemberRows.find((row) => row.id === completedTogetherSourceAssignmentMemberId) ?? null;
  }, [assignmentMemberRows, completedTogetherSourceAssignmentMemberId]);

  const completedTogetherCandidates = useMemo(() => {
    return departmentMembers.filter((member) => member.id !== currentMemberId);
  }, [currentMemberId, departmentMembers]);

  const filteredCompletedTogetherMembers = useMemo(() => {
    const search = normalizeSearchValue(completedTogetherMemberSearch);
    if (!search) {
      return completedTogetherCandidates;
    }

    return completedTogetherCandidates.filter((member) => {
      const first = normalizeSearchValue(member.first_name ?? "");
      const last = normalizeSearchValue(member.last_name ?? "");
      const full = normalizeSearchValue(member.full_name);
      return first.includes(search) || last.includes(search) || full.includes(search);
    });
  }, [completedTogetherCandidates, completedTogetherMemberSearch]);

  const openModal = useCallback(() => {
    if (!canManageTraining) {
      return;
    }

    setSaveError(null);
    setSuccessMessage(null);
    setFormState(emptyFormState(activeCategories[0]?.id ?? ""));
    setMemberSearch("");
    setSelectedMemberIds(new Set());
    setIsModalOpen(true);
  }, [activeCategories, canManageTraining]);

  useEffect(() => {
    function handleOpenAddTrainingEvent() {
      openModal();
    }

    window.addEventListener("redline-open-add-training-event", handleOpenAddTrainingEvent);

    return () => {
      window.removeEventListener("redline-open-add-training-event", handleOpenAddTrainingEvent);
    };
  }, [openModal]);

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setSaveError(null);
  }

  function toggleMemberSelection(memberId: string) {
    setSelectedMemberIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  function selectAllMembers() {
    setSelectedMemberIds(new Set(departmentMembers.map((member) => member.id)));
  }

  function clearAllMembers() {
    setSelectedMemberIds(new Set());
  }

  function openHomeworkModal() {
    if (!canAssignHomework) {
      return;
    }

    setHomeworkSaveError(null);
    setHomeworkSuccessMessage(null);
    setHomeworkMemberSearch("");
    setSelectedHomeworkMemberIds(new Set());
    setHomeworkFormState(emptyHomeworkAssignmentFormState(activeCategories[0]?.id ?? ""));
    setHomeworkMaterialFile(null);
    setIsHomeworkModalOpen(true);
  }

  function closeHomeworkModal() {
    if (isSavingHomework) {
      return;
    }

    setIsHomeworkModalOpen(false);
    setHomeworkSaveError(null);
    setHomeworkMaterialFile(null);
    if (homeworkMaterialInputRef.current) {
      homeworkMaterialInputRef.current.value = "";
    }
  }

  function toggleHomeworkMemberSelection(memberId: string) {
    setSelectedHomeworkMemberIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  function selectAllHomeworkMembers() {
    setSelectedHomeworkMemberIds(new Set(departmentMembers.map((member) => member.id)));
  }

  function clearAllHomeworkMembers() {
    setSelectedHomeworkMemberIds(new Set());
  }

  async function handleCreateHomeworkAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canAssignHomework) {
      setHomeworkSaveError("You do not have permission to assign training.");
      return;
    }

    const title = homeworkFormState.title.trim();
    const description = homeworkFormState.description.trim();
    const externalVideoUrl = homeworkFormState.externalVideoUrl.trim();
    const externalAudioUrl = homeworkFormState.externalAudioUrl.trim();

    if (!title) {
      setHomeworkSaveError("Assigned training title is required.");
      return;
    }

    if (!homeworkFormState.categoryId) {
      setHomeworkSaveError("Select an assigned training category.");
      return;
    }

    if (!homeworkFormState.hoursCredit.trim()) {
      setHomeworkSaveError("Assigned training hours are required.");
      return;
    }

    const hoursCredit = Number.parseFloat(homeworkFormState.hoursCredit);
    if (!Number.isFinite(hoursCredit) || hoursCredit <= 0) {
      setHomeworkSaveError("Assigned training hours must be greater than 0.");
      return;
    }

    const selectedCategory = activeCategories.find((category) => category.id === homeworkFormState.categoryId);
    if (!selectedCategory) {
      setHomeworkSaveError("Select an active assigned training category.");
      return;
    }

    const targetedMemberIds = homeworkFormState.assignDepartmentWide
      ? departmentMembers.map((member) => member.id)
      : Array.from(selectedHomeworkMemberIds);

    const uniqueMemberIds = Array.from(new Set(targetedMemberIds));
    if (uniqueMemberIds.length === 0) {
      setHomeworkSaveError("Select at least one firefighter or assign department-wide.");
      return;
    }

    const dueAt = homeworkFormState.dueDate.trim()
      ? new Date(`${homeworkFormState.dueDate.trim()}T23:59:59`).toISOString()
      : null;

    if (homeworkFormState.supportingDocumentId && homeworkMaterialFile) {
      setHomeworkSaveError("Choose either an existing department document or upload new training material.");
      return;
    }

    setIsSavingHomework(true);
    setHomeworkSaveError(null);
    setHomeworkSuccessMessage(null);

    try {
      let supportingDocumentId: string | null = homeworkFormState.supportingDocumentId || null;

      if (homeworkMaterialFile) {
        const materialTitle = homeworkFormState.uploadedMaterialTitle.trim() || homeworkMaterialFile.name || title;
        const sanitizedName = sanitizeFileName(homeworkMaterialFile.name || "homework-material");
        const storagePath = `${departmentId}/department-documents/${Date.now()}-${sanitizedName}`;
        const today = getTodayDateKey();

        const { error: uploadError } = await supabase.storage
          .from("department-documents")
          .upload(storagePath, homeworkMaterialFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setHomeworkSaveError(uploadError.message || "Unable to upload training material.");
          setIsSavingHomework(false);
          return;
        }

        const { data: documentData, error: documentInsertError } = await supabase
          .from("documents")
          .insert({
            department_id: departmentId,
            category: "Department Documents",
            source_kind: "training",
            title: materialTitle,
            description: null,
            document_number: null,
            effective_date: today,
            status: "Active",
            uploaded_by: currentMemberId,
            current_revision_id: null,
          })
          .select("id")
          .single();

        if (documentInsertError || !documentData) {
          setHomeworkSaveError(documentInsertError?.message || "Unable to create training material document record.");
          setIsSavingHomework(false);
          return;
        }

        const { data: revisionData, error: revisionInsertError } = await supabase
          .from("document_revisions")
          .insert({
            department_id: departmentId,
            document_id: documentData.id,
            revision_number: 1,
            file_name: homeworkMaterialFile.name,
            file_path: storagePath,
            file_size_bytes: homeworkMaterialFile.size,
            mime_type: homeworkMaterialFile.type || null,
            uploaded_by: currentMemberId,
            effective_date: today,
            revision_date: today,
            notes: `Uploaded from homework assignment: ${title}`,
            status: "Active",
            content_text: null,
          })
          .select("id")
          .single();

        if (revisionInsertError || !revisionData) {
          setHomeworkSaveError(revisionInsertError?.message || "Unable to create training material revision record.");
          setIsSavingHomework(false);
          return;
        }

        const { error: updateDocumentError } = await supabase
          .from("documents")
          .update({ current_revision_id: revisionData.id })
          .eq("id", documentData.id)
          .eq("department_id", departmentId);

        if (updateDocumentError) {
          setHomeworkSaveError(updateDocumentError.message || "Unable to attach training material revision.");
          setIsSavingHomework(false);
          return;
        }

        supportingDocumentId = String(documentData.id);
      }

      const { data: insertedAssignmentData, error: insertedAssignmentError } = await supabase
        .from("training_assignments")
        .insert({
          department_id: departmentId,
          title,
          category_id: homeworkFormState.categoryId,
          description: description || null,
          due_at: dueAt,
          hours_credit: hoursCredit,
          external_video_url: externalVideoUrl || null,
          external_audio_url: externalAudioUrl || null,
          supporting_document_id: supportingDocumentId,
          review_required: homeworkFormState.reviewRequired,
          is_required: homeworkFormState.isRequired,
          status: "active",
          created_by: currentMemberId,
          updated_by: currentMemberId,
        })
        .select(
          "id, title, category_id, description, due_at, hours_credit, is_required, review_required, status, external_video_url, external_audio_url, supporting_document_id, created_at, updated_at",
        )
        .single();

      if (insertedAssignmentError || !insertedAssignmentData) {
        setHomeworkSaveError(insertedAssignmentError?.message || "Unable to create assigned training.");
        setIsSavingHomework(false);
        return;
      }

      const insertedAssignment: TrainingAssignmentRow = {
        id: String(insertedAssignmentData.id),
        title: typeof insertedAssignmentData.title === "string" ? insertedAssignmentData.title : title,
        category_id:
          typeof insertedAssignmentData.category_id === "string"
            ? insertedAssignmentData.category_id
            : homeworkFormState.categoryId,
        description: typeof insertedAssignmentData.description === "string" ? insertedAssignmentData.description : description || null,
        due_at: typeof insertedAssignmentData.due_at === "string" ? insertedAssignmentData.due_at : dueAt,
        hours_credit:
          typeof insertedAssignmentData.hours_credit === "number" && Number.isFinite(insertedAssignmentData.hours_credit)
            ? insertedAssignmentData.hours_credit
            : hoursCredit,
        is_required: typeof insertedAssignmentData.is_required === "boolean" ? insertedAssignmentData.is_required : homeworkFormState.isRequired,
        review_required:
          typeof insertedAssignmentData.review_required === "boolean"
            ? insertedAssignmentData.review_required
            : homeworkFormState.reviewRequired,
        status: typeof insertedAssignmentData.status === "string" ? insertedAssignmentData.status : "active",
        external_video_url:
          typeof insertedAssignmentData.external_video_url === "string"
            ? insertedAssignmentData.external_video_url
            : externalVideoUrl || null,
        external_audio_url:
          typeof insertedAssignmentData.external_audio_url === "string"
            ? insertedAssignmentData.external_audio_url
            : externalAudioUrl || null,
        supporting_document_id:
          typeof insertedAssignmentData.supporting_document_id === "string"
            ? insertedAssignmentData.supporting_document_id
            : supportingDocumentId,
        created_at:
          typeof insertedAssignmentData.created_at === "string"
            ? insertedAssignmentData.created_at
            : new Date().toISOString(),
        updated_at:
          typeof insertedAssignmentData.updated_at === "string"
            ? insertedAssignmentData.updated_at
            : new Date().toISOString(),
      };

      const memberPayload = uniqueMemberIds.map((memberId) => ({
        department_id: departmentId,
        training_assignment_id: insertedAssignment.id,
        member_id: memberId,
        due_at: dueAt,
        completion_status: "assigned",
        hours_earned: null,
        created_by: currentMemberId,
        updated_by: currentMemberId,
      }));

      const { data: insertedMembersData, error: insertedMembersError } = await supabase
        .from("training_assignment_members")
        .upsert(memberPayload, {
          onConflict: "department_id,training_assignment_id,member_id",
        })
        .select(
          "id, training_assignment_id, member_id, due_at, completion_status, completed_at, hours_earned, completion_notes, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
        );

      if (insertedMembersError) {
        setHomeworkSaveError(`Homework assignment created, but member assignment failed: ${insertedMembersError.message}`);
      }

      const insertedMemberRows: TrainingAssignmentMemberRow[] = (insertedMembersData ?? []).map((row) => ({
        id: String(row.id),
        training_assignment_id: typeof row.training_assignment_id === "string" ? row.training_assignment_id : insertedAssignment.id,
        member_id: typeof row.member_id === "string" ? row.member_id : "",
        due_at: typeof row.due_at === "string" ? row.due_at : dueAt,
        completion_status: typeof row.completion_status === "string" ? row.completion_status : "assigned",
        completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
        hours_earned: typeof row.hours_earned === "number" && Number.isFinite(row.hours_earned) ? row.hours_earned : null,
        completion_notes: typeof row.completion_notes === "string" ? row.completion_notes : null,
        reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
        reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
        review_notes: typeof row.review_notes === "string" ? row.review_notes : null,
        created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
        updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
      }));

      setAssignmentRows((current) => [insertedAssignment, ...current]);
      setAssignmentMemberRows((current) => {
        const nextById = new Map(current.map((row) => [row.id, row]));
        for (const row of insertedMemberRows) {
          nextById.set(row.id, row);
        }
        return Array.from(nextById.values());
      });

      setHomeworkFormState(emptyHomeworkAssignmentFormState(activeCategories[0]?.id ?? ""));
      setSelectedHomeworkMemberIds(new Set());
      setHomeworkMemberSearch("");
      setHomeworkMaterialFile(null);
      if (homeworkMaterialInputRef.current) {
        homeworkMaterialInputRef.current.value = "";
      }
      setHomeworkSuccessMessage("Assigned training created.");
      setIsHomeworkModalOpen(false);
      router.refresh();
    } catch (error) {
      setHomeworkSaveError(error instanceof Error ? error.message : "Unable to create assigned training.");
    } finally {
      setIsSavingHomework(false);
    }
  }

  async function reviewHomeworkSubmission(
    assignmentMemberId: string,
    status: "approved" | "rejected",
    reviewNotes: string,
  ) {
    if (!canReviewTraining) {
      return;
    }

    const assignmentMember = assignmentMemberRows.find((row) => row.id === assignmentMemberId);
    if (!assignmentMember) {
      return;
    }

    const assignment = assignmentById.get(assignmentMember.training_assignment_id);

    setReviewingAssignmentMemberId(assignmentMemberId);
    setHomeworkReviewError(null);
    setHomeworkReviewSuccessMessage(null);

    const sanitizedReviewNotes = reviewNotes.trim();

    try {
      const { data, error } = await supabase
        .from("training_assignment_members")
        .update({
          completion_status: status,
          completed_at: status === "approved" ? new Date().toISOString() : assignmentMember.completed_at,
          hours_earned:
            status === "approved"
              ? typeof assignmentMember.hours_earned === "number" && Number.isFinite(assignmentMember.hours_earned)
                ? assignmentMember.hours_earned
                : assignment?.hours_credit ?? 0
              : null,
          review_notes: sanitizedReviewNotes || null,
          reviewed_by: currentMemberId,
          reviewed_at: new Date().toISOString(),
          updated_by: currentMemberId,
        })
        .eq("id", assignmentMemberId)
        .eq("department_id", departmentId)
        .select(
          "id, training_assignment_id, member_id, due_at, completion_status, completed_at, hours_earned, completion_notes, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
        )
        .single();

      if (error || !data) {
        setHomeworkReviewError(error?.message || "Unable to review training submission.");
        setReviewingAssignmentMemberId(null);
        return;
      }

      const updatedRow: TrainingAssignmentMemberRow = {
        id: String(data.id),
        training_assignment_id:
          typeof data.training_assignment_id === "string" ? data.training_assignment_id : assignmentMember.training_assignment_id,
        member_id: typeof data.member_id === "string" ? data.member_id : assignmentMember.member_id,
        due_at: typeof data.due_at === "string" ? data.due_at : assignmentMember.due_at,
        completion_status: typeof data.completion_status === "string" ? data.completion_status : status,
        completed_at: typeof data.completed_at === "string" ? data.completed_at : assignmentMember.completed_at,
        hours_earned: typeof data.hours_earned === "number" && Number.isFinite(data.hours_earned) ? data.hours_earned : null,
        completion_notes:
          typeof data.completion_notes === "string" ? data.completion_notes : assignmentMember.completion_notes,
        reviewed_by: typeof data.reviewed_by === "string" ? data.reviewed_by : currentMemberId,
        reviewed_at: typeof data.reviewed_at === "string" ? data.reviewed_at : new Date().toISOString(),
        review_notes: typeof data.review_notes === "string" ? data.review_notes : assignmentMember.review_notes,
        created_at: typeof data.created_at === "string" ? data.created_at : assignmentMember.created_at,
        updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
      };

      setAssignmentMemberRows((current) => current.map((row) => (row.id === updatedRow.id ? updatedRow : row)));
      setHomeworkReviewSuccessMessage(status === "approved" ? "Assigned training approved." : "Assigned training rejected.");
      router.refresh();
    } catch (error) {
      setHomeworkReviewError(error instanceof Error ? error.message : "Unable to review training submission.");
    } finally {
      setReviewingAssignmentMemberId(null);
    }
  }

  async function openHomeworkEvidence(filePath: string) {
    if (!filePath.trim()) {
      setHomeworkProgressError("Supporting document is unavailable.");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("training-evidence")
        .createSignedUrl(filePath, 300);

      if (error || !data?.signedUrl) {
        setHomeworkProgressError(error?.message || "Unable to open supporting document.");
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setHomeworkProgressError(error instanceof Error ? error.message : "Unable to open supporting document.");
    }
  }

  function markHomeworkMaterialOpened(memberId: string, material: keyof HomeworkMaterialOpenState) {
    setHomeworkOpenedMaterialsByMemberId((current) => {
      const existing = current[memberId] ?? { document: false, video: false, audio: false };
      return {
        ...current,
        [memberId]: {
          ...existing,
          [material]: true,
        },
      };
    });
  }

  function getHomeworkMaterialGate(
    assignment: TrainingAssignmentRow,
    assignmentMemberId: string,
  ) {
    const openedState = homeworkOpenedMaterialsByMemberId[assignmentMemberId] ?? {
      document: false,
      video: false,
      audio: false,
    };

    const requiredMaterials: Array<{ key: keyof HomeworkMaterialOpenState; label: string }> = [];

    if (assignment.supporting_document_id) {
      requiredMaterials.push({ key: "document", label: "document" });
    }

    if (assignment.external_video_url) {
      requiredMaterials.push({ key: "video", label: "video" });
    }

    if (assignment.external_audio_url) {
      requiredMaterials.push({ key: "audio", label: "audio" });
    }

    const missingRequired = requiredMaterials
      .filter((item) => !openedState[item.key])
      .map((item) => item.label);

    return {
      canSubmit: missingRequired.length === 0,
      missingRequired,
    };
  }

  async function openHomeworkTraining(assignmentMember: TrainingAssignmentMemberRow) {
    const assignment = assignmentById.get(assignmentMember.training_assignment_id);
    if (!assignment) {
      setHomeworkProgressError("Assigned training details are unavailable.");
      return;
    }

    if (assignmentMember.member_id !== currentMemberId) {
      setHomeworkProgressError("You can only open your own assigned training.");
      return;
    }

    const normalizedStatus = assignmentMember.completion_status.trim().toLowerCase();
    const requiresReview = assignment.review_required === true;

    setManualOpenedHomeworkMemberIds((current) => {
      const next = new Set(current);
      next.add(assignmentMember.id);
      return next;
    });

    setHomeworkProgressError(null);
    setHomeworkProgressSuccessMessage(null);

    if (normalizedStatus !== "assigned" && normalizedStatus !== "rejected") {
      setHomeworkProgressSuccessMessage(
        requiresReview
          ? "Training opened. Review materials, then submit for review."
          : "Training opened. Complete training when finished.",
      );
      return;
    }

    setOpeningHomeworkMemberId(assignmentMember.id);

    try {
      const isRejected = normalizedStatus === "rejected";

      const { data, error } = await supabase
        .from("training_assignment_members")
        .update({
          completion_status: "in_progress",
          reviewed_by: isRejected ? null : assignmentMember.reviewed_by,
          reviewed_at: isRejected ? null : assignmentMember.reviewed_at,
          review_notes: isRejected ? null : assignmentMember.review_notes,
          updated_by: currentMemberId,
        })
        .eq("id", assignmentMember.id)
        .eq("department_id", departmentId)
        .eq("member_id", currentMemberId)
        .select(
          "id, training_assignment_id, member_id, due_at, completion_status, completed_at, hours_earned, completion_notes, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
        )
        .single();

      if (error || !data) {
        setHomeworkProgressError(error?.message || "Unable to open assigned training.");
        return;
      }

      const updatedRow: TrainingAssignmentMemberRow = {
        id: String(data.id),
        training_assignment_id:
          typeof data.training_assignment_id === "string" ? data.training_assignment_id : assignmentMember.training_assignment_id,
        member_id: typeof data.member_id === "string" ? data.member_id : assignmentMember.member_id,
        due_at: typeof data.due_at === "string" ? data.due_at : assignmentMember.due_at,
        completion_status: typeof data.completion_status === "string" ? data.completion_status : "in_progress",
        completed_at: typeof data.completed_at === "string" ? data.completed_at : assignmentMember.completed_at,
        hours_earned: typeof data.hours_earned === "number" && Number.isFinite(data.hours_earned) ? data.hours_earned : null,
        completion_notes:
          typeof data.completion_notes === "string" ? data.completion_notes : assignmentMember.completion_notes,
        reviewed_by: typeof data.reviewed_by === "string" ? data.reviewed_by : assignmentMember.reviewed_by,
        reviewed_at: typeof data.reviewed_at === "string" ? data.reviewed_at : assignmentMember.reviewed_at,
        review_notes: typeof data.review_notes === "string" ? data.review_notes : assignmentMember.review_notes,
        created_at: typeof data.created_at === "string" ? data.created_at : assignmentMember.created_at,
        updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
      };

      setAssignmentMemberRows((current) => current.map((row) => (row.id === updatedRow.id ? updatedRow : row)));
      setHomeworkProgressSuccessMessage(
        requiresReview
          ? "Training opened. Review materials, then submit for review."
          : "Training opened. Complete training when finished.",
      );
      router.refresh();
    } catch (error) {
      setHomeworkProgressError(error instanceof Error ? error.message : "Unable to open assigned training.");
    } finally {
      setOpeningHomeworkMemberId(null);
    }
  }

  function openHomeworkSupportingDocument(documentId: string) {
    const document = documentById.get(documentId);
    if (!document) {
      setHomeworkProgressError("Supporting document is unavailable.");
      return;
    }

    const categorySlug = resolveDocumentCategorySlug(document.category);
    if (!categorySlug) {
      setHomeworkProgressError("Supporting document category is unavailable.");
      return;
    }

    setHomeworkProgressError(null);
    window.open(`/documents/${categorySlug}/${document.id}`, "_blank", "noopener,noreferrer");
  }

  function openHomeworkVideo(assignmentMemberId: string, url: string) {
    const trimmed = url.trim();
    if (!trimmed) {
      setHomeworkProgressError("Video URL is unavailable.");
      return;
    }

    setHomeworkProgressError(null);
    markHomeworkMaterialOpened(assignmentMemberId, "video");
    window.open(trimmed, "_blank", "noopener,noreferrer");
  }

  function openHomeworkAudio(assignmentMemberId: string, url: string) {
    const trimmed = url.trim();
    if (!trimmed) {
      setHomeworkProgressError("Audio URL is unavailable.");
      return;
    }

    setHomeworkProgressError(null);
    markHomeworkMaterialOpened(assignmentMemberId, "audio");
    window.open(trimmed, "_blank", "noopener,noreferrer");
  }

  async function submitHomeworkCompletion(assignmentMember: TrainingAssignmentMemberRow) {
    const assignment = assignmentById.get(assignmentMember.training_assignment_id);
    if (!assignment) {
      setHomeworkProgressError("Assigned training details are unavailable.");
      return;
    }

    if (assignmentMember.member_id !== currentMemberId) {
      setHomeworkProgressError("You can only submit your own assigned training.");
      return;
    }

    const selectedFile = homeworkEvidenceFileByMemberId[assignmentMember.id] ?? null;
    const notes = (homeworkCompletionNotesByMemberId[assignmentMember.id] ?? "").trim();

    setSubmittingHomeworkMemberId(assignmentMember.id);
    setHomeworkProgressError(null);
    setHomeworkProgressSuccessMessage(null);

    try {
      const { data: rpcRows, error: rpcError } = await supabase.rpc("complete_assigned_training_member", {
        p_assignment_member_id: assignmentMember.id,
        p_completion_notes: notes || null,
      });

      if (rpcError) {
        setHomeworkProgressError(rpcError.message || "Unable to submit assigned training completion.");
        setSubmittingHomeworkMemberId(null);
        return;
      }

      const rpcRow = Array.isArray(rpcRows)
        ? ((rpcRows[0] as Record<string, unknown> | undefined) ?? null)
        : ((rpcRows as Record<string, unknown> | null) ?? null);

      if (!rpcRow) {
        setHomeworkProgressError("Unable to submit assigned training completion.");
        setSubmittingHomeworkMemberId(null);
        return;
      }

      let uploadWarning: string | null = null;

      if (selectedFile) {
        const sanitizedName = sanitizeFileName(selectedFile.name || "homework-proof.pdf");
        const storagePath = `${departmentId}/${currentMemberId}/assignment-${assignmentMember.id}/${Date.now()}-${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from("training-evidence")
          .upload(storagePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          uploadWarning = uploadError.message || "Evidence upload failed.";
        } else {
          const { data: evidenceData, error: evidenceError } = await supabase
            .from("training_assignment_member_evidence")
            .insert({
              department_id: departmentId,
              assignment_member_id: assignmentMember.id,
              member_id: currentMemberId,
              file_name: selectedFile.name,
              file_path: storagePath,
              file_size_bytes: selectedFile.size,
              mime_type: selectedFile.type || null,
              uploaded_by: currentMemberId,
            })
            .select("id, assignment_member_id, member_id, file_name, file_path, mime_type, created_at")
            .single();

          if (evidenceError || !evidenceData) {
            uploadWarning = evidenceError?.message || "Evidence record could not be saved.";
          } else {
            setAssignmentEvidenceState((current) => [
              ...current,
              {
                id: String(evidenceData.id),
                assignment_member_id:
                  typeof evidenceData.assignment_member_id === "string" ? evidenceData.assignment_member_id : assignmentMember.id,
                member_id: typeof evidenceData.member_id === "string" ? evidenceData.member_id : currentMemberId,
                file_name: typeof evidenceData.file_name === "string" ? evidenceData.file_name : selectedFile.name,
                file_path: typeof evidenceData.file_path === "string" ? evidenceData.file_path : storagePath,
                mime_type: typeof evidenceData.mime_type === "string" ? evidenceData.mime_type : selectedFile.type || null,
                created_at: typeof evidenceData.created_at === "string" ? evidenceData.created_at : new Date().toISOString(),
              },
            ]);
          }
        }
      }

      const updatedRow: TrainingAssignmentMemberRow = {
        id: String(rpcRow.id),
        training_assignment_id:
          typeof rpcRow.training_assignment_id === "string"
            ? rpcRow.training_assignment_id
            : assignmentMember.training_assignment_id,
        member_id: typeof rpcRow.member_id === "string" ? rpcRow.member_id : assignmentMember.member_id,
        due_at: typeof rpcRow.due_at === "string" ? rpcRow.due_at : assignmentMember.due_at,
        completion_status: typeof rpcRow.completion_status === "string" ? rpcRow.completion_status : "approved",
        completed_at: typeof rpcRow.completed_at === "string" ? rpcRow.completed_at : assignmentMember.completed_at,
        hours_earned:
          typeof rpcRow.hours_earned === "number" && Number.isFinite(rpcRow.hours_earned) ? rpcRow.hours_earned : null,
        completion_notes: typeof rpcRow.completion_notes === "string" ? rpcRow.completion_notes : notes || null,
        reviewed_by: typeof rpcRow.reviewed_by === "string" ? rpcRow.reviewed_by : null,
        reviewed_at: typeof rpcRow.reviewed_at === "string" ? rpcRow.reviewed_at : null,
        review_notes: typeof rpcRow.review_notes === "string" ? rpcRow.review_notes : null,
        created_at: typeof rpcRow.created_at === "string" ? rpcRow.created_at : assignmentMember.created_at,
        updated_at: typeof rpcRow.updated_at === "string" ? rpcRow.updated_at : new Date().toISOString(),
      };

      setAssignmentMemberRows((current) => current.map((row) => (row.id === updatedRow.id ? updatedRow : row)));
      setHomeworkEvidenceFileByMemberId((current) => ({ ...current, [assignmentMember.id]: null }));
      setHomeworkProgressSuccessMessage(
        uploadWarning ? `Assigned training completed. ${uploadWarning}` : "Assigned training completed. Hours awarded.",
      );
      const evidenceInput = homeworkEvidenceInputRefs.current.get(assignmentMember.id);
      if (evidenceInput) {
        evidenceInput.value = "";
      }
      router.refresh();
    } catch (error) {
      setHomeworkProgressError(error instanceof Error ? error.message : "Unable to submit assigned training completion.");
    } finally {
      setSubmittingHomeworkMemberId(null);
    }
  }

  async function submitHomeworkForReview(assignmentMember: TrainingAssignmentMemberRow) {
    const assignment = assignmentById.get(assignmentMember.training_assignment_id);
    if (!assignment) {
      setHomeworkProgressError("Assigned training details are unavailable.");
      return;
    }

    if (assignmentMember.member_id !== currentMemberId) {
      setHomeworkProgressError("You can only submit your own assigned training.");
      return;
    }

    const selectedFile = homeworkEvidenceFileByMemberId[assignmentMember.id] ?? null;
    const notes = (homeworkCompletionNotesByMemberId[assignmentMember.id] ?? "").trim();

    setSubmittingHomeworkMemberId(assignmentMember.id);
    setHomeworkProgressError(null);
    setHomeworkProgressSuccessMessage(null);

    try {
      const { data, error } = await supabase
        .from("training_assignment_members")
        .update({
          completion_status: "submitted",
          completion_notes: notes || null,
          completed_at: null,
          hours_earned: null,
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
          updated_by: currentMemberId,
        })
        .eq("id", assignmentMember.id)
        .eq("department_id", departmentId)
        .eq("member_id", currentMemberId)
        .select(
          "id, training_assignment_id, member_id, due_at, completion_status, completed_at, hours_earned, completion_notes, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
        )
        .single();

      if (error || !data) {
        setHomeworkProgressError(error?.message || "Unable to submit assigned training for review.");
        setSubmittingHomeworkMemberId(null);
        return;
      }

      let uploadWarning: string | null = null;

      if (selectedFile) {
        const sanitizedName = sanitizeFileName(selectedFile.name || "homework-proof.pdf");
        const storagePath = `${departmentId}/${currentMemberId}/assignment-${assignmentMember.id}/${Date.now()}-${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from("training-evidence")
          .upload(storagePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          uploadWarning = uploadError.message || "Evidence upload failed.";
        } else {
          const { data: evidenceData, error: evidenceError } = await supabase
            .from("training_assignment_member_evidence")
            .insert({
              department_id: departmentId,
              assignment_member_id: assignmentMember.id,
              member_id: currentMemberId,
              file_name: selectedFile.name,
              file_path: storagePath,
              file_size_bytes: selectedFile.size,
              mime_type: selectedFile.type || null,
              uploaded_by: currentMemberId,
            })
            .select("id, assignment_member_id, member_id, file_name, file_path, mime_type, created_at")
            .single();

          if (evidenceError || !evidenceData) {
            uploadWarning = evidenceError?.message || "Evidence record could not be saved.";
          } else {
            setAssignmentEvidenceState((current) => [
              ...current,
              {
                id: String(evidenceData.id),
                assignment_member_id:
                  typeof evidenceData.assignment_member_id === "string" ? evidenceData.assignment_member_id : assignmentMember.id,
                member_id: typeof evidenceData.member_id === "string" ? evidenceData.member_id : currentMemberId,
                file_name: typeof evidenceData.file_name === "string" ? evidenceData.file_name : selectedFile.name,
                file_path: typeof evidenceData.file_path === "string" ? evidenceData.file_path : storagePath,
                mime_type: typeof evidenceData.mime_type === "string" ? evidenceData.mime_type : selectedFile.type || null,
                created_at: typeof evidenceData.created_at === "string" ? evidenceData.created_at : new Date().toISOString(),
              },
            ]);
          }
        }
      }

      const updatedRow: TrainingAssignmentMemberRow = {
        id: String(data.id),
        training_assignment_id:
          typeof data.training_assignment_id === "string" ? data.training_assignment_id : assignmentMember.training_assignment_id,
        member_id: typeof data.member_id === "string" ? data.member_id : assignmentMember.member_id,
        due_at: typeof data.due_at === "string" ? data.due_at : assignmentMember.due_at,
        completion_status: typeof data.completion_status === "string" ? data.completion_status : "pending_review",
        completed_at: typeof data.completed_at === "string" ? data.completed_at : assignmentMember.completed_at,
        hours_earned: typeof data.hours_earned === "number" && Number.isFinite(data.hours_earned) ? data.hours_earned : null,
        completion_notes: typeof data.completion_notes === "string" ? data.completion_notes : notes || null,
        reviewed_by: typeof data.reviewed_by === "string" ? data.reviewed_by : null,
        reviewed_at: typeof data.reviewed_at === "string" ? data.reviewed_at : null,
        review_notes: typeof data.review_notes === "string" ? data.review_notes : null,
        created_at: typeof data.created_at === "string" ? data.created_at : assignmentMember.created_at,
        updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
      };

      setAssignmentMemberRows((current) => current.map((row) => (row.id === updatedRow.id ? updatedRow : row)));
      setHomeworkEvidenceFileByMemberId((current) => ({ ...current, [assignmentMember.id]: null }));
      setHomeworkProgressSuccessMessage(
        uploadWarning ? `Assigned training submitted for review. ${uploadWarning}` : "Assigned training submitted for review.",
      );
      const evidenceInput = homeworkEvidenceInputRefs.current.get(assignmentMember.id);
      if (evidenceInput) {
        evidenceInput.value = "";
      }
      router.refresh();
    } catch (error) {
      setHomeworkProgressError(error instanceof Error ? error.message : "Unable to submit assigned training for review.");
    } finally {
      setSubmittingHomeworkMemberId(null);
    }
  }

  function requestHomeworkSubmission(assignmentMember: TrainingAssignmentMemberRow) {
    const assignment = assignmentById.get(assignmentMember.training_assignment_id);
    if (!assignment) {
      setHomeworkProgressError("Assigned training details are unavailable.");
      return;
    }

    const materialGate = getHomeworkMaterialGate(assignment, assignmentMember.id);
    if (!materialGate.canSubmit) {
      setHomeworkProgressError("Open all assigned training materials before submitting.");
      return;
    }

    setHomeworkProgressError(null);
    setConfirmHomeworkSubmitMemberId(assignmentMember.id);
  }

  function requestHomeworkCompletion(assignmentMember: TrainingAssignmentMemberRow) {
    const assignment = assignmentById.get(assignmentMember.training_assignment_id);
    if (!assignment) {
      setHomeworkProgressError("Assigned training details are unavailable.");
      return;
    }

    const materialGate = getHomeworkMaterialGate(assignment, assignmentMember.id);
    if (!materialGate.canSubmit) {
      setHomeworkProgressError("Open all assigned training materials before submitting.");
      return;
    }

    setHomeworkProgressError(null);
    setConfirmHomeworkCompletionMemberId(assignmentMember.id);
  }

  function openCompletedTogetherDialog(assignmentMember: TrainingAssignmentMemberRow) {
    if (assignmentMember.member_id !== currentMemberId) {
      setHomeworkProgressError("You can only submit completed-together members for your own assigned training.");
      return;
    }

    setCompletedTogetherSourceAssignmentMemberId(assignmentMember.id);
    setCompletedTogetherMemberSearch("");
    setSelectedCompletedTogetherMemberIds(new Set());
    setCompletedTogetherError(null);
  }

  function closeCompletedTogetherDialog() {
    setCompletedTogetherSourceAssignmentMemberId(null);
    setCompletedTogetherMemberSearch("");
    setSelectedCompletedTogetherMemberIds(new Set());
    setCompletedTogetherError(null);
  }

  function toggleCompletedTogetherMemberSelection(memberId: string) {
    setSelectedCompletedTogetherMemberIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  function selectAllCompletedTogetherMembers() {
    setSelectedCompletedTogetherMemberIds(new Set(completedTogetherCandidates.map((member) => member.id)));
  }

  function clearCompletedTogetherMembers() {
    setSelectedCompletedTogetherMemberIds(new Set());
  }

  async function submitCompletedTogetherMembers() {
    if (!completedTogetherSourceAssignmentMember) {
      setCompletedTogetherError("Open an assigned training item before submitting completed-together members.");
      return;
    }

    if (completedTogetherSourceAssignmentMember.member_id !== currentMemberId) {
      setCompletedTogetherError("You can only submit completed-together members for your own assigned training.");
      return;
    }

    const selectedIds = Array.from(selectedCompletedTogetherMemberIds)
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && id !== currentMemberId);
    const uniqueSelectedIds = Array.from(new Set(selectedIds));

    if (uniqueSelectedIds.length === 0) {
      setCompletedTogetherError("Select at least one other department member.");
      return;
    }

    if (uniqueSelectedIds.length > 25) {
      setCompletedTogetherError("You can submit at most 25 members at one time.");
      return;
    }

    setIsSubmittingCompletedTogether(true);
    setCompletedTogetherError(null);
    setHomeworkProgressError(null);
    setHomeworkProgressSuccessMessage(null);

    try {
      const { data: rpcRows, error: rpcError } = await supabase.rpc("add_homework_completed_together_members", {
        p_source_assignment_member_id: completedTogetherSourceAssignmentMember.id,
        p_selected_member_ids: uniqueSelectedIds,
      });

      if (rpcError) {
        setCompletedTogetherError(rpcError.message || "Unable to submit completed-together members.");
        return;
      }

      const rpcRowsList = (rpcRows ?? []) as Array<Record<string, unknown>>;

      const affectedMemberIds = Array.from(
        new Set(
          rpcRowsList
            .map((row) => (row && typeof row.member_id === "string" ? row.member_id : ""))
            .filter((value) => value.length > 0),
        ),
      );

      if (affectedMemberIds.length > 0) {
        const { data: refreshedRows, error: refreshedRowsError } = await supabase
          .from("training_assignment_members")
          .select(
            "id, training_assignment_id, member_id, due_at, completion_status, completed_at, hours_earned, completion_notes, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
          )
          .eq("department_id", departmentId)
          .eq("training_assignment_id", completedTogetherSourceAssignmentMember.training_assignment_id)
          .in("member_id", affectedMemberIds);

        if (refreshedRowsError) {
          setCompletedTogetherError(refreshedRowsError.message || "Completed Together submitted, but rows could not be refreshed.");
          return;
        }

        const normalizedRows: TrainingAssignmentMemberRow[] = (refreshedRows ?? []).map((row) => ({
          id: String(row.id),
          training_assignment_id:
            typeof row.training_assignment_id === "string"
              ? row.training_assignment_id
              : completedTogetherSourceAssignmentMember.training_assignment_id,
          member_id: typeof row.member_id === "string" ? row.member_id : "",
          due_at: typeof row.due_at === "string" ? row.due_at : completedTogetherSourceAssignmentMember.due_at,
          completion_status: typeof row.completion_status === "string" ? row.completion_status : "pending_review",
          completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
          hours_earned: typeof row.hours_earned === "number" && Number.isFinite(row.hours_earned) ? row.hours_earned : null,
          completion_notes: typeof row.completion_notes === "string" ? row.completion_notes : null,
          reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
          reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
          review_notes: typeof row.review_notes === "string" ? row.review_notes : null,
          created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
          updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
        }));

        setAssignmentMemberRows((current) => {
          const nextById = new Map(current.map((row) => [row.id, row]));
          for (const row of normalizedRows) {
            nextById.set(row.id, row);
          }
          return Array.from(nextById.values());
        });
      }

      setHomeworkProgressSuccessMessage("Completed Together submitted for officer review.");
      closeCompletedTogetherDialog();
      router.refresh();
    } catch (error) {
      setCompletedTogetherError(error instanceof Error ? error.message : "Unable to submit completed-together members.");
    } finally {
      setIsSubmittingCompletedTogether(false);
    }
  }

  async function confirmHomeworkSubmission() {
    if (!confirmHomeworkSubmitMemberId) {
      return;
    }

    const assignmentMember = assignmentMemberRows.find((row) => row.id === confirmHomeworkSubmitMemberId);
    if (!assignmentMember) {
      setHomeworkProgressError("Assigned training details are unavailable.");
      setConfirmHomeworkSubmitMemberId(null);
      return;
    }

    const assignment = assignmentById.get(assignmentMember.training_assignment_id);
    if (!assignment) {
      setHomeworkProgressError("Assigned training details are unavailable.");
      setConfirmHomeworkSubmitMemberId(null);
      return;
    }

    setConfirmHomeworkSubmitMemberId(null);
    if (assignment.review_required) {
      await submitHomeworkForReview(assignmentMember);
      return;
    }

    await submitHomeworkCompletion(assignmentMember);
  }

  async function confirmHomeworkCompletion() {
    if (!confirmHomeworkCompletionMemberId) {
      return;
    }

    const assignmentMember = assignmentMemberRows.find((row) => row.id === confirmHomeworkCompletionMemberId);
    if (!assignmentMember) {
      setHomeworkProgressError("Assigned training details are unavailable.");
      setConfirmHomeworkCompletionMemberId(null);
      return;
    }

    setConfirmHomeworkCompletionMemberId(null);
    await submitHomeworkCompletion(assignmentMember);
  }

  const confirmHomeworkCompletionMember = useMemo(() => {
    if (!confirmHomeworkCompletionMemberId) {
      return null;
    }

    return assignmentMemberRows.find((row) => row.id === confirmHomeworkCompletionMemberId) ?? null;
  }, [assignmentMemberRows, confirmHomeworkCompletionMemberId]);

  const confirmHomeworkCompletionAssignment = useMemo(() => {
    if (!confirmHomeworkCompletionMember) {
      return null;
    }

    return assignmentById.get(confirmHomeworkCompletionMember.training_assignment_id) ?? null;
  }, [assignmentById, confirmHomeworkCompletionMember]);

  const confirmHomeworkAssignmentMember = useMemo(() => {
    if (!confirmHomeworkSubmitMemberId) {
      return null;
    }

    return assignmentMemberRows.find((row) => row.id === confirmHomeworkSubmitMemberId) ?? null;
  }, [assignmentMemberRows, confirmHomeworkSubmitMemberId]);

  const confirmHomeworkAssignment = useMemo(() => {
    if (!confirmHomeworkAssignmentMember) {
      return null;
    }

    return assignmentById.get(confirmHomeworkAssignmentMember.training_assignment_id) ?? null;
  }, [assignmentById, confirmHomeworkAssignmentMember]);

  const confirmRequiresReview = confirmHomeworkAssignment?.review_required === true;

  const homeworkReviewConfirmModal = confirmHomeworkSubmitMemberId ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
        <h3 className="text-lg font-bold text-white">Submit Training for Review?</h3>
        <p className="mt-2 text-sm text-neutral-300">
          By submitting this assignment, you are confirming that you completed the assigned training and reviewed the required department training materials.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmHomeworkSubmitMemberId(null)}
            className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-[#222222]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void confirmHomeworkSubmission();
            }}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 transition hover:bg-red-500/20"
          >
            Yes, Submit for Review
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const homeworkCompletionConfirmModal = confirmHomeworkCompletionMemberId ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
        <h3 className="text-lg font-bold text-white">Complete Training?</h3>
        <p className="mt-2 text-sm text-neutral-300">
          Are you sure you have completed this training?
        </p>
        {confirmHomeworkCompletionAssignment ? (
          <p className="mt-2 text-sm text-neutral-400">
            Confirming will complete this assignment and immediately credit {formatHours(confirmHomeworkCompletionAssignment.hours_credit)} hours.
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmHomeworkCompletionMemberId(null)}
            className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-[#222222]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void confirmHomeworkCompletion();
            }}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 transition hover:bg-red-500/20"
          >
            Complete Training
          </button>
        </div>
      </div>
    </div>
  ) : null;

  async function handleSubmitOutsideTraining(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = outsideFormState.title.trim();
    const trainingMethod = outsideFormState.trainingMethod.trim();
    const instructorName = outsideFormState.instructorName.trim();
    const location = outsideFormState.location.trim();
    const details = outsideFormState.details.trim();
    const emsProviderName = outsideFormState.emsProviderName.trim();
    const isEmsTraining = outsideFormState.trainingKind === "ems";
    const emsCourseDefinitionId = outsideFormState.emsCourseDefinitionId || null;
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

      const insertedSubmission: TrainingOutsideSubmissionRow = {
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
            setOutsideEvidenceState((current) => [
              ...current,
              {
                id: String(evidenceData.id),
                submission_id: typeof evidenceData.submission_id === "string" ? evidenceData.submission_id : insertedSubmission.id,
                member_id: typeof evidenceData.member_id === "string" ? evidenceData.member_id : currentMemberId,
                file_name: outsideProofFile.name,
                file_path: storagePath,
                mime_type: outsideProofFile.type || null,
                created_at: typeof evidenceData.created_at === "string" ? evidenceData.created_at : new Date().toISOString(),
              },
            ]);
          }
        }
      }

      setOutsideSubmissionRows((current) => [insertedSubmission, ...current]);
      setOutsideFormState(emptyOutsideTrainingFormState(activeCategories[0]?.id ?? ""));
      setOutsideProofFile(null);
      if (outsideProofInputRef.current) {
        outsideProofInputRef.current.value = "";
      }
      setOutsideSuccessMessage(
        uploadWarning
          ? `Self-reported training submitted. ${uploadWarning}`
          : "Outside training submitted for review.",
      );
      await triggerEmsAllocationRecalculation(currentMemberId);
      router.refresh();
    } catch (error) {
      setOutsideSaveError(error instanceof Error ? error.message : "Unable to submit self-reported training.");
    } finally {
      setIsSavingOutside(false);
    }
  }

  async function reviewOutsideSubmission(submissionId: string, status: "approved" | "rejected") {
    if (!canReviewTraining) {
      return;
    }

    setReviewingSubmissionId(submissionId);
    setReviewError(null);
    setReviewSuccessMessage(null);

    try {
      const { data, error } = await supabase
        .from("training_outside_submissions")
        .update({
          status,
          reviewed_by: currentMemberId,
          reviewed_at: new Date().toISOString(),
          updated_by: currentMemberId,
        })
        .eq("id", submissionId)
        .eq("department_id", departmentId)
        .select(
          "id, member_id, title, category_id, training_date, hours, is_ems_training, ems_core_topic, ems_course_definition_id, ems_needs_review, ems_provider_name, description, notes, status, review_required, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
        )
        .single();

      if (error || !data) {
        setReviewError(error?.message || "Unable to update self-reported training review.");
        setReviewingSubmissionId(null);
        return;
      }

      const updated: TrainingOutsideSubmissionRow = {
        id: String(data.id),
        member_id: typeof data.member_id === "string" ? data.member_id : "",
        title: typeof data.title === "string" ? data.title : "Self-Reported Training",
        category_id: typeof data.category_id === "string" ? data.category_id : null,
        training_date: typeof data.training_date === "string" ? data.training_date : "",
        hours:
          typeof data.hours === "number" && Number.isFinite(data.hours)
            ? data.hours
            : typeof data.hours === "string"
              ? Number.parseFloat(data.hours)
              : null,
        is_ems_training: data.is_ems_training === true,
        ems_core_topic: typeof data.ems_core_topic === "string" ? data.ems_core_topic : null,
        ems_course_definition_id:
          typeof data.ems_course_definition_id === "string" ? data.ems_course_definition_id : null,
        ems_needs_review: data.ems_needs_review === true,
        ems_provider_name: typeof data.ems_provider_name === "string" ? data.ems_provider_name : null,
        description: typeof data.description === "string" ? data.description : null,
        notes: typeof data.notes === "string" ? data.notes : null,
        status: typeof data.status === "string" ? data.status : status,
        review_required: typeof data.review_required === "boolean" ? data.review_required : true,
        reviewed_by: typeof data.reviewed_by === "string" ? data.reviewed_by : null,
        reviewed_at: typeof data.reviewed_at === "string" ? data.reviewed_at : null,
        review_notes: typeof data.review_notes === "string" ? data.review_notes : null,
        created_at: typeof data.created_at === "string" ? data.created_at : "",
        updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
      };

      setOutsideSubmissionRows((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      setReviewSuccessMessage(status === "approved" ? "Self-reported training approved." : "Self-reported training rejected.");
      await triggerEmsAllocationRecalculation(updated.member_id);
      router.refresh();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Unable to update self-reported training review.");
    } finally {
      setReviewingSubmissionId(null);
    }
  }

  async function openOutsideEvidence(filePath: string) {
    if (!filePath.trim()) {
      setReviewError("Supporting document is unavailable.");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("training-evidence")
        .createSignedUrl(filePath, 300);

      if (error || !data?.signedUrl) {
        setReviewError(error?.message || "Unable to open supporting document.");
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Unable to open supporting document.");
    }
  }

  async function handleCreateTraining(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = formState.title.trim();
    const trainingMethod = formState.trainingMethod.trim();
    const instructorName = formState.instructorName.trim();
    const location = formState.location.trim();
    const details = formState.details.trim();
    const emsProviderName = formState.emsProviderName.trim();

    if (!title) {
      setSaveError("Training title is required.");
      return;
    }

    if (!formState.categoryId) {
      setSaveError("Select a training category.");
      return;
    }

    if (!formState.date.trim()) {
      setSaveError("Training date is required.");
      return;
    }

    if (!formState.startTime) {
      setSaveError("Start time is required.");
      return;
    }

    const startMinutes = minutesFromMilitary(formState.startTime);
    if (startMinutes === null) {
      setSaveError("Start time is invalid.");
      return;
    }

    if (!formState.hoursCredit.trim()) {
      setSaveError("Training hours are required.");
      return;
    }

    const hoursCredit = Number.parseFloat(formState.hoursCredit);
    if (!Number.isFinite(hoursCredit) || hoursCredit <= 0) {
      setSaveError("Training hours must be greater than 0.");
      return;
    }

    const startsAt = toIsoDateTime(formState.date, formState.startTime);

    const selectedCategory = activeCategories.find((category) => category.id === formState.categoryId);
    if (!selectedCategory) {
      setSaveError("Select an active training category.");
      return;
    }

    const isEmsTraining = isEmsCategoryName(selectedCategory.name);
    const emsCourseDefinitionId = isEmsTraining ? (formState.emsCourseDefinitionId || null) : null;
    const emsCoreTopic = isEmsTraining ? formState.emsCoreTopic : null;
    const emsNeedsReview =
      isEmsTraining && (formState.emsNeedsReview || formState.emsCoreTopic === "other");

    setIsSaving(true);
    setSaveError(null);

    try {
      const { data: categoryRow, error: categoryError } = await supabase
        .from("training_categories")
        .select("id, active")
        .eq("department_id", departmentId)
        .eq("id", formState.categoryId)
        .maybeSingle();

      if (categoryError) {
        setSaveError(categoryError.message || "Unable to validate selected training category.");
        setIsSaving(false);
        return;
      }

      if (!categoryRow || categoryRow.active !== true) {
        setSaveError("Selected category is unavailable. Choose an active training category.");
        setIsSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from("training_events")
        .insert({
          department_id: departmentId,
          title,
          category_id: formState.categoryId,
          topic: isEmsTraining ? emsCoreTopic : null,
          training_type: trainingMethod || null,
          is_ems_training: isEmsTraining,
          ems_core_topic: emsCoreTopic,
          ems_course_definition_id: emsCourseDefinitionId,
          ems_needs_review: emsNeedsReview,
          ems_provider_name: emsProviderName || instructorName || null,
          description: details || null,
          location: location || null,
          instructor_name: instructorName || null,
          starts_at: startsAt,
          ends_at: null,
          duration_minutes: null,
          hours_credit: hoursCredit,
          status: "scheduled",
          supporting_document_id: null,
          created_by: currentMemberId,
          updated_by: currentMemberId,
        })
        .select(
          "id, title, category_id, topic, training_type, is_ems_training, ems_core_topic, ems_course_definition_id, ems_needs_review, ems_provider_name, description, location, instructor_name, starts_at, ends_at, duration_minutes, hours_credit, status, supporting_document_id, created_at, updated_at",
        )
        .single();

      if (error || !data) {
        setSaveError(error?.message || "Unable to create training event.");
        setIsSaving(false);
        return;
      }

      const selectedIds = Array.from(selectedMemberIds);
      if (selectedIds.length > 0) {
        const validDepartmentMemberIds = new Set(departmentMembers.map((member) => member.id));
        const uniqueValidIds = Array.from(new Set(selectedIds)).filter((memberId) => validDepartmentMemberIds.has(memberId));

        if (uniqueValidIds.length > 0) {
          const attendancePayload = uniqueValidIds.map((memberId) => ({
            department_id: departmentId,
            training_event_id: String(data.id),
            member_id: memberId,
            attendance_status: "attending",
            completion_status: "not_completed",
            recorded_by: currentMemberId,
          }));

          const { error: attendanceInsertError } = await supabase
            .from("training_event_attendance")
            .upsert(attendancePayload, {
              onConflict: "department_id,training_event_id,member_id",
              ignoreDuplicates: true,
            });

          if (attendanceInsertError) {
            setSaveError(`Training event saved, but attendance could not be recorded: ${attendanceInsertError.message}`);
          }
        }
      }

      const inserted: TrainingEventRow = {
        id: String(data.id),
        title: typeof data.title === "string" ? data.title : title,
        category_id: typeof data.category_id === "string" ? data.category_id : formState.categoryId,
        topic: typeof data.topic === "string" ? data.topic : null,
        training_type: typeof data.training_type === "string" ? data.training_type : trainingMethod || null,
        is_ems_training: data.is_ems_training === true,
        ems_core_topic: typeof data.ems_core_topic === "string" ? data.ems_core_topic : emsCoreTopic,
        ems_course_definition_id:
          typeof data.ems_course_definition_id === "string" ? data.ems_course_definition_id : emsCourseDefinitionId,
        ems_needs_review: data.ems_needs_review === true,
        ems_provider_name: typeof data.ems_provider_name === "string" ? data.ems_provider_name : emsProviderName || instructorName || null,
        description: typeof data.description === "string" ? data.description : details || null,
        location: typeof data.location === "string" ? data.location : location || null,
        instructor_name: typeof data.instructor_name === "string" ? data.instructor_name : instructorName || null,
        starts_at: typeof data.starts_at === "string" ? data.starts_at : startsAt,
        ends_at: typeof data.ends_at === "string" ? data.ends_at : null,
        duration_minutes:
          typeof data.duration_minutes === "number" && Number.isFinite(data.duration_minutes)
            ? data.duration_minutes
            : null,
        hours_credit:
          typeof data.hours_credit === "number" && Number.isFinite(data.hours_credit)
            ? data.hours_credit
            : hoursCredit,
        status: typeof data.status === "string" ? data.status : "scheduled",
        supporting_document_id: typeof data.supporting_document_id === "string" ? data.supporting_document_id : null,
        created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
        updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
      };

      setEventRows((current) => [inserted, ...current]);
      setIsModalOpen(false);
      setMemberSearch("");
      setSelectedMemberIds(new Set());
      setSuccessMessage("Training event saved.");
      await triggerEmsAllocationRecalculationForMembers(Array.from(selectedMemberIds));
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to create training event.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!hasManagementCapabilities) {
    return (
      <div className="space-y-6 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">
            Training
          </p>
          <h1
          className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
          style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            My Training
          </h1>
          <p className="mt-2 max-w-3xl text-neutral-400">
            Complete your assigned training and submit self-reported training for officer/administrator review.
          </p>
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-2xl font-semibold text-white">My Assigned Training</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Required assigned training appears here and contributes training credit when completed.
          </p>

          {homeworkProgressError ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {homeworkProgressError}
            </div>
          ) : null}

          {homeworkProgressSuccessMessage ? (
            <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              {homeworkProgressSuccessMessage}
            </div>
          ) : null}

          {myHomeworkRows.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
              No assigned training yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {myHomeworkRows.map((assignmentMember) => {
                const assignment = assignmentById.get(assignmentMember.training_assignment_id);
                if (!assignment) {
                  return null;
                }

                const evidenceFiles = assignmentEvidenceByMemberRowId.get(assignmentMember.id) ?? [];
                const submissionStatus = normalizeHomeworkStatusLabel(assignmentMember.completion_status);
                const normalizedStatus = assignmentMember.completion_status.trim().toLowerCase();
                const requiresReview = assignment.review_required === true;
                const isPendingReview = normalizedStatus === "pending_review" || normalizedStatus === "submitted";
                const canUseCompletedTogether = normalizedStatus === "pending_review";
                const isRejected = normalizedStatus === "rejected";
                const isApproved = assignmentMember.completion_status === "approved";
                const isSubmitting = submittingHomeworkMemberId === assignmentMember.id;
                const isOpeningTraining = openingHomeworkMemberId === assignmentMember.id;
                const hasOpenedTraining =
                  normalizedStatus === "in_progress" ||
                  isPendingReview ||
                  isApproved ||
                  (openedHomeworkMemberIds.has(assignmentMember.id) && !isRejected);
                const hasTrainingMaterial =
                  Boolean(assignment.description?.trim()) ||
                  Boolean(assignment.supporting_document_id) ||
                  Boolean(assignment.external_video_url) ||
                  Boolean(assignment.external_audio_url);
                const materialGate = getHomeworkMaterialGate(assignment, assignmentMember.id);
                const canShowOpenTrainingButton = !isPendingReview && !hasOpenedTraining;
                const showSubmittedMessage = requiresReview && isPendingReview;

                return (
                  <div key={assignmentMember.id} className="rounded-xl border border-white/10 bg-[#141414] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{assignment.title}</p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {getCategoryNameById(categories, assignment.category_id)}
                          {assignment.hours_credit !== null ? ` • ${formatHours(assignment.hours_credit)} hrs` : ""}
                          {assignmentMember.due_at ? ` • Due ${formatDateOnly(assignmentMember.due_at)}` : assignment.due_at ? ` • Due ${formatDateOnly(assignment.due_at)}` : ""}
                        </p>
                      </div>

                      <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.14em] ${homeworkStatusStyles(assignmentMember.completion_status)}`}>
                        {submissionStatus}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-neutral-400 md:grid-cols-2">
                      <p>{assignment.is_required ? "Required" : "Optional"}</p>
                      <p>Review required: {assignment.review_required ? "Yes" : "No"}</p>
                    </div>

                    {evidenceFiles.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-white/10 bg-[#101010] p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Evidence</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {evidenceFiles.map((file) => (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => openHomeworkEvidence(file.file_path)}
                              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.08]"
                            >
                              {file.file_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {!isApproved ? (
                      <div className="mt-4 rounded-lg border border-white/10 bg-[#101010] p-3">
                        {isRejected ? (
                          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-200">Rejected</p>
                            {assignmentMember.review_notes?.trim() ? (
                              <p className="mt-1 text-sm text-red-100">Officer feedback: {assignmentMember.review_notes.trim()}</p>
                            ) : (
                              <p className="mt-1 text-sm text-red-100">Officer feedback is not provided. Review the assignment and resubmit for review.</p>
                            )}
                          </div>
                        ) : null}

                        {canShowOpenTrainingButton ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isOpeningTraining}
                              onClick={() => openHomeworkTraining(assignmentMember)}
                              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isOpeningTraining ? "Opening..." : "Open Training"}
                            </button>
                          </div>
                        ) : showSubmittedMessage ? (
                          <p className="text-sm font-semibold text-amber-200">Assigned training submitted for review.</p>
                        ) : null}

                        {assignmentMember.completion_notes?.trim() ? (
                          <p className="mt-2 text-sm text-neutral-300">{assignmentMember.completion_notes.trim()}</p>
                        ) : null}

                        {hasOpenedTraining ? (
                          <div className="mt-3 rounded-lg border border-white/10 bg-[#121212] p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Assigned Material</p>

                            {assignment.description?.trim() ? (
                              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-200">{assignment.description.trim()}</p>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {assignment.supporting_document_id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const supportingDocumentId = assignment.supporting_document_id;
                                    if (!supportingDocumentId) {
                                      return;
                                    }

                                    markHomeworkMaterialOpened(assignmentMember.id, "document");
                                    openHomeworkSupportingDocument(supportingDocumentId);
                                  }}
                                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08]"
                                >
                                  Open Document
                                </button>
                              ) : null}

                              {assignment.external_video_url ? (
                                <button
                                  type="button"
                                  onClick={() => openHomeworkVideo(assignmentMember.id, assignment.external_video_url || "")}
                                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08]"
                                >
                                  Open Video
                                </button>
                              ) : null}

                              {assignment.external_audio_url ? (
                                <button
                                  type="button"
                                  onClick={() => openHomeworkAudio(assignmentMember.id, assignment.external_audio_url || "")}
                                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08]"
                                >
                                  Open Audio
                                </button>
                              ) : null}
                            </div>

                            {!materialGate.canSubmit ? (
                              <p className="mt-3 text-xs text-amber-200">
                                Open all assigned training materials before submitting.
                              </p>
                            ) : null}

                            {!hasTrainingMaterial ? (
                              <p className="mt-3 text-xs text-neutral-400">
                                {requiresReview
                                  ? "This assignment is instructions-only. Review the assignment details, then submit for review."
                                  : "This assignment is instructions-only. Review the assignment details, then complete training."}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {hasOpenedTraining && !isPendingReview ? (
                          <>
                            <label className="mt-3 block">
                              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Completion Notes</span>
                              <textarea
                                rows={3}
                                value={homeworkCompletionNotesByMemberId[assignmentMember.id] ?? assignmentMember.completion_notes ?? ""}
                                onChange={(event) =>
                                  setHomeworkCompletionNotesByMemberId((current) => ({
                                    ...current,
                                    [assignmentMember.id]: event.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                              />
                            </label>

                            <label className="mt-3 block">
                              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Evidence (Optional)</span>
                              <input
                                ref={(input) => {
                                  homeworkEvidenceInputRefs.current.set(assignmentMember.id, input);
                                }}
                                type="file"
                                onChange={(event) =>
                                  setHomeworkEvidenceFileByMemberId((current) => ({
                                    ...current,
                                    [assignmentMember.id]: (event.target.files ?? [])[0] ?? null,
                                  }))
                                }
                                className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-red-500"
                              />
                            </label>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {canUseCompletedTogether ? (
                                <button
                                  type="button"
                                  onClick={() => openCompletedTogetherDialog(assignmentMember)}
                                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-100 transition hover:bg-white/[0.08]"
                                >
                                  Completed Together / Add Others
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={isSubmitting || !materialGate.canSubmit}
                                  onClick={() => {
                                    if (requiresReview) {
                                      requestHomeworkSubmission(assignmentMember);
                                      return;
                                    }

                                    requestHomeworkCompletion(assignmentMember);
                                  }}
                                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSubmitting ? "Submitting..." : requiresReview ? "Submit for Review" : "Complete Training"}
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm font-semibold text-emerald-300">
                        Complete • {formatHours(assignmentMember.hours_earned ?? assignment.hours_credit ?? null)} hrs
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {activeCategories.length === 0 ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            Your department has no active training categories yet. Contact an administrator before submitting self-reported training.
          </div>
        ) : null}

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-2xl font-semibold text-white">Submit Training</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Required: title, category, date completed, and hours. Optional proof can be uploaded now or provided later.
          </p>

          {outsideSaveError ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {outsideSaveError}
            </div>
          ) : null}

          {outsideSuccessMessage ? (
            <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
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
                <select
                  value={outsideFormState.trainingMethod}
                  onChange={(event) => setOutsideFormState((current) => ({ ...current, trainingMethod: event.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                >
                  <option value="">Select method</option>
                  {TRAINING_METHOD_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Type of Training</span>
                <select
                  value={outsideFormState.trainingKind}
                  onChange={(event) =>
                    setOutsideFormState((current) => ({
                      ...current,
                      trainingKind: event.target.value === "ems" ? "ems" : "general",
                      emsNeedsReview: event.target.value === "ems" ? current.emsNeedsReview : false,
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                >
                  <option value="general">General</option>
                  <option value="ems">EMS</option>
                </select>
              </label>

              {outsideFormState.trainingKind === "ems" ? (
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

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSavingOutside || activeCategories.length === 0}
                className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-neutral-400"
              >
                {isSavingOutside ? "Submitting..." : "Submit Training"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-2xl font-semibold text-white">My Self-Reported Training</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Pending and rejected submissions do not count toward official training until approved.
          </p>

          {myOutsideSubmissions.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
              No self-reported training submissions yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {myOutsideSubmissions.map((submission) => {
                const evidenceCount = outsideEvidenceCountBySubmissionId.get(submission.id) ?? 0;
                const metadata = extractOutsideMetadata(submission.notes);
                return (
                  <div key={submission.id} className="rounded-xl border border-white/10 bg-[#141414] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{submission.title}</p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {getCategoryNameById(categories, submission.category_id)}
                        </p>
                      </div>

                      <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.14em] ${outsideStatusStyles(submission.status)}`}>
                        {submission.status.replaceAll("_", " ")}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-1 text-sm text-neutral-300 md:grid-cols-2">
                      <p>Date: {formatDateOnly(submission.training_date)}</p>
                      <p>Hours: {formatHours(submission.hours)}</p>
                      <p>Method: {metadata.method || "-"}</p>
                      <p>Instructor: {metadata.instructor || "-"}</p>
                      <p>Location: {metadata.location || "-"}</p>
                      <p>Proof files: {evidenceCount}</p>
                    </div>

                    {submission.description?.trim() ? (
                      <p className="mt-3 text-sm text-neutral-300">{submission.description.trim()}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {homeworkCompletionConfirmModal}
        {homeworkReviewConfirmModal}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">
            Training
          </p>
          <h1
          className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
          style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            Training Workspace
          </h1>
          <p className="mt-2 max-w-3xl text-neutral-400">
            Create and manage department training events, view attendance progress, and handle operational training reviews.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openHomeworkModal}
            disabled={!canAssignHomework || activeCategories.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:border-amber-400 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-neutral-400"
          >
            <Plus className="h-4 w-4" />
            Assign Training
          </button>
          <button
            type="button"
            onClick={openModal}
            disabled={!canManageTraining || activeCategories.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-neutral-400"
          >
            <Plus className="h-4 w-4" />
            Add Training
          </button>
        </div>
      </div>

      {successMessage ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {successMessage}
        </div>
      ) : null}

      {homeworkSuccessMessage ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {homeworkSuccessMessage}
        </div>
      ) : null}

      {homeworkSaveError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {homeworkSaveError}
        </div>
      ) : null}

      {activeCategories.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          Training categories are required before creating events. Configure active training categories in Settings.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Your Training This Year</p>
          <p className="mt-2 text-3xl font-black text-white">{trainingHoursThisYear.toFixed(2)}</p>
          <p className="mt-1 text-xs text-neutral-500">Hours</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Training Events</p>
          <p className="mt-2 text-3xl font-black text-white">{eventRows.length}</p>
          <p className="mt-1 text-xs text-neutral-500">Department total</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Members Trained</p>
          <p className="mt-2 text-3xl font-black text-white">{membersTrainedCount}</p>
          <p className="mt-1 text-xs text-neutral-500">Distinct members marked attended</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Pending Reviews</p>
          <p className="mt-2 text-3xl font-black text-white">{pendingReviews}</p>
          <p className="mt-1 text-xs text-neutral-500">Outside + assignments + attendance</p>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-800 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Pending Training Reviews</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Review submitted firefighter assigned training and approve completion credit.
            </p>
          </div>
          <p className="rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-xs uppercase tracking-[0.14em] text-neutral-300">
            {pendingAssignmentReviews.length} pending
          </p>
        </div>

        {homeworkReviewError ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {homeworkReviewError}
          </div>
        ) : null}

        {homeworkReviewSuccessMessage ? (
          <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            {homeworkReviewSuccessMessage}
          </div>
        ) : null}

        {pendingAssignmentReviews.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 px-4 py-6 text-center text-sm text-neutral-400">
            No pending training submissions.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {pendingAssignmentReviews.map((assignmentMember) => {
              const assignment = assignmentById.get(assignmentMember.training_assignment_id);
              if (!assignment) {
                return null;
              }

              const firefighterName = departmentMemberNameById.get(assignmentMember.member_id) ?? "Unknown Member";
              const evidenceFiles = assignmentEvidenceByMemberRowId.get(assignmentMember.id) ?? [];
              const isReviewing = reviewingAssignmentMemberId === assignmentMember.id;
              const currentReviewNote =
                homeworkReviewNotesByMemberId[assignmentMember.id] ?? assignmentMember.review_notes ?? "";

              return (
                <div key={assignmentMember.id} className="rounded-xl border border-white/10 bg-[#141414] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{assignment.title}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {firefighterName} • {getCategoryNameById(categories, assignment.category_id)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.14em] ${homeworkStatusStyles(assignmentMember.completion_status)}`}>
                      {normalizeHomeworkStatusLabel(assignmentMember.completion_status)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-1 text-sm text-neutral-300 md:grid-cols-2">
                    <p>Hours Credit: {formatHours(assignment.hours_credit)}</p>
                    <p>Due: {formatDateOnly(assignmentMember.due_at ?? assignment.due_at ?? "")}</p>
                  </div>

                  {assignmentMember.completion_notes?.trim() ? (
                    <p className="mt-3 text-sm text-neutral-300">{assignmentMember.completion_notes.trim()}</p>
                  ) : null}

                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Review Notes</span>
                    <textarea
                      rows={3}
                      value={currentReviewNote}
                      onChange={(event) =>
                        setHomeworkReviewNotesByMemberId((current) => ({
                          ...current,
                          [assignmentMember.id]: event.target.value,
                        }))
                      }
                      placeholder="Provide feedback when rejecting or context when approving."
                      className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-green-500/50 focus:outline-none"
                    />
                  </label>

                  {evidenceFiles.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-white/10 bg-[#101010] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Evidence</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {evidenceFiles.map((file) => (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => openHomeworkEvidence(file.file_path)}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.08]"
                          >
                            {file.file_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isReviewing}
                      onClick={() => reviewHomeworkSubmission(assignmentMember.id, "approved", currentReviewNote)}
                      className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-green-200 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={isReviewing}
                      onClick={() => reviewHomeworkSubmission(assignmentMember.id, "rejected", currentReviewNote)}
                      className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-800 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Assigned Training</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Assigned training lives in assignment records and contributes training credit after approval.
            </p>
          </div>
          <p className="rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-xs uppercase tracking-[0.14em] text-neutral-300">
            {sortedAssignments.length} assignments
          </p>
        </div>

        {sortedAssignments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 px-4 py-6 text-center text-sm text-neutral-400">
            No assigned training yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedAssignments.map((assignment) => {
              const memberRows = assignmentMembersByAssignmentId.get(assignment.id) ?? [];
              const completedCount = memberRows.filter((row) => row.completion_status === "approved").length;
              const pendingCount = memberRows.filter((row) => row.completion_status === "pending_review" || row.completion_status === "submitted").length;

              return (
                <div key={assignment.id} className="rounded-xl border border-white/10 bg-[#141414] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{assignment.title}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {getCategoryNameById(categories, assignment.category_id)}
                        {assignment.hours_credit !== null ? ` • ${formatHours(assignment.hours_credit)} hrs` : ""}
                        {assignment.due_at ? ` • Due ${formatDateOnly(assignment.due_at)}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.14em] ${assignment.is_required ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-white/10 bg-white/[0.04] text-neutral-300"}`}>
                      {assignment.is_required ? "Required" : "Optional"}
                    </span>
                  </div>

                  {assignment.description?.trim() ? (
                    <p className="mt-3 text-sm text-neutral-300">{assignment.description.trim()}</p>
                  ) : null}

                  <div className="mt-3 grid gap-1 text-sm text-neutral-300 md:grid-cols-3">
                    <p>Assigned: {memberRows.length}</p>
                    <p>Complete: {completedCount}</p>
                    <p>Pending Review: {pendingCount}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-800 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Pending Self-Reported Training Reviews</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Approve or reject firefighter self-reported training submissions.
            </p>
          </div>
          <p className="rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-xs uppercase tracking-[0.14em] text-neutral-300">
            {pendingOutsideSubmissions.length} pending
          </p>
        </div>

        {reviewError ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {reviewError}
          </div>
        ) : null}

        {reviewSuccessMessage ? (
          <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            {reviewSuccessMessage}
          </div>
        ) : null}

        {pendingOutsideSubmissions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 px-4 py-6 text-center text-sm text-neutral-400">
            No pending self-reported training submissions.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {pendingOutsideSubmissions.map((submission) => {
              const submitterName = departmentMemberNameById.get(submission.member_id) ?? "Unknown Member";
              const evidenceCount = outsideEvidenceCountBySubmissionId.get(submission.id) ?? 0;
              const evidenceFiles = outsideEvidenceBySubmissionId.get(submission.id) ?? [];
              const metadata = extractOutsideMetadata(submission.notes);
              const isReviewing = reviewingSubmissionId === submission.id;

              return (
                <div key={submission.id} className="rounded-xl border border-white/10 bg-[#141414] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{submission.title}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {submitterName} • {getCategoryNameById(categories, submission.category_id)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.14em] ${outsideStatusStyles(submission.status)}`}>
                      {submission.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-1 text-sm text-neutral-300 md:grid-cols-2">
                    <p>Date: {formatDateOnly(submission.training_date)}</p>
                    <p>Hours: {formatHours(submission.hours)}</p>
                    <p>Method: {metadata.method || "-"}</p>
                    <p>Instructor: {metadata.instructor || "-"}</p>
                    <p>Location: {metadata.location || "-"}</p>
                    <p>Proof files: {evidenceCount}</p>
                  </div>

                  {submission.description?.trim() ? (
                    <p className="mt-3 text-sm text-neutral-300">{submission.description.trim()}</p>
                  ) : null}

                  {evidenceFiles.length > 0 ? (
                    <div className="mt-4 rounded-lg border border-white/10 bg-[#101010] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                        Supporting Proof
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {evidenceFiles.map((file) => (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => openOutsideEvidence(file.file_path)}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.08]"
                          >
                            {file.file_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isReviewing}
                      onClick={() => reviewOutsideSubmission(submission.id, "approved")}
                      className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-green-200 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={isReviewing}
                      onClick={() => reviewOutsideSubmission(submission.id, "rejected")}
                      className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {sortedEvents.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-neutral-700 bg-neutral-900 px-6 py-10 text-center">
          <p className="text-lg font-semibold text-white">No training events yet.</p>
          <p className="mt-2 text-sm text-neutral-400">
            Start by creating the first department training event.
          </p>
          <button
            type="button"
            onClick={openModal}
            disabled={!canManageTraining || activeCategories.length === 0}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-neutral-400"
          >
            <Plus className="h-4 w-4" />
            Add Training
          </button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-neutral-800 bg-[#111111]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Training</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Date/Time</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Hours</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Instructor</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Location</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Attendance</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((trainingEvent) => {
                  const attendance = attendanceByEventId.get(trainingEvent.id) ?? { attended: 0, completed: 0 };
                  return (
                    <tr key={trainingEvent.id} className="border-b border-neutral-800 transition hover:bg-neutral-800/40">
                      <td className="px-4 py-3">
                        <Link href={`/training/${trainingEvent.id}`} className="font-semibold text-white hover:text-red-300">
                          {trainingEvent.title}
                        </Link>
                        <p className="mt-1 text-xs text-neutral-400">{trainingEvent.topic || trainingEvent.training_type || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-200">
                        {getCategoryNameById(categories, trainingEvent.category_id)}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{formatDateTime(trainingEvent.starts_at)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{formatHours(trainingEvent.hours_credit)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{trainingEvent.instructor_name || "-"}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{trainingEvent.location || "-"}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">
                        {attendance.attended} attended / {attendance.completed} completed
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-neutral-200">
                          {trainingEvent.status.replaceAll("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {sortedEvents.map((trainingEvent) => {
              const attendance = attendanceByEventId.get(trainingEvent.id) ?? { attended: 0, completed: 0 };
              return (
                <Link
                  key={trainingEvent.id}
                  href={`/training/${trainingEvent.id}`}
                  className="block rounded-xl border border-white/10 bg-[#151515] p-4 transition hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-white">{trainingEvent.title}</h3>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-neutral-200">
                      {trainingEvent.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-neutral-400">{getCategoryNameById(categories, trainingEvent.category_id)}</p>

                  <div className="mt-3 space-y-1 text-sm text-neutral-300">
                    <div className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-neutral-500" />
                      {formatDateTime(trainingEvent.starts_at)}
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-neutral-500" />
                      {formatHours(trainingEvent.hours_credit)} hrs
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-neutral-500" />
                      {trainingEvent.instructor_name || "No instructor"}
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-neutral-500" />
                      {trainingEvent.location || "No location"}
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-neutral-400">
                    {attendance.attended} attended / {attendance.completed} completed
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {isHomeworkModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-2xl font-black tracking-tight text-white">Assign Training</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Assign real training to one firefighter, multiple firefighters, or department-wide.
              </p>
            </div>

            <form onSubmit={handleCreateHomeworkAssignment} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-6">
                {homeworkSaveError ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {homeworkSaveError}
                  </div>
                ) : null}

                <div className="grid gap-5 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Title *</span>
                  <input
                    value={homeworkFormState.title}
                    onChange={(event) => setHomeworkFormState((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Category *</span>
                  <select
                    value={homeworkFormState.categoryId}
                    onChange={(event) => setHomeworkFormState((current) => ({ ...current, categoryId: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
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
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Due Date</span>
                  <input
                    type="date"
                    value={homeworkFormState.dueDate}
                    onChange={(event) => setHomeworkFormState((current) => ({ ...current, dueDate: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:border-amber-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Hours *</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={homeworkFormState.hoursCredit}
                    onChange={(event) => setHomeworkFormState((current) => ({ ...current, hoursCredit: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  />
                </label>

                <div className="rounded-xl border border-white/10 bg-[#151515] p-4 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-300">Assigned Material</p>
                  <p className="mt-1 text-xs text-neutral-400">Use an existing department document or upload new training material.</p>

                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Existing Department Document</span>
                    <select
                      value={homeworkFormState.supportingDocumentId}
                      onChange={(event) =>
                        setHomeworkFormState((current) => ({ ...current, supportingDocumentId: event.target.value }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                    >
                      <option value="">None</option>
                      {documents.map((document) => (
                        <option key={document.id} value={document.id}>
                          {document.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-neutral-500">Or</p>

                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Upload New Training Material Title (Optional)</span>
                    <input
                      value={homeworkFormState.uploadedMaterialTitle}
                      onChange={(event) =>
                        setHomeworkFormState((current) => ({ ...current, uploadedMaterialTitle: event.target.value }))
                      }
                      placeholder="Defaults to uploaded filename"
                      className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-amber-500/50 focus:outline-none"
                    />
                  </label>

                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Upload New Training Material</span>
                    <input
                      ref={homeworkMaterialInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.rtf,.odt,.odp,.xls,.xlsx"
                      onChange={(event) => setHomeworkMaterialFile((event.target.files ?? [])[0] ?? null)}
                      className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-amber-500"
                    />
                    {homeworkMaterialFile ? (
                      <p className="mt-2 text-xs text-neutral-300">Selected: {homeworkMaterialFile.name}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-neutral-500">
                      Uploaded files are stored using the existing department documents storage and linked to this assigned training item.
                    </p>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Video URL</span>
                  <input
                    value={homeworkFormState.externalVideoUrl}
                    onChange={(event) =>
                      setHomeworkFormState((current) => ({ ...current, externalVideoUrl: event.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Audio URL</span>
                  <input
                    value={homeworkFormState.externalAudioUrl}
                    onChange={(event) =>
                      setHomeworkFormState((current) => ({ ...current, externalAudioUrl: event.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Description / Instructions</span>
                  <textarea
                    rows={4}
                    value={homeworkFormState.description}
                    onChange={(event) => setHomeworkFormState((current) => ({ ...current, description: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  />
                </label>

                <div className="md:col-span-2 grid gap-3 sm:grid-cols-3">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={homeworkFormState.isRequired}
                      onChange={(event) =>
                        setHomeworkFormState((current) => ({ ...current, isRequired: event.target.checked }))
                      }
                    />
                    Required
                  </label>

                  <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={homeworkFormState.reviewRequired}
                      onChange={(event) =>
                        setHomeworkFormState((current) => ({ ...current, reviewRequired: event.target.checked }))
                      }
                    />
                    Review Required
                  </label>

                  <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={homeworkFormState.assignDepartmentWide}
                      onChange={(event) =>
                        setHomeworkFormState((current) => ({ ...current, assignDepartmentWide: event.target.checked }))
                      }
                    />
                    Assign Department-Wide
                  </label>
                </div>

                {!homeworkFormState.assignDepartmentWide ? (
                  <div className="md:col-span-2 rounded-xl border border-white/10 bg-[#151515] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Assign Firefighters</p>
                        <p className="mt-1 text-xs text-neutral-400">{selectedHomeworkMemberIds.size} selected</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllHomeworkMembers}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08]"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={clearAllHomeworkMembers}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08]"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <input
                        type="text"
                        value={homeworkMemberSearch}
                        placeholder="Search firefighters..."
                        onChange={(event) => setHomeworkMemberSearch(event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-amber-500/50 focus:outline-none"
                      />
                    </div>

                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                      {filteredHomeworkMembers.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-950 px-3 py-4 text-center text-xs text-neutral-400">
                          No firefighters found for that search.
                        </div>
                      ) : (
                        filteredHomeworkMembers.map((member) => {
                          const isSelected = selectedHomeworkMemberIds.has(member.id);
                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => toggleHomeworkMemberSelection(member.id)}
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                                isSelected
                                  ? "border-amber-500/30 bg-amber-500/10"
                                  : "border-white/10 bg-[#101010] hover:bg-white/[0.04]"
                              }`}
                            >
                              <span className="text-sm font-medium text-white">{member.full_name}</span>
                              <span className="text-xs uppercase tracking-[0.14em] text-neutral-400">
                                {isSelected ? "Selected" : "Add"}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                    Department-wide assignment will target all active department members.
                  </div>
                )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
                <button
                  type="button"
                  onClick={closeHomeworkModal}
                  className="rounded-xl border border-white/10 bg-[#151515] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d1d1d]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHomework || activeCategories.length === 0}
                  className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:border-amber-400 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-neutral-400"
                >
                  {isSavingHomework ? "Assigning..." : "Assign Training"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
              onWheelCapture={(event) => {
                if (event.target === event.currentTarget) {
                  event.preventDefault();
                }
              }}
              onTouchMoveCapture={(event) => {
                if (event.target === event.currentTarget) {
                  event.preventDefault();
                }
              }}
            >
              <div role="dialog" aria-modal="true" className="flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
                <div className="border-b border-white/10 px-6 py-5">
                  <h3 className="text-2xl font-black tracking-tight text-white">Add Training Event</h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    Create a department-scoped training event using configured categories.
                  </p>
                </div>

                <form onSubmit={handleCreateTraining} className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-6">
                    {saveError ? (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {saveError}
                      </div>
                    ) : null}

                    <div className="grid gap-5 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Title *</span>
                      <input
                        value={formState.title}
                        onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                      />
                    </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Category *</span>
                  <select
                    value={formState.categoryId}
                    onChange={(event) => setFormState((current) => ({ ...current, categoryId: event.target.value }))}
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
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Method</span>
                  <select
                    value={formState.trainingMethod}
                    onChange={(event) => setFormState((current) => ({ ...current, trainingMethod: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  >
                    <option value="">Select method</option>
                    {TRAINING_METHOD_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                {isEmsCategoryName(activeCategories.find((category) => category.id === formState.categoryId)?.name) ? (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">EMS Core Topic</span>
                      <select
                        value={formState.emsCoreTopic}
                        onChange={(event) => setFormState((current) => ({ ...current, emsCoreTopic: event.target.value as EmsCoreTopicCode }))}
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
                        value={formState.emsCourseDefinitionId}
                        onChange={(event) => setFormState((current) => ({ ...current, emsCourseDefinitionId: event.target.value }))}
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
                        value={formState.emsProviderName}
                        onChange={(event) => setFormState((current) => ({ ...current, emsProviderName: event.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                      />
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={formState.emsNeedsReview}
                        onChange={(event) => setFormState((current) => ({ ...current, emsNeedsReview: event.target.checked }))}
                      />
                      Mark as NEEDS REVIEW
                    </label>
                  </>
                ) : null}

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Date *</span>
                  <input
                    type="date"
                    value={formState.date}
                    onChange={(event) => setFormState((current) => ({ ...current, date: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Start Time (24h) *</span>
                  <select
                    value={formState.startTime}
                    onChange={(event) => setFormState((current) => ({ ...current, startTime: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  >
                    <option value="">Select time</option>
                    {MILITARY_TIME_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Hours *</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={formState.hoursCredit}
                    onChange={(event) => setFormState((current) => ({ ...current, hoursCredit: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Instructor</span>
                  <input
                    value={formState.instructorName}
                    onChange={(event) => setFormState((current) => ({ ...current, instructorName: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Location</span>
                  <input
                    value={formState.location}
                    onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Details / Notes</span>
                  <textarea
                    rows={4}
                    value={formState.details}
                    onChange={(event) => setFormState((current) => ({ ...current, details: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <div className="md:col-span-2 rounded-xl border border-white/10 bg-[#151515] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Attendance / Add Members</p>
                      <p className="mt-1 text-xs text-neutral-400">{selectedMemberIds.size} members selected</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllMembers}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08]"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearAllMembers}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08]"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <input
                      type="text"
                      value={memberSearch}
                      placeholder="Search firefighters..."
                      onChange={(event) => setMemberSearch(event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
                    />
                  </div>

                  {selectedMemberIds.size > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {departmentMembers
                        .filter((member) => selectedMemberIds.has(member.id))
                        .map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => toggleMemberSelection(member.id)}
                            className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-200 transition hover:bg-green-500/20"
                          >
                            {member.full_name} ×
                          </button>
                        ))}
                    </div>
                  ) : null}

                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {filteredMembers.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-950 px-3 py-4 text-center text-xs text-neutral-400">
                        No firefighters found for that search.
                      </div>
                    ) : (
                      filteredMembers.map((member) => {
                        const isSelected = selectedMemberIds.has(member.id);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => toggleMemberSelection(member.id)}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                              isSelected
                                ? "border-green-500/30 bg-green-500/10"
                                : "border-white/10 bg-[#101010] hover:bg-white/[0.04]"
                            }`}
                          >
                            <span className="text-sm font-medium text-white">{member.full_name}</span>
                            <span className="text-xs uppercase tracking-[0.14em] text-neutral-400">
                              {isSelected ? "Selected" : "Add"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  </div>
                </div>

                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="rounded-xl border border-white/10 bg-[#151515] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d1d1d]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving || activeCategories.length === 0}
                        className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-neutral-400"
                      >
                        {isSaving ? "Saving..." : "Save Training Event"}
                      </button>
                    </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {homeworkCompletionConfirmModal}
      {homeworkReviewConfirmModal}

      {completedTogetherSourceAssignmentMember ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <h3 className="text-lg font-bold text-white">Completed Together / Add Others</h3>
            <p className="mt-2 text-sm text-neutral-300">
              Did other department members complete this training with you? Select them below. Their completion will be submitted for officer/admin review.
            </p>

            {completedTogetherError ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {completedTogetherError}
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-white/10 bg-[#151515] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Active Department Members</p>
                  <p className="mt-1 text-xs text-neutral-400">{selectedCompletedTogetherMemberIds.size} selected</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllCompletedTogetherMembers}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08]"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearCompletedTogetherMembers}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08]"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <input
                  type="text"
                  value={completedTogetherMemberSearch}
                  placeholder="Search department members..."
                  onChange={(event) => setCompletedTogetherMemberSearch(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
                />
              </div>

              {selectedCompletedTogetherMemberIds.size > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {completedTogetherCandidates
                    .filter((member) => selectedCompletedTogetherMemberIds.has(member.id))
                    .map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleCompletedTogetherMemberSelection(member.id)}
                        className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-200 transition hover:bg-green-500/20"
                      >
                        {member.full_name} ×
                      </button>
                    ))}
                </div>
              ) : null}

              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {filteredCompletedTogetherMembers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-950 px-3 py-4 text-center text-xs text-neutral-400">
                    No members found for that search.
                  </div>
                ) : (
                  filteredCompletedTogetherMembers.map((member) => {
                    const isSelected = selectedCompletedTogetherMemberIds.has(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleCompletedTogetherMemberSelection(member.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                          isSelected
                            ? "border-green-500/30 bg-green-500/10"
                            : "border-white/10 bg-[#101010] hover:bg-white/[0.04]"
                        }`}
                      >
                        <span className="text-sm font-medium text-white">{member.full_name}</span>
                        <span className="text-xs uppercase tracking-[0.14em] text-neutral-400">
                          {isSelected ? "Selected" : "Add"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmittingCompletedTogether}
                onClick={closeCompletedTogetherDialog}
                className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-[#222222] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingCompletedTogether}
                onClick={() => {
                  void submitCompletedTogetherMembers();
                }}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingCompletedTogether ? "Submitting..." : "Submit Completed Together"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}