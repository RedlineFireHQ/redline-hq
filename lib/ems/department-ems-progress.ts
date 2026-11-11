import { findCurrentTrackProfile, type EmsTrackProfileAuthorityRow } from "@/lib/ems/authoritative-certifications";
import type { EmsReadinessResult } from "@/lib/ems/calculation";
import {
  buildMemberEmsProgress,
  type EmsEventForProgress,
  type EmsOutsideSubmissionForProgress,
  type MemberEmsProgress,
} from "@/lib/ems/member-ems-progress";

// Department-wide EMS Continuing Education progress.
//
// Pure grouping on top of buildMemberEmsProgress — the same calculation used
// by My Readiness and Personnel profiles — so every surface agrees. No second
// calculation system.

export type DepartmentEmsMember = {
  id: string;
  name: string;
};

export type DepartmentEmsTrackProfileRow = EmsTrackProfileAuthorityRow & { member_id: string };

export type DepartmentEmsEventRow = EmsEventForProgress;

export type DepartmentEmsAttendanceRow = {
  member_id: string;
  training_event_id: string;
};

export type DepartmentEmsOutsideRow = EmsOutsideSubmissionForProgress & {
  member_id: string;
  participant_member_ids?: string[];
};

export type DepartmentEmsProgressRow = {
  memberId: string;
  memberName: string;
  hasAnyTracker: boolean;
  iowaProfile: EmsTrackProfileAuthorityRow | null;
  nremtProfile: EmsTrackProfileAuthorityRow | null;
  progress: MemberEmsProgress;
  emsReadiness: EmsReadinessResult;
};

// Credits every submission once per credited member (owner plus participants),
// matching the participant-aware behavior on the Personnel profile.
export function groupEmsRecordsByMember(params: {
  events: DepartmentEmsEventRow[];
  attendance: DepartmentEmsAttendanceRow[];
  outsideSubmissions: DepartmentEmsOutsideRow[];
}) {
  const eventById = new Map(params.events.map((event) => [event.id, event]));

  const eventsByMember = new Map<string, EmsEventForProgress[]>();
  for (const row of params.attendance) {
    const event = eventById.get(row.training_event_id);
    if (!event) {
      continue;
    }

    const list = eventsByMember.get(row.member_id) ?? [];
    list.push(event);
    eventsByMember.set(row.member_id, list);
  }

  const outsideByMember = new Map<string, EmsOutsideSubmissionForProgress[]>();
  for (const submission of params.outsideSubmissions) {
    const creditedMemberIds = new Set<string>([submission.member_id, ...(submission.participant_member_ids ?? [])]);
    for (const memberId of creditedMemberIds) {
      const list = outsideByMember.get(memberId) ?? [];
      list.push(submission);
      outsideByMember.set(memberId, list);
    }
  }

  return { eventsByMember, outsideByMember };
}

export function buildDepartmentEmsProgressRows(params: {
  members: DepartmentEmsMember[];
  trackProfiles: DepartmentEmsTrackProfileRow[];
  events: DepartmentEmsEventRow[];
  attendance: DepartmentEmsAttendanceRow[];
  outsideSubmissions: DepartmentEmsOutsideRow[];
}): DepartmentEmsProgressRow[] {
  const profilesByMember = new Map<string, DepartmentEmsTrackProfileRow[]>();
  for (const profile of params.trackProfiles) {
    const list = profilesByMember.get(profile.member_id) ?? [];
    list.push(profile);
    profilesByMember.set(profile.member_id, list);
  }

  const { eventsByMember, outsideByMember } = groupEmsRecordsByMember(params);

  return params.members.map((member) => {
    const memberProfiles = profilesByMember.get(member.id) ?? [];
    const iowaProfile = findCurrentTrackProfile(memberProfiles, "iowa");
    const nremtProfile = findCurrentTrackProfile(memberProfiles, "nremt");

    const progress = buildMemberEmsProgress({
      iowaProfile,
      nremtProfile,
      events: eventsByMember.get(member.id) ?? [],
      outsideSubmissions: outsideByMember.get(member.id) ?? [],
    });

    return {
      memberId: member.id,
      memberName: member.name,
      hasAnyTracker: iowaProfile !== null || nremtProfile !== null,
      iowaProfile,
      nremtProfile,
      progress,
      emsReadiness: progress.emsReadiness,
    };
  });
}
