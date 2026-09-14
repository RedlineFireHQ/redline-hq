"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, MapPin, UserRound } from "lucide-react";
import { EMS_CORE_TOPICS, type EmsCoreTopicCode } from "@/lib/ems/requirements";
import { triggerEmsAllocationRecalculationForMembers } from "@/lib/ems/recalculate-client";
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
};

type TrainingAttendanceRow = {
  id: string;
  training_event_id: string;
  member_id: string;
  attendance_status: string;
  completion_status: string;
  hours_earned: number | null;
  notes: string | null;
};

type DepartmentMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  rank: string | null;
  role: string | null;
  active: boolean | null;
};

type DepartmentDocumentRow = {
  id: string;
  title: string;
  document_number: string | null;
  status: string | null;
};

type EmsCourseDefinitionRow = {
  id: string;
  course_name: string;
  active: boolean;
};

interface TrainingEventDetailWorkspaceProps {
  departmentId: string;
  currentMemberId: string;
  currentMemberRole: CurrentMemberRole;
  canManageTraining: boolean;
  trainingEvent: TrainingEventRow;
  categories: TrainingCategoryRow[];
  documents: DepartmentDocumentRow[];
  emsCourseDefinitions: EmsCourseDefinitionRow[];
  members: DepartmentMemberRow[];
  attendanceRows: TrainingAttendanceRow[];
}

type EventFormState = {
  title: string;
  categoryId: string;
  emsCoreTopic: EmsCoreTopicCode;
  emsCourseDefinitionId: string;
  emsNeedsReview: boolean;
  emsProviderName: string;
  topic: string;
  trainingType: string[];
  date: string;
  startTime: string;
  endTime: string;
  hoursCredit: string;
  instructorName: string;
  location: string;
  description: string;
  status: string;
  supportingDocumentId: string;
};

const MILITARY_TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const totalMinutes = index * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
});

const TRAINING_METHOD_DELIMITER = " | ";
const TRAINING_METHOD_OPTIONS = [
  "Classroom / Discussion",
  "Hands-On",
  "Demonstration",
  "Drill / Scenario",
  "Video / Online",
  "Self-Reported Training",
  "Other",
] as const;

function parseTrainingMethods(value: string | null | undefined): string[] {
  return typeof value === "string"
    ? value.split(TRAINING_METHOD_DELIMITER).map((method) => method.trim()).filter(Boolean)
    : [];
}

function isoToDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function isoToMilitary(value: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${String(parsed.getHours()).padStart(2, "0")}${String(parsed.getMinutes()).padStart(2, "0")}`;
}

function toIsoDateTime(dateKey: string, military: string) {
  return new Date(`${dateKey}T${military.slice(0, 2)}:${military.slice(2, 4)}:00`).toISOString();
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

function getMemberName(member: DepartmentMemberRow) {
  const firstName = typeof member.first_name === "string" ? member.first_name.trim() : "";
  const lastName = typeof member.last_name === "string" ? member.last_name.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "Unknown Member";
}

function normalizeSearchValue(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function isEmsCategoryName(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase() === "ems";
}

function initialFormState(trainingEvent: TrainingEventRow): EventFormState {
  return {
    title: trainingEvent.title,
    categoryId: trainingEvent.category_id ?? "",
    emsCoreTopic: (trainingEvent.ems_core_topic as EmsCoreTopicCode | null) ?? "other",
    emsCourseDefinitionId: trainingEvent.ems_course_definition_id ?? "",
    emsNeedsReview: trainingEvent.ems_needs_review === true,
    emsProviderName: trainingEvent.ems_provider_name ?? "",
    topic: trainingEvent.topic ?? "",
    trainingType: parseTrainingMethods(trainingEvent.training_type),
    date: isoToDate(trainingEvent.starts_at),
    startTime: isoToMilitary(trainingEvent.starts_at),
    endTime: isoToMilitary(trainingEvent.ends_at),
    hoursCredit:
      typeof trainingEvent.hours_credit === "number" && Number.isFinite(trainingEvent.hours_credit)
        ? trainingEvent.hours_credit.toString()
        : "",
    instructorName: trainingEvent.instructor_name ?? "",
    location: trainingEvent.location ?? "",
    description: trainingEvent.description ?? "",
    status: trainingEvent.status,
    supportingDocumentId: trainingEvent.supporting_document_id ?? "",
  };
}

export default function TrainingEventDetailWorkspace({
  departmentId,
  currentMemberId,
  currentMemberRole,
  canManageTraining,
  trainingEvent,
  categories,
  documents,
  emsCourseDefinitions,
  members,
  attendanceRows,
}: TrainingEventDetailWorkspaceProps) {
  const router = useRouter();
  const [eventState, setEventState] = useState(trainingEvent);
  const [formState, setFormState] = useState<EventFormState>(initialFormState(trainingEvent));
  const [attendanceState, setAttendanceState] = useState(attendanceRows);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventSuccess, setEventSuccess] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceSavingMemberId, setAttendanceSavingMemberId] = useState<string | null>(null);
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [isBulkAttendanceSaving, setIsBulkAttendanceSaving] = useState(false);

  const canManage = canManageTraining;

  const categoryLookup = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const activeEmsCourseDefinitions = useMemo(
    () => emsCourseDefinitions.filter((course) => course.active).sort((a, b) => a.course_name.localeCompare(b.course_name)),
    [emsCourseDefinitions],
  );

  const categoryOptions = useMemo(() => {
    const active = categories.filter((category) => category.active);
    if (eventState.category_id) {
      const current = categoryLookup.get(eventState.category_id);
      if (current && !active.some((category) => category.id === current.id)) {
        return [...active, current];
      }
    }
    return active;
  }, [categories, categoryLookup, eventState.category_id]);

  const attendanceByMemberId = useMemo(() => {
    const map = new Map<string, TrainingAttendanceRow>();
    for (const row of attendanceState) {
      map.set(row.member_id, row);
    }
    return map;
  }, [attendanceState]);

  const attendedCount = useMemo(
    () => attendanceState.filter((row) => row.attendance_status === "attending").length,
    [attendanceState],
  );

  const absentCount = useMemo(
    () => attendanceState.filter((row) => row.attendance_status === "absent").length,
    [attendanceState],
  );

  const membersById = useMemo(() => {
    const map = new Map<string, DepartmentMemberRow>();
    for (const member of members) {
      map.set(member.id, member);
    }
    return map;
  }, [members]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((left, right) => {
      const leftLast = (left.last_name ?? "").toLowerCase();
      const rightLast = (right.last_name ?? "").toLowerCase();
      if (leftLast !== rightLast) {
        return leftLast.localeCompare(rightLast);
      }

      const leftFirst = (left.first_name ?? "").toLowerCase();
      const rightFirst = (right.first_name ?? "").toLowerCase();
      return leftFirst.localeCompare(rightFirst);
    });
  }, [members]);

  const filteredMembers = useMemo(() => {
    const query = normalizeSearchValue(attendanceSearch);
    if (!query) {
      return sortedMembers;
    }

    return sortedMembers.filter((member) => {
      const first = normalizeSearchValue(member.first_name ?? "");
      const last = normalizeSearchValue(member.last_name ?? "");
      const full = normalizeSearchValue(getMemberName(member));
      return first.includes(query) || last.includes(query) || full.includes(query);
    });
  }, [attendanceSearch, sortedMembers]);

  const attendedMembers = useMemo(() => {
    return sortedMembers.filter((member) => {
      const row = attendanceByMemberId.get(member.id);
      return row?.attendance_status === "attending";
    });
  }, [attendanceByMemberId, sortedMembers]);

  async function handleSaveEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      setEventError("You do not have permission to edit this training event.");
      return;
    }

    const title = formState.title.trim();
    const topic = formState.topic.trim();
    const trainingType = formState.trainingType.join(TRAINING_METHOD_DELIMITER);
    const emsProviderName = formState.emsProviderName.trim();
    const instructorName = formState.instructorName.trim();
    const location = formState.location.trim();
    const description = formState.description.trim();

    if (!title) {
      setEventError("Training title is required.");
      return;
    }

    if (!formState.categoryId) {
      setEventError("Category is required.");
      return;
    }

    const selectedCategory = categoryLookup.get(formState.categoryId);
    const isEmsTraining = isEmsCategoryName(selectedCategory?.name);
    const emsCoreTopic = isEmsTraining ? formState.emsCoreTopic : null;
    const emsCourseDefinitionId = isEmsTraining ? (formState.emsCourseDefinitionId || null) : null;
    const emsNeedsReview = isEmsTraining && (formState.emsNeedsReview || formState.emsCoreTopic === "other");

    if (!formState.date) {
      setEventError("Date is required.");
      return;
    }

    if (!formState.startTime) {
      setEventError("Start time is required.");
      return;
    }

    const startMinutes = minutesFromMilitary(formState.startTime);
    if (startMinutes === null) {
      setEventError("Start time is invalid.");
      return;
    }

    let endMinutes: number | null = null;
    if (formState.endTime) {
      endMinutes = minutesFromMilitary(formState.endTime);
      if (endMinutes === null) {
        setEventError("End time is invalid.");
        return;
      }

      if (endMinutes < startMinutes) {
        setEventError("End time must be after start time.");
        return;
      }
    }

    if (!formState.hoursCredit.trim()) {
      setEventError("Training hours are required.");
      return;
    }

    const hoursCredit = Number.parseFloat(formState.hoursCredit);
    if (!Number.isFinite(hoursCredit) || hoursCredit < 0) {
      setEventError("Training hours must be a valid positive number.");
      return;
    }

    const startsAt = toIsoDateTime(formState.date, formState.startTime);
    const endsAt = formState.endTime ? toIsoDateTime(formState.date, formState.endTime) : null;
    const durationMinutes = endMinutes !== null ? endMinutes - startMinutes : null;

    setIsSavingEvent(true);
    setEventError(null);
    setEventSuccess(null);

    try {
      const { data, error } = await supabase
        .from("training_events")
        .update({
          title,
          category_id: formState.categoryId,
          topic: isEmsTraining ? emsCoreTopic : topic || null,
          training_type: trainingType || null,
          is_ems_training: isEmsTraining,
          ems_core_topic: emsCoreTopic,
          ems_course_definition_id: emsCourseDefinitionId,
          ems_needs_review: emsNeedsReview,
          ems_provider_name: emsProviderName || instructorName || null,
          description: description || null,
          location: location || null,
          instructor_name: instructorName || null,
          starts_at: startsAt,
          ends_at: endsAt,
          duration_minutes: durationMinutes,
          hours_credit: hoursCredit,
          status: formState.status,
          supporting_document_id: formState.supportingDocumentId || null,
          updated_by: currentMemberId,
        })
        .eq("id", eventState.id)
        .eq("department_id", departmentId)
        .select(
          "id, title, category_id, topic, training_type, is_ems_training, ems_core_topic, ems_course_definition_id, ems_needs_review, ems_provider_name, description, location, instructor_name, starts_at, ends_at, duration_minutes, hours_credit, status, supporting_document_id",
        )
        .single();

      if (error || !data) {
        setEventError(error?.message || "Unable to save training event changes.");
        setIsSavingEvent(false);
        return;
      }

      const updatedEvent: TrainingEventRow = {
        id: String(data.id),
        title: typeof data.title === "string" ? data.title : title,
        category_id: typeof data.category_id === "string" ? data.category_id : formState.categoryId,
        topic: typeof data.topic === "string" ? data.topic : topic || null,
        training_type: typeof data.training_type === "string" ? data.training_type : trainingType || null,
        is_ems_training: data.is_ems_training === true,
        ems_core_topic: typeof data.ems_core_topic === "string" ? data.ems_core_topic : emsCoreTopic,
        ems_course_definition_id:
          typeof data.ems_course_definition_id === "string" ? data.ems_course_definition_id : emsCourseDefinitionId,
        ems_needs_review: data.ems_needs_review === true,
        ems_provider_name: typeof data.ems_provider_name === "string" ? data.ems_provider_name : emsProviderName || instructorName || null,
        description: typeof data.description === "string" ? data.description : description || null,
        location: typeof data.location === "string" ? data.location : location || null,
        instructor_name: typeof data.instructor_name === "string" ? data.instructor_name : instructorName || null,
        starts_at: typeof data.starts_at === "string" ? data.starts_at : startsAt,
        ends_at: typeof data.ends_at === "string" ? data.ends_at : endsAt,
        duration_minutes:
          typeof data.duration_minutes === "number" && Number.isFinite(data.duration_minutes)
            ? data.duration_minutes
            : durationMinutes,
        hours_credit:
          typeof data.hours_credit === "number" && Number.isFinite(data.hours_credit)
            ? data.hours_credit
            : hoursCredit,
        status: typeof data.status === "string" ? data.status : formState.status,
        supporting_document_id:
          typeof data.supporting_document_id === "string"
            ? data.supporting_document_id
            : formState.supportingDocumentId || null,
      };

      setEventState(updatedEvent);
      setFormState(initialFormState(updatedEvent));
      setEventSuccess("Training event updated.");
      await triggerEmsAllocationRecalculationForMembers(
        attendanceState
          .filter((row) => row.attendance_status === "attending")
          .map((row) => row.member_id),
      );
      router.refresh();
    } catch (error) {
      setEventError(error instanceof Error ? error.message : "Unable to save training event changes.");
    } finally {
      setIsSavingEvent(false);
    }
  }

  async function addAttended(memberId: string) {
    if (!canManage) {
      setAttendanceError("You do not have permission to manage attendance.");
      return;
    }

    setAttendanceSavingMemberId(memberId);
    setAttendanceError(null);

    try {
      const { data, error } = await supabase
        .from("training_event_attendance")
        .upsert(
          {
            department_id: departmentId,
            training_event_id: eventState.id,
            member_id: memberId,
            attendance_status: "attending",
            completion_status: "not_completed",
            recorded_by: currentMemberId,
          },
          {
            onConflict: "department_id,training_event_id,member_id",
          },
        )
        .select("id, training_event_id, member_id, attendance_status, completion_status, hours_earned, notes")
        .single();

      if (error || !data) {
        setAttendanceError(error?.message || "Unable to save attendance.");
        setAttendanceSavingMemberId(null);
        return;
      }

      const upserted: TrainingAttendanceRow = {
        id: String(data.id),
        training_event_id: typeof data.training_event_id === "string" ? data.training_event_id : eventState.id,
        member_id: typeof data.member_id === "string" ? data.member_id : memberId,
        attendance_status: typeof data.attendance_status === "string" ? data.attendance_status : "attending",
        completion_status: typeof data.completion_status === "string" ? data.completion_status : "not_completed",
        hours_earned: typeof data.hours_earned === "number" && Number.isFinite(data.hours_earned) ? data.hours_earned : null,
        notes: typeof data.notes === "string" ? data.notes : null,
      };

      setAttendanceState((current) => {
        const existingIndex = current.findIndex((row) => row.id === upserted.id);
        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = upserted;
          return next;
        }

        const duplicateByMember = current.findIndex((row) => row.member_id === upserted.member_id);
        if (duplicateByMember >= 0) {
          const next = [...current];
          next[duplicateByMember] = upserted;
          return next;
        }

        return [...current, upserted];
      });

      await triggerEmsAllocationRecalculationForMembers([memberId]);

      router.refresh();
    } catch (error) {
      setAttendanceError(error instanceof Error ? error.message : "Unable to save attendance.");
    } finally {
      setAttendanceSavingMemberId(null);
    }
  }

  async function removeAttended(memberId: string) {
    if (!canManage) {
      setAttendanceError("You do not have permission to manage attendance.");
      return;
    }

    const existing = attendanceByMemberId.get(memberId);
    if (!existing) {
      return;
    }

    setAttendanceSavingMemberId(memberId);
    setAttendanceError(null);

    try {
      if (currentMemberRole === "administrator") {
        const { error } = await supabase
          .from("training_event_attendance")
          .delete()
          .eq("id", existing.id)
          .eq("department_id", departmentId);

        if (error) {
          setAttendanceError(error.message || "Unable to remove attendance.");
          setAttendanceSavingMemberId(null);
          return;
        }

        setAttendanceState((current) => current.filter((row) => row.id !== existing.id));
      } else {
        const { data, error } = await supabase
          .from("training_event_attendance")
          .update({
            attendance_status: "absent",
            completion_status: "not_completed",
            recorded_by: currentMemberId,
          })
          .eq("id", existing.id)
          .eq("department_id", departmentId)
          .select("id, training_event_id, member_id, attendance_status, completion_status, hours_earned, notes")
          .single();

        if (error || !data) {
          setAttendanceError(error?.message || "Unable to remove attendance.");
          setAttendanceSavingMemberId(null);
          return;
        }

        const updated: TrainingAttendanceRow = {
          id: String(data.id),
          training_event_id: typeof data.training_event_id === "string" ? data.training_event_id : eventState.id,
          member_id: typeof data.member_id === "string" ? data.member_id : memberId,
          attendance_status: typeof data.attendance_status === "string" ? data.attendance_status : "absent",
          completion_status: typeof data.completion_status === "string" ? data.completion_status : "not_completed",
          hours_earned: typeof data.hours_earned === "number" && Number.isFinite(data.hours_earned) ? data.hours_earned : null,
          notes: typeof data.notes === "string" ? data.notes : null,
        };

        setAttendanceState((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      }

      await triggerEmsAllocationRecalculationForMembers([memberId]);

      router.refresh();
    } catch (error) {
      setAttendanceError(error instanceof Error ? error.message : "Unable to remove attendance.");
    } finally {
      setAttendanceSavingMemberId(null);
    }
  }

  async function selectAllAttended() {
    if (!canManage) {
      setAttendanceError("You do not have permission to manage attendance.");
      return;
    }

    if (members.length === 0) {
      return;
    }

    setIsBulkAttendanceSaving(true);
    setAttendanceError(null);

    try {
      const payload = members.map((member) => ({
        department_id: departmentId,
        training_event_id: eventState.id,
        member_id: member.id,
        attendance_status: "attending",
        completion_status: "not_completed",
        recorded_by: currentMemberId,
      }));

      const { data, error } = await supabase
        .from("training_event_attendance")
        .upsert(payload, {
          onConflict: "department_id,training_event_id,member_id",
        })
        .select("id, training_event_id, member_id, attendance_status, completion_status, hours_earned, notes");

      if (error) {
        setAttendanceError(error.message || "Unable to mark all members attended.");
        setIsBulkAttendanceSaving(false);
        return;
      }

      const upsertedRows: TrainingAttendanceRow[] = (data ?? []).map((row) => ({
        id: String(row.id),
        training_event_id: typeof row.training_event_id === "string" ? row.training_event_id : eventState.id,
        member_id: typeof row.member_id === "string" ? row.member_id : "",
        attendance_status: typeof row.attendance_status === "string" ? row.attendance_status : "attending",
        completion_status: typeof row.completion_status === "string" ? row.completion_status : "not_completed",
        hours_earned: typeof row.hours_earned === "number" && Number.isFinite(row.hours_earned) ? row.hours_earned : null,
        notes: typeof row.notes === "string" ? row.notes : null,
      }));

      setAttendanceState((current) => {
        const nextByMember = new Map<string, TrainingAttendanceRow>();
        for (const row of current) {
          nextByMember.set(row.member_id, row);
        }
        for (const row of upsertedRows) {
          nextByMember.set(row.member_id, row);
        }
        return Array.from(nextByMember.values());
      });

      await triggerEmsAllocationRecalculationForMembers(upsertedRows.map((row) => row.member_id));

      router.refresh();
    } catch (error) {
      setAttendanceError(error instanceof Error ? error.message : "Unable to mark all members attended.");
    } finally {
      setIsBulkAttendanceSaving(false);
    }
  }

  async function clearAllAttended() {
    if (!canManage) {
      setAttendanceError("You do not have permission to manage attendance.");
      return;
    }

    const attendedRows = attendanceState.filter((row) => row.attendance_status === "attending");
    if (attendedRows.length === 0) {
      return;
    }

    setIsBulkAttendanceSaving(true);
    setAttendanceError(null);

    try {
      if (currentMemberRole === "administrator") {
        const removedMemberIds = attendedRows.map((row) => row.member_id);
        const attendedIds = attendedRows.map((row) => row.id);
        const { error } = await supabase
          .from("training_event_attendance")
          .delete()
          .eq("department_id", departmentId)
          .in("id", attendedIds);

        if (error) {
          setAttendanceError(error.message || "Unable to clear attendance.");
          setIsBulkAttendanceSaving(false);
          return;
        }

        setAttendanceState((current) => current.filter((row) => !attendedIds.includes(row.id)));
        await triggerEmsAllocationRecalculationForMembers(removedMemberIds);
      } else {
        const attendedIds = attendedRows.map((row) => row.id);
        const { data, error } = await supabase
          .from("training_event_attendance")
          .update({
            attendance_status: "absent",
            completion_status: "not_completed",
            recorded_by: currentMemberId,
          })
          .eq("department_id", departmentId)
          .in("id", attendedIds)
          .select("id, training_event_id, member_id, attendance_status, completion_status, hours_earned, notes");

        if (error) {
          setAttendanceError(error.message || "Unable to clear attendance.");
          setIsBulkAttendanceSaving(false);
          return;
        }

        const updatedById = new Map(
          (data ?? []).map((row) => [
            String(row.id),
            {
              id: String(row.id),
              training_event_id: typeof row.training_event_id === "string" ? row.training_event_id : eventState.id,
              member_id: typeof row.member_id === "string" ? row.member_id : "",
              attendance_status: typeof row.attendance_status === "string" ? row.attendance_status : "absent",
              completion_status: typeof row.completion_status === "string" ? row.completion_status : "not_completed",
              hours_earned:
                typeof row.hours_earned === "number" && Number.isFinite(row.hours_earned) ? row.hours_earned : null,
              notes: typeof row.notes === "string" ? row.notes : null,
            } as TrainingAttendanceRow,
          ]),
        );

        setAttendanceState((current) =>
          current.map((row) => updatedById.get(row.id) ?? row),
        );

        await triggerEmsAllocationRecalculationForMembers(attendedRows.map((row) => row.member_id));
      }

      router.refresh();
    } catch (error) {
      setAttendanceError(error instanceof Error ? error.message : "Unable to clear attendance.");
    } finally {
      setIsBulkAttendanceSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/training" className="inline-flex items-center gap-2 text-sm font-semibold text-red-300 hover:text-red-200">
            <ArrowLeft className="h-4 w-4" />
            Back to Training
          </Link>
          <h1
            className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
            style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            {eventState.title}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            {categoryLookup.get(eventState.category_id ?? "")?.name || "Uncategorized"} • {formatDateTime(eventState.starts_at)}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
          {attendedCount} attended / {absentCount} absent
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-xl font-semibold text-white">Training Event Details</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-[#141414] px-3 py-3 text-sm text-neutral-300">
            <div className="inline-flex items-center gap-2 text-neutral-400">
              <CalendarDays className="h-4 w-4" /> Date/Time
            </div>
            <p className="mt-2 font-semibold text-white">{formatDateTime(eventState.starts_at)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#141414] px-3 py-3 text-sm text-neutral-300">
            <div className="inline-flex items-center gap-2 text-neutral-400">
              <Clock3 className="h-4 w-4" /> Training Hours
            </div>
            <p className="mt-2 font-semibold text-white">{formatHours(eventState.hours_credit)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#141414] px-3 py-3 text-sm text-neutral-300">
            <div className="inline-flex items-center gap-2 text-neutral-400">
              <UserRound className="h-4 w-4" /> Instructor
            </div>
            <p className="mt-2 font-semibold text-white">{eventState.instructor_name || "-"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#141414] px-3 py-3 text-sm text-neutral-300">
            <div className="inline-flex items-center gap-2 text-neutral-400">
              <MapPin className="h-4 w-4" /> Location
            </div>
            <p className="mt-2 font-semibold text-white">{eventState.location || "-"}</p>
          </div>
        </div>

        <form onSubmit={handleSaveEvent} className="mt-5 space-y-5">
          {eventError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {eventError}
            </div>
          ) : null}

          {eventSuccess ? (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              {eventSuccess}
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
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}{!category.active ? " (Inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Training Method</span>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-[#1b1b1b] p-2">
                {TRAINING_METHOD_OPTIONS.map((option) => (
                  <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-white hover:bg-white/[0.06]">
                    <input
                      type="checkbox"
                      checked={formState.trainingType.includes(option)}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          trainingType: event.target.checked
                            ? [...current.trainingType, option]
                            : current.trainingType.filter((method) => method !== option),
                        }))
                      }
                      className="h-4 w-4 rounded border-white/20 bg-[#111111] accent-red-600"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </label>

            {isEmsCategoryName(categoryLookup.get(formState.categoryId)?.name) ? (
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
            ) : (
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Topic</span>
                <input
                  value={formState.topic}
                  onChange={(event) => setFormState((current) => ({ ...current, topic: event.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Date *</span>
              <input
                type="date"
                value={formState.date}
                onChange={(event) => setFormState((current) => ({ ...current, date: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
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
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">End Time (24h)</span>
              <select
                value={formState.endTime}
                onChange={(event) => setFormState((current) => ({ ...current, endTime: event.target.value }))}
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
                min="0"
                step="0.25"
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

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Status</span>
              <select
                value={formState.status}
                onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="canceled">Canceled</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Supporting Document</span>
              <select
                value={formState.supportingDocumentId}
                onChange={(event) => setFormState((current) => ({ ...current, supportingDocumentId: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
              >
                <option value="">None</option>
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}{document.document_number ? ` (${document.document_number})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Description</span>
              <textarea
                rows={4}
                value={formState.description}
                onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingEvent}
              className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-neutral-400"
            >
              {isSavingEvent ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-xl font-semibold text-white">Attendance</h2>
        <p className="mt-1 text-sm text-neutral-400">
          {attendedCount} members attended
        </p>

        {attendanceError ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {attendanceError}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Search firefighters..."
            value={attendanceSearch}
            onChange={(event) => setAttendanceSearch(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none md:max-w-md"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllAttended}
              disabled={!canManage || isBulkAttendanceSaving || members.length === 0}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAllAttended}
              disabled={!canManage || isBulkAttendanceSaving || attendedCount === 0}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#141414] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">Attended</h3>

          {attendedMembers.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No members marked attended yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {attendedMembers.map((member) => {
                const isSaving = attendanceSavingMemberId === member.id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{getMemberName(member)}</p>
                      <p className="text-xs text-neutral-400">{member.rank?.trim() || "Unassigned"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-200">
                        Attended
                      </span>
                      <button
                        type="button"
                        disabled={!canManage || isSaving || isBulkAttendanceSaving}
                        onClick={() => removeAttended(member.id)}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {members.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-950 px-4 py-6 text-center text-sm text-neutral-400">
              No active department members available for attendance.
            </div>
          ) : (
            filteredMembers.map((member) => {
              const attendance = attendanceByMemberId.get(member.id);
              const isAttended = attendance?.attendance_status === "attending";
              const isSaving = attendanceSavingMemberId === member.id;
              const isBusy = isSaving || isBulkAttendanceSaving;

              return (
                <div key={member.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#141414] px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-white">{getMemberName(member)}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">
                      {member.rank?.trim() || member.role?.trim() || "Firefighter"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy || !canManage || isAttended}
                      onClick={() => addAttended(member.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                        isAttended
                          ? "border-green-500/40 bg-green-500/15 text-green-200"
                          : "border-white/10 bg-white/[0.04] text-neutral-200 hover:bg-white/[0.08]"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {isAttended ? "Attended" : "Mark Attended"}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy || !canManage || !isAttended}
                      onClick={() => removeAttended(member.id)}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}