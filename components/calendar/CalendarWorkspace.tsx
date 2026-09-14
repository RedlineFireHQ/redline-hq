"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type CurrentMemberRole = "firefighter" | "officer" | "administrator";

type CalendarActivityType =
  | "Training"
  | "Apparatus / Operations"
  | "Meeting"
  | "Administrative"
  | "Maintenance"
  | "Drill"
  | "Department Event"
  | "Other";

type CalendarActivityStatus = "Scheduled" | "Completed" | "Canceled";

type CalendarActivity = {
  id: string;
  title: string;
  activityType: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  location: string | null;
  assignedMemberId: string | null;
  assignedMemberName: string | null;
  createdBy: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type MemberOption = {
  id: string;
  name: string;
  role: string;
};

type CalendarWorkspaceProps = {
  currentMember: {
    id: string;
    departmentId: string;
    role: CurrentMemberRole;
    name: string;
  };
  canManageCalendar: boolean;
  initialActivities: CalendarActivity[];
  memberOptions: MemberOption[];
};

type ActivityFormState = {
  title: string;
  activityType: CalendarActivityType;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  assignedMemberId: string;
  description: string;
};

const ACTIVITY_TYPE_OPTIONS: CalendarActivityType[] = [
  "Training",
  "Apparatus / Operations",
  "Meeting",
  "Administrative",
  "Maintenance",
  "Drill",
  "Department Event",
  "Other",
];

const EMPTY_FORM_STATE: ActivityFormState = {
  title: "",
  activityType: "Training",
  date: "",
  startTime: "",
  endTime: "",
  allDay: false,
  location: "",
  assignedMemberId: "",
  description: "",
};

const MILITARY_TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const totalMinutes = index * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function militaryToInputTime(value: string) {
  if (!/^\d{4}$/.test(value)) {
    return "";
  }

  return `${value.slice(0, 2)}:${value.slice(2, 4)}`;
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

function formatTime(dateString: string) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDayHeading(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();
}

function formatActivityDate(dateString: string) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function activityTypeClasses(value: string) {
  switch (value) {
    case "Training":
      return "border-red-500/25 bg-red-500/10 text-red-100";
    case "Meeting":
      return "border-blue-500/25 bg-blue-500/10 text-blue-100";
    case "Maintenance":
      return "border-amber-500/25 bg-amber-500/10 text-amber-100";
    case "Drill":
      return "border-orange-500/25 bg-orange-500/10 text-orange-100";
    case "Department Event":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-100";
    case "Apparatus / Operations":
      return "border-cyan-500/25 bg-cyan-500/10 text-cyan-100";
    case "Administrative":
      return "border-violet-500/25 bg-violet-500/10 text-violet-100";
    default:
      return "border-white/10 bg-white/5 text-neutral-200";
  }
}

function statusClasses(value: string) {
  switch (value) {
    case "Completed":
      return "border-green-500/25 bg-green-500/10 text-green-200";
    case "Canceled":
      return "border-red-500/25 bg-red-500/10 text-red-200";
    default:
      return "border-white/10 bg-white/5 text-neutral-200";
  }
}

function sortActivities(activities: CalendarActivity[]) {
  return [...activities].sort((left, right) => {
    return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
  });
}

function buildFormState(activity: CalendarActivity | null): ActivityFormState {
  if (!activity) {
    return EMPTY_FORM_STATE;
  }

  const startAt = new Date(activity.startAt);
  const endAt = activity.endAt ? new Date(activity.endAt) : null;

  return {
    title: activity.title,
    activityType: ACTIVITY_TYPE_OPTIONS.includes(activity.activityType as CalendarActivityType)
      ? (activity.activityType as CalendarActivityType)
      : "Other",
    date: Number.isNaN(startAt.getTime()) ? "" : toDateKey(startAt),
    startTime: activity.allDay || Number.isNaN(startAt.getTime())
      ? ""
      : `${String(startAt.getHours()).padStart(2, "0")}${String(startAt.getMinutes()).padStart(2, "0")}`,
    endTime:
      activity.allDay || !endAt || Number.isNaN(endAt.getTime())
        ? ""
        : `${String(endAt.getHours()).padStart(2, "0")}${String(endAt.getMinutes()).padStart(2, "0")}`,
    allDay: activity.allDay,
    location: activity.location ?? "",
    assignedMemberId: activity.assignedMemberId ?? "",
    description: activity.description ?? "",
  };
}

function ActivityRow({
  activity,
  isSelected,
  onClick,
}: {
  activity: CalendarActivity;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        isSelected
          ? "border-red-500/50 bg-red-500/10"
          : "border-white/10 bg-[#151515] hover:border-white/20 hover:bg-[#191919]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {activity.allDay ? "All Day" : formatTime(activity.startAt)}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${activityTypeClasses(activity.activityType)}`}>
              {activity.activityType}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black tracking-tight text-white">{activity.title}</h3>
        </div>

        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(activity.status)}`}>
          {activity.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-400">
        {activity.location ? (
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-neutral-500" />
            {activity.location}
          </span>
        ) : null}
        {activity.assignedMemberName ? (
          <span className="inline-flex items-center gap-2">
            <UserRound className="h-4 w-4 text-neutral-500" />
            {activity.assignedMemberName}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ActivityModal({
  isOpen,
  formState,
  isSaving,
  isEditing,
  memberOptions,
  errorMessage,
  onClose,
  onChange,
  onSubmit,
}: {
  isOpen: boolean;
  formState: ActivityFormState;
  isSaving: boolean;
  isEditing: boolean;
  memberOptions: MemberOption[];
  errorMessage: string | null;
  onClose: () => void;
  onChange: (next: ActivityFormState) => void;
  onSubmit: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-white">
              {isEditing ? "Edit Activity" : "Add Activity"}
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              Create a department activity for training, meetings, operations, maintenance, or other scheduled work.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#202020]"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Activity Name *</span>
            <input
              value={formState.title}
              onChange={(event) => onChange({ ...formState, title: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Activity Type *</span>
            <select
              value={formState.activityType}
              onChange={(event) => onChange({ ...formState, activityType: event.target.value as CalendarActivityType })}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              {ACTIVITY_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Date *</span>
            <input
              type="date"
              value={formState.date}
              onChange={(event) => onChange({ ...formState, date: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Start Time</span>
            <select
              value={formState.startTime}
              onChange={(event) => onChange({ ...formState, startTime: event.target.value })}
              disabled={formState.allDay}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              <option value="">Select start time</option>
              {MILITARY_TIME_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">End Time</span>
            <select
              value={formState.endTime}
              onChange={(event) => onChange({ ...formState, endTime: event.target.value })}
              disabled={formState.allDay}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              <option value="">Select end time</option>
              {MILITARY_TIME_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 md:col-span-2">
            <input
              type="checkbox"
              checked={formState.allDay}
              onChange={(event) =>
                onChange({
                  ...formState,
                  allDay: event.target.checked,
                  startTime: event.target.checked ? "" : formState.startTime,
                  endTime: event.target.checked ? "" : formState.endTime,
                })
              }
              className="h-4 w-4 rounded border-white/10 bg-[#111111] text-red-500 focus:ring-red-500"
            />
            <div>
              <p className="text-sm font-semibold text-white">All Day</p>
              <p className="text-xs text-neutral-400">Use this for department events and other date-only activities.</p>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Location</span>
            <input
              value={formState.location}
              onChange={(event) => onChange({ ...formState, location: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Assigned / Responsible Member</span>
            <select
              value={formState.assignedMemberId}
              onChange={(event) => onChange({ ...formState, assignedMemberId: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="">No assignment</option>
              {memberOptions.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Description</span>
            <textarea
              rows={4}
              value={formState.description}
              onChange={(event) => onChange({ ...formState, description: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-[#151515] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d1d1d]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onSubmit}
            className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Create Activity"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarWorkspace({
  currentMember,
  canManageCalendar,
  initialActivities,
  memberOptions,
}: CalendarWorkspaceProps) {
  const canManageActivities = canManageCalendar;

  const [activities, setActivities] = useState<CalendarActivity[]>(sortActivities(initialActivities));
  const [displayMonth, setDisplayMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<ActivityFormState>(EMPTY_FORM_STATE);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  const memberNameById = useMemo(() => {
    return new Map(memberOptions.map((member) => [member.id, member.name]));
  }, [memberOptions]);

  const activitiesByDateKey = useMemo(() => {
    const nextMap = new Map<string, CalendarActivity[]>();

    for (const activity of activities) {
      const parsed = new Date(activity.startAt);
      if (Number.isNaN(parsed.getTime())) {
        continue;
      }

      const key = toDateKey(parsed);
      const existing = nextMap.get(key) ?? [];
      existing.push(activity);
      nextMap.set(key, existing);
    }

    for (const [key, value] of nextMap.entries()) {
      nextMap.set(key, sortActivities(value));
    }

    return nextMap;
  }, [activities]);

  const today = useMemo(() => startOfDay(new Date()), []);

  const todayActivities = useMemo(() => {
    return sortActivities(
      activities.filter((activity) => {
        const parsed = new Date(activity.startAt);
        return !Number.isNaN(parsed.getTime()) && sameDay(parsed, today);
      }),
    );
  }, [activities, today]);

  const upNextActivities = useMemo(() => {
    const afterToday = activities.filter((activity) => {
      const parsed = new Date(activity.startAt);
      return !Number.isNaN(parsed.getTime()) && parsed.getTime() > endOfDay(today).getTime();
    });

    return sortActivities(afterToday).slice(0, 5);
  }, [activities, today]);

  const selectedDateKey = toDateKey(selectedDate);
  const selectedDayActivities = activitiesByDateKey.get(selectedDateKey) ?? [];
  const selectedActivity = selectedDayActivities.find((activity) => activity.id === selectedActivityId) ?? null;

  useEffect(() => {
    if (selectedDayActivities.length === 0) {
      setSelectedActivityId(null);
      return;
    }

    if (!selectedActivityId || !selectedDayActivities.some((activity) => activity.id === selectedActivityId)) {
      setSelectedActivityId(selectedDayActivities[0].id);
    }
  }, [selectedActivityId, selectedDayActivities]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = startOfMonth(displayMonth);
    const gridStart = addDays(firstDayOfMonth, -firstDayOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [displayMonth]);

  function openCreateModal(date?: Date) {
    setEditingActivityId(null);
    setErrorMessage(null);
    setFormState({
      ...EMPTY_FORM_STATE,
      date: date ? toDateKey(date) : toDateKey(selectedDate),
    });
    setIsModalOpen(true);
  }

  function openEditModal(activity: CalendarActivity) {
    setEditingActivityId(activity.id);
    setErrorMessage(null);
    setFormState(buildFormState(activity));
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingActivityId(null);
    setErrorMessage(null);
    setFormState(EMPTY_FORM_STATE);
  }

  async function handleSaveActivity() {
    if (!formState.title.trim()) {
      setErrorMessage("Activity name is required.");
      return;
    }

    if (!formState.date) {
      setErrorMessage("Activity date is required.");
      return;
    }

    if (!formState.allDay && !formState.startTime) {
      setErrorMessage("Start time is required unless this is an all-day activity.");
      return;
    }

    if (!formState.allDay && !formState.endTime) {
      setErrorMessage("End time is required unless this is an all-day activity.");
      return;
    }

    const startMinutes = formState.allDay ? null : minutesFromMilitary(formState.startTime);
    const endMinutes = formState.allDay ? null : minutesFromMilitary(formState.endTime);

    if (!formState.allDay && startMinutes === null) {
      setErrorMessage("Start time must be a valid 24-hour value.");
      return;
    }

    if (!formState.allDay && endMinutes === null) {
      setErrorMessage("End time must be a valid 24-hour value.");
      return;
    }

    if (!formState.allDay && startMinutes !== null && endMinutes !== null && endMinutes < startMinutes) {
      setErrorMessage("End time cannot be earlier than start time.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const startAt = formState.allDay
        ? new Date(`${formState.date}T00:00:00`).toISOString()
        : new Date(`${formState.date}T${militaryToInputTime(formState.startTime)}:00`).toISOString();
      const endAt = formState.allDay
        ? null
        : formState.endTime
          ? new Date(`${formState.date}T${militaryToInputTime(formState.endTime)}:00`).toISOString()
          : null;

      const payload = {
        department_id: currentMember.departmentId,
        title: formState.title.trim(),
        activity_type: formState.activityType,
        description: formState.description.trim() || null,
        start_at: startAt,
        end_at: endAt,
        all_day: formState.allDay,
        location: formState.location.trim() || null,
        assigned_member_id: formState.assignedMemberId || null,
        created_by: currentMember.id,
        status: "Scheduled" satisfies CalendarActivityStatus,
      };

      const query = editingActivityId
        ? supabase
            .from("department_calendar_activities")
            .update(payload)
            .eq("id", editingActivityId)
            .select("id, title, activity_type, description, start_at, end_at, all_day, location, assigned_member_id, created_by, status, created_at, updated_at")
            .single()
        : supabase
            .from("department_calendar_activities")
            .insert(payload)
            .select("id, title, activity_type, description, start_at, end_at, all_day, location, assigned_member_id, created_by, status, created_at, updated_at")
            .single();

      const { data, error } = await query;

      if (error || !data) {
        throw new Error(error?.message || "Unable to save calendar activity.");
      }

      const normalizedActivity: CalendarActivity = {
        id: String(data.id),
        title: typeof data.title === "string" ? data.title : formState.title.trim(),
        activityType: typeof data.activity_type === "string" ? data.activity_type : formState.activityType,
        description: typeof data.description === "string" ? data.description : null,
        startAt: typeof data.start_at === "string" ? data.start_at : startAt,
        endAt: typeof data.end_at === "string" ? data.end_at : null,
        allDay: Boolean(data.all_day),
        location: typeof data.location === "string" ? data.location : null,
        assignedMemberId: typeof data.assigned_member_id === "string" ? data.assigned_member_id : null,
        assignedMemberName:
          typeof data.assigned_member_id === "string"
            ? memberNameById.get(data.assigned_member_id) ?? null
            : null,
        createdBy: typeof data.created_by === "string" ? data.created_by : currentMember.id,
        status: typeof data.status === "string" ? data.status : "Scheduled",
        createdAt: typeof data.created_at === "string" ? data.created_at : null,
        updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
      };

      setActivities((current) => {
        const next = editingActivityId
          ? current.map((activity) => (activity.id === editingActivityId ? normalizedActivity : activity))
          : [...current, normalizedActivity];

        return sortActivities(next);
      });
      setSelectedDate(startOfDay(new Date(normalizedActivity.startAt)));
      setSelectedActivityId(normalizedActivity.id);
      setDisplayMonth(startOfMonth(new Date(normalizedActivity.startAt)));
      closeModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save calendar activity.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteActivity(activity: CalendarActivity) {
    const confirmed = window.confirm(`Delete ${activity.title}?`);
    if (!confirmed) {
      return;
    }

    try {
      const { error } = await supabase
        .from("department_calendar_activities")
        .delete()
        .eq("id", activity.id);

      if (error) {
        throw new Error(error.message || "Unable to delete calendar activity.");
      }

      setActivities((current) => current.filter((entry) => entry.id !== activity.id));
      if (selectedActivityId === activity.id) {
        setSelectedActivityId(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete calendar activity.");
    }
  }

  return (
    <>
      <div className="space-y-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
            Calendar Quick Tab
          </p>
          <h1
            className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
            style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            Calendar
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-neutral-400">
            Track department activities, answer what is happening today, and plan scheduled operations across the month.
          </p>
        </div>

        {canManageActivities ? (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
            >
              <Plus className="h-4 w-4" />
              Add Activity
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-[0_25px_70px_rgba(0,0,0,.35)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#1a1a1a] text-red-400">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">Today&apos;s Activities</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">What is happening today?</h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {todayActivities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-[#151515] px-5 py-8 text-center text-neutral-400">
                  No activities scheduled today.
                </div>
              ) : (
                todayActivities.map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    isSelected={selectedActivityId === activity.id}
                    onClick={() => {
                      setSelectedDate(startOfDay(new Date(activity.startAt)));
                      setSelectedActivityId(activity.id);
                    }}
                  />
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-[0_25px_70px_rgba(0,0,0,.35)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#1a1a1a] text-red-400">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">Up Next</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Coming up after today</h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {upNextActivities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-[#151515] px-5 py-8 text-center text-neutral-400">
                  No upcoming activities scheduled.
                </div>
              ) : (
                upNextActivities.map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => {
                      const nextDate = startOfDay(new Date(activity.startAt));
                      setSelectedDate(nextDate);
                      setDisplayMonth(startOfMonth(nextDate));
                      setSelectedActivityId(activity.id);
                    }}
                    className="flex w-full items-start justify-between gap-4 rounded-2xl border border-white/10 bg-[#151515] px-4 py-4 text-left transition hover:border-white/20 hover:bg-[#191919]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{activity.title}</p>
                      <p className="mt-1 text-sm text-neutral-400">
                        {formatActivityDate(activity.startAt)}{activity.allDay ? " • All Day" : ` • ${formatTime(activity.startAt)}`}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${activityTypeClasses(activity.activityType)}`}>
                      {activity.activityType}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-[0_25px_70px_rgba(0,0,0,.35)]">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">Calendar</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-white">{formatMonthTitle(displayMonth)}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#151515] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1d1d1d]"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextToday = startOfDay(new Date());
                  setDisplayMonth(startOfMonth(nextToday));
                  setSelectedDate(nextToday);
                }}
                className="inline-flex items-center rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#151515] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1d1d1d]"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <div key={label} className="px-2 py-2">{label}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const key = toDateKey(day);
              const dayActivities = activitiesByDateKey.get(key) ?? [];
              const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
              const isToday = sameDay(day, today);
              const isSelected = sameDay(day, selectedDate);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(startOfDay(day))}
                  className={`min-h-[132px] rounded-2xl border p-3 text-left transition ${
                    isSelected
                      ? "border-red-500/50 bg-red-500/10"
                      : "border-white/10 bg-[#151515] hover:border-white/20 hover:bg-[#191919]"
                  } ${isCurrentMonth ? "text-white" : "text-neutral-500"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? "bg-red-500 text-white" : ""}`}>
                      {day.getDate()}
                    </span>
                    {canManageActivities ? (
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          openCreateModal(day);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[#1d1d1d] text-neutral-300 hover:border-red-500/30 hover:text-red-200"
                      >
                        <Plus className="h-4 w-4" />
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    {dayActivities.slice(0, 2).map((activity) => (
                      <div
                        key={activity.id}
                        className={`rounded-xl border px-2.5 py-2 text-xs ${activityTypeClasses(activity.activityType)}`}
                      >
                        <div className="font-semibold">{activity.allDay ? "All Day" : formatTime(activity.startAt)}</div>
                        <div className="mt-1 line-clamp-2 text-white/90">{activity.title}</div>
                      </div>
                    ))}
                    {dayActivities.length > 2 ? (
                      <div className="text-xs font-semibold text-neutral-400">+{dayActivities.length - 2} more</div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-[0_25px_70px_rgba(0,0,0,.35)]">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">Day Details</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{formatDayHeading(selectedDate)}</h2>
            </div>
            {canManageActivities ? (
              <button
                type="button"
                onClick={() => openCreateModal(selectedDate)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#151515] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1d1d1d]"
              >
                <Plus className="h-4 w-4" />
                Add Activity
              </button>
            ) : null}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-3">
              {selectedDayActivities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-[#151515] px-5 py-8 text-center text-neutral-400">
                  No activities scheduled for this day.
                </div>
              ) : (
                selectedDayActivities.map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    isSelected={selectedActivityId === activity.id}
                    onClick={() => setSelectedActivityId(activity.id)}
                  />
                ))
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#151515] p-5">
              {selectedActivity ? (
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${activityTypeClasses(selectedActivity.activityType)}`}>
                          {selectedActivity.activityType}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(selectedActivity.status)}`}>
                          {selectedActivity.status}
                        </span>
                      </div>
                      <h3 className="mt-3 text-2xl font-black tracking-tight text-white">{selectedActivity.title}</h3>
                    </div>

                    {canManageActivities ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(selectedActivity)}
                          className="rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#191919]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteActivity(selectedActivity)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 space-y-4 text-sm text-neutral-300">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-neutral-500" />
                        {selectedActivity.allDay
                          ? "All Day"
                          : `${formatTime(selectedActivity.startAt)}${selectedActivity.endAt ? ` - ${formatTime(selectedActivity.endAt)}` : ""}`}
                      </span>
                      {selectedActivity.location ? (
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-neutral-500" />
                          {selectedActivity.location}
                        </span>
                      ) : null}
                      {selectedActivity.assignedMemberName ? (
                        <span className="inline-flex items-center gap-2">
                          <UserRound className="h-4 w-4 text-neutral-500" />
                          {selectedActivity.assignedMemberName}
                        </span>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#111111] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Details</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-200">
                        {selectedActivity.description?.trim() || "No additional details provided."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center text-center text-neutral-400">
                  Select an activity to view its details.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <ActivityModal
        isOpen={isModalOpen}
        formState={formState}
        isSaving={isSaving}
        isEditing={Boolean(editingActivityId)}
        memberOptions={memberOptions}
        errorMessage={errorMessage}
        onClose={closeModal}
        onChange={setFormState}
        onSubmit={() => void handleSaveActivity()}
      />
    </>
  );
}