import { parseHours } from "@/lib/readiness/member-readiness";

export type HomeworkRole = "firefighter" | "officer" | "administrator" | string | null | undefined;

export type HomeworkAssignmentInput = {
  departmentId: string;
  title: string;
  categoryId: string;
  description: string | null;
  dueAt: string | null;
  hoursCredit: number;
  isRequired: boolean;
  reviewRequired: boolean;
  supportingDocumentId: string | null;
  externalVideoUrl: string | null;
  externalAudioUrl: string | null;
  actorMemberId: string;
};

export type HomeworkMemberAssignmentInput = {
  departmentId: string;
  assignmentId: string;
  memberIds: string[];
  dueAt: string | null;
  actorMemberId: string;
};

export type HomeworkAssignmentMemberLike = {
  id: string;
  member_id: string;
  training_assignment_id: string;
  completion_status: string;
  hours_earned: number | string | null;
  due_at: string | null;
};

export type HomeworkAssignmentLike = {
  id: string;
  title: string;
  category_id: string | null;
  due_at: string | null;
  hours_credit: number | string | null;
  is_required: boolean;
  status: string;
};

export type HomeworkMaterialAssignmentLike = {
  supporting_document_id: string | null;
  external_video_url: string | null;
  external_audio_url: string | null;
};

export type HomeworkMaterialOpenState = {
  document: boolean;
  video: boolean;
  audio: boolean;
};

export function canAssignHomework(role: HomeworkRole) {
  const normalized = (role ?? "").toString().trim().toLowerCase();
  return normalized === "administrator" || normalized === "officer";
}

export function buildHomeworkAssignmentInsert(input: HomeworkAssignmentInput) {
  return {
    department_id: input.departmentId,
    title: input.title,
    category_id: input.categoryId,
    description: input.description,
    due_at: input.dueAt,
    hours_credit: input.hoursCredit,
    is_required: input.isRequired,
    review_required: input.reviewRequired,
    supporting_document_id: input.supportingDocumentId,
    external_video_url: input.externalVideoUrl,
    external_audio_url: input.externalAudioUrl,
    status: "active",
    created_by: input.actorMemberId,
    updated_by: input.actorMemberId,
  };
}

export function buildHomeworkMemberAssignments(input: HomeworkMemberAssignmentInput) {
  const uniqueMemberIds = Array.from(new Set(input.memberIds.filter((id) => id.trim().length > 0)));

  return uniqueMemberIds.map((memberId) => ({
    department_id: input.departmentId,
    training_assignment_id: input.assignmentId,
    member_id: memberId,
    due_at: input.dueAt,
    completion_status: "assigned",
    created_by: input.actorMemberId,
    updated_by: input.actorMemberId,
  }));
}

export function buildCompletedTogetherHomeworkMemberAssignments(input: HomeworkMemberAssignmentInput) {
  const uniqueMemberIds = Array.from(
    new Set(
      input.memberIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0 && id !== input.actorMemberId),
    ),
  );

  return uniqueMemberIds.map((memberId) => ({
    department_id: input.departmentId,
    training_assignment_id: input.assignmentId,
    member_id: memberId,
    due_at: input.dueAt,
    completion_status: "pending_review",
    completion_notes: "Completed together with crew.",
    created_by: input.actorMemberId,
    updated_by: input.actorMemberId,
  }));
}

export function buildHomeworkSubmissionUpdate(completionNotes: string | null) {
  return {
    completion_status: "pending_review",
    completion_notes: completionNotes,
  };
}

export function getHomeworkMaterialGate(input: {
  assignment: HomeworkMaterialAssignmentLike;
  opened: HomeworkMaterialOpenState;
}) {
  const requiredMaterials: Array<{ key: keyof HomeworkMaterialOpenState; label: string }> = [];

  if (input.assignment.supporting_document_id) {
    requiredMaterials.push({ key: "document", label: "document" });
  }

  if (input.assignment.external_video_url) {
    requiredMaterials.push({ key: "video", label: "video" });
  }

  if (input.assignment.external_audio_url) {
    requiredMaterials.push({ key: "audio", label: "audio" });
  }

  const missingRequired = requiredMaterials
    .filter((item) => !input.opened[item.key])
    .map((item) => item.label);

  return {
    canSubmit: missingRequired.length === 0,
    missingRequired,
  };
}

export function calculateApprovedHomeworkHours(input: {
  assignmentMembers: HomeworkAssignmentMemberLike[];
  assignmentById: Map<string, HomeworkAssignmentLike>;
}) {
  const processedMemberRowIds = new Set<string>();
  let totalHours = 0;

  for (const row of input.assignmentMembers) {
    if (processedMemberRowIds.has(row.id)) {
      continue;
    }

    processedMemberRowIds.add(row.id);

    if (row.completion_status !== "approved") {
      continue;
    }

    const assignment = input.assignmentById.get(row.training_assignment_id);
    if (!assignment || assignment.status === "archived") {
      continue;
    }

    const rowHours = parseHours(row.hours_earned);
    const assignmentHours = parseHours(assignment.hours_credit);
    totalHours += rowHours > 0 ? rowHours : assignmentHours;
  }

  return totalHours;
}

export function buildOutstandingRequiredHomework(input: {
  memberId: string;
  assignmentMembers: HomeworkAssignmentMemberLike[];
  assignmentById: Map<string, HomeworkAssignmentLike>;
}) {
  return input.assignmentMembers
    .filter((row) => row.member_id === input.memberId)
    .map((row) => ({
      row,
      assignment: input.assignmentById.get(row.training_assignment_id) ?? null,
    }))
    .filter(({ row, assignment }) => {
      if (!assignment) {
        return false;
      }

      if (assignment.is_required !== true) {
        return false;
      }

      if (assignment.status === "archived") {
        return false;
      }

      return row.completion_status !== "approved";
    });
}
