import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
	Activity,
	AlertTriangle,
	Bell,
	Box,
	ChevronRight,
	ClipboardCheck,
	FileBarChart2,
	FileText,
	Gauge,
	GraduationCap,
	HeartPulse,
	Map as MapIcon,
	Shield,
	Wrench,
} from "lucide-react";
import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
	buildCertificationTypeMetaById,
	type EmsTrackProfileAuthorityRow,
} from "@/lib/ems/authoritative-certifications";
import { parseHours, type RequirementInput } from "@/lib/readiness/member-readiness";
import {
	computeAuthoritativeMemberReadiness,
	getAuthoritativeCoachSummary,
} from "@/lib/readiness/authoritative-member-readiness";
import {
	buildCanonicalMemberCertificationRows,
	type CatalogRow,
	type RoleRequiredCertificationRow,
	type RoleRequiredQualificationRow,
} from "@/lib/role-requirements";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CardItem = {
	label: string;
	icon: React.ComponentType<{ className?: string }>;
};

type DepartmentRoleRow = {
	id: string;
	name: string;
	active: boolean;
};

type MemberRoleAssignmentRow = {
	department_role_id: string | null;
	hire_start_date: string | null;
	created_at: string | null;
	first_name: string | null;
	last_name: string | null;
};

type TrainingAttendanceRow = {
	training_event_id: string;
};

type TrainingEventRow = {
	id: string;
	title: string;
	category_id: string | null;
	starts_at: string;
	hours_credit: number | string | null;
};

type OutsideSubmissionRow = {
	id: string;
	category_id: string | null;
	training_date: string;
	hours: number | string | null;
	status: string;
};

type AssignmentMemberRow = {
	id: string;
	training_assignment_id: string;
	completion_status: string;
	due_at: string | null;
	completed_at: string | null;
	hours_earned: number | string | null;
};

type AssignmentRow = {
	id: string;
	title: string;
	category_id: string | null;
	due_at: string | null;
	hours_credit: number | string | null;
	is_required: boolean;
	review_required: boolean;
	status: string;
};

type MemberCertificationRow = {
	id: string;
	certification_id: string;
	certificate_number: string | null;
	issued_at: string;
	expires_at: string | null;
	supporting_document_id?: string | null;
	created_at?: string;
	updated_at?: string;
};

type CertificationTypeRow = {
	id: string;
	name: string;
	ems_authority: "iowa" | "nremt" | null;
	ems_certification_level: "emr" | "emt" | "aemt" | "paramedic" | null;
};

type DeficiencyStatusRelation = {
	name: string | null;
	active: boolean | null;
};

type DeficiencyPriorityRelation = {
	name: string | null;
};

type DeficiencyAssignedRow = {
	id: string;
	deficiency_number: string | null;
	description: string | null;
	assigned_to: string | null;
	created_at: string | null;
	reported_at: string | null;
	status_info: DeficiencyStatusRelation | DeficiencyStatusRelation[] | null;
	priority_info: DeficiencyPriorityRelation | DeficiencyPriorityRelation[] | null;
};

type DeficiencyAssignmentHistoryRow = {
	deficiency_id: string;
	member_id: string | null;
	event_type: string | null;
	created_at: string | null;
};

type TrainingCategoryRow = {
	id: string;
	name: string;
};

function normalizeDeficiencyStatus(relation: DeficiencyStatusRelation | DeficiencyStatusRelation[] | null) {
	const row = Array.isArray(relation) ? relation[0] : relation;
	if (!row) {
		return { name: null, active: null };
	}
	return {
		name: typeof row.name === "string" ? row.name : null,
		active: typeof row.active === "boolean" ? row.active : null,
	};
}

function normalizeDeficiencyPriority(relation: DeficiencyPriorityRelation | DeficiencyPriorityRelation[] | null) {
	const row = Array.isArray(relation) ? relation[0] : relation;
	if (!row) {
		return { name: null };
	}
	return {
		name: typeof row.name === "string" ? row.name : null,
	};
}

// Mobile field controls should be large and easy to press, optimized for firefighters using the app in the field.
const quickActions: CardItem[] = [
	{ label: "Apparatus Checks", icon: ClipboardCheck },
	{ label: "Log Training", icon: GraduationCap },
	{ label: "Pre-Plans", icon: MapIcon },
	{ label: "EMS Supplies", icon: HeartPulse },
	{ label: "Gas Monitor Calibration", icon: Gauge },
	{ label: "Ladder Inspections", icon: Wrench },
	{ label: "Rope Inspections", icon: Activity },
	{ label: "Hose Testing", icon: Activity },
	{ label: "Inventory", icon: Box },
	{ label: "Deficiencies", icon: AlertTriangle },
	{ label: "Maintenance", icon: Wrench },
	{ label: "Reports", icon: FileBarChart2 },
	{ label: "Documents", icon: FileText },
];

const buttonInteraction = "transition-all duration-200 active:scale-[0.98]";
const actionCardClassName =
	"group relative flex min-h-[106px] sm:min-h-[114px] w-full flex-col justify-between overflow-hidden border border-white/18 bg-[linear-gradient(to_bottom,rgba(34,34,34,0.94),rgba(9,9,9,0.98))] px-4 sm:px-5 py-4 text-left shadow-[0_12px_20px_rgba(0,0,0,0.32),0_2px_8px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-10px_16px_rgba(0,0,0,0.26)] hover:border-red-500/40 hover:bg-[linear-gradient(to_bottom,rgba(42,42,42,0.96),rgba(14,14,14,0.99))]";

function SectionHeader({ title, meta, className = "" }: { title: string; meta: string; className?: string }) {
	return (
		<div className={`mb-4 mt-6 flex items-center justify-between ${className}`}>
			<div className="flex items-center gap-2">
				<span className="h-[14px] w-[6px] -skew-x-[20deg] rounded-sm bg-[#ef2b2d]" />
				<h3 className="text-[14px] font-semibold uppercase tracking-[0.2em] text-white/85">{title}</h3>
			</div>
			<span className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#ef2b2d]/80">
				{meta}
			</span>
		</div>
	);
}


function ActionCard({ label, Icon, href }: { label: string; Icon: CardItem["icon"]; href?: string }) {
	const cardContent = (
		<>
			<span className="pointer-events-none absolute left-[10px] right-[10px] top-[1px] h-px bg-[linear-gradient(to_right,rgba(255,255,255,0),rgba(245,245,245,0.22),rgba(255,255,255,0))]" />
			<span className="pointer-events-none absolute left-[17px] top-[8px] h-[10px] w-[14px] -skew-x-[18deg] border-l border-t border-white/16" />
			<span className="pointer-events-none absolute right-[17px] top-[8px] h-[10px] w-[14px] skew-x-[18deg] border-r border-t border-white/14" />
			<span className="pointer-events-none absolute inset-x-3 top-0 h-[40%] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(255,255,255,0))]" />
			<span className="absolute left-0 top-[18px] h-6 w-[3px] bg-[#ef2b2d] opacity-90 shadow-[0_0_7px_rgba(239,43,45,0.24)]" />
			<ChevronRight className="absolute right-3.5 top-3.5 h-[18px] w-[18px] text-white/45 transition group-hover:text-[#ef2b2d] group-hover:translate-x-0.5" />
			<div className="flex items-start">
				<Icon className="h-7 w-7 text-[#ef2b2d]" />
			</div>
			<div className="mt-2 flex min-h-0 items-end">
				<span className="text-[15px] sm:text-[16px] font-semibold leading-[1.2] text-white/95">
					{label}
				</span>
			</div>
		</>
	);

	if (href) {
		return (
			<Link
				href={href}
				className={`${actionCardClassName} ${buttonInteraction}`}
				style={{ clipPath: "polygon(6% 0, 94% 0, 100% 10%, 100% 90%, 94% 100%, 6% 100%, 0 90%, 0 10%)" }}
			>
				{cardContent}
			</Link>
		);
	}

	return (
		<button
			className={`${actionCardClassName} ${buttonInteraction}`}
			style={{ clipPath: "polygon(6% 0, 94% 0, 100% 10%, 100% 90%, 94% 100%, 6% 100%, 0 90%, 0 10%)" }}
		>
			{cardContent}
		</button>
	);
}

export default async function MobilePage() {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);

	if (!currentMember?.departmentId) {
		redirect("/login");
	}

	const { data: hasMobileMaintenanceFieldEntry } = await supabase.rpc("member_has_app_permission", {
		p_department_id: currentMember.departmentId,
		p_permission_key: "maintenance_field_entry",
	});
	const hasMobileReportsAccess = await hasDepartmentPermission(
		supabase,
		currentMember.departmentId,
		currentMember.role,
		"reports_management",
	);
	const hasDepartmentReadinessAccess = currentMember.role !== "firefighter";

	const [
		{ data: deptRow },
		{ data: attendanceRows },
		{ data: approvedOutsideRows },
		{ data: certificationsRows },
		{ data: certificationTypesRows },
		{ data: requirementsRows },
		{ data: memberRoleRow },
		{ data: departmentRolesRows },
		{ data: qualificationTypesRows },
		{ data: memberQualificationsRows },
		{ data: roleRequiredCertificationRows },
		{ data: roleRequiredQualificationRows },
		{ data: assignedDeficiencyRows },
		{ data: assignmentMemberRows },
		{ data: emsTrackProfileRows },
	] = await Promise.all([
		supabase
			.from("departments")
			.select("name")
			.eq("id", currentMember.departmentId)
			.single(),
		supabase
			.from("training_event_attendance")
			.select("training_event_id")
			.eq("department_id", currentMember.departmentId)
			.eq("member_id", currentMember.id)
			.eq("attendance_status", "attending"),
		supabase
			.from("training_outside_submissions")
			.select("id, category_id, training_date, hours, status")
			.eq("department_id", currentMember.departmentId)
			.eq("member_id", currentMember.id)
			.eq("status", "approved")
			.order("training_date", { ascending: false }),
		supabase
			.from("member_certifications")
			.select("id, certification_id, certificate_number, issued_at, expires_at, supporting_document_id, created_at, updated_at")
			.eq("department_id", currentMember.departmentId)
			.eq("member_id", currentMember.id)
			.order("expires_at", { ascending: true }),
		supabase
			.from("certifications")
			.select("id, name, ems_authority, ems_certification_level")
			.eq("department_id", currentMember.departmentId),
		supabase
			.from("training_requirements")
			.select("id, name, requirement_kind, period_type, minimum_hours, category_id, due_frequency_rule, required_topic, active, sort_order, config_json")
			.eq("department_id", currentMember.departmentId)
			.eq("active", true)
			.order("sort_order", { ascending: true }),
		supabase
			.from("members")
			.select("department_role_id, hire_start_date, created_at, first_name, last_name")
			.eq("department_id", currentMember.departmentId)
			.eq("id", currentMember.id)
			.single(),
		supabase
			.from("department_roles")
			.select("id, name, active")
			.eq("department_id", currentMember.departmentId),
		supabase
			.from("qualifications")
			.select("id, name, active")
			.eq("department_id", currentMember.departmentId),
		supabase
			.from("member_qualifications")
			.select("qualification_id")
			.eq("department_id", currentMember.departmentId)
			.eq("member_id", currentMember.id),
		supabase
			.from("role_required_certifications")
			.select("department_role_id, certification_id")
			.eq("department_id", currentMember.departmentId),
		supabase
			.from("role_required_qualifications")
			.select("department_role_id, qualification_id")
			.eq("department_id", currentMember.departmentId),
		supabase
			.from("deficiencies")
			.select(
				"id, deficiency_number, description, assigned_to, created_at, reported_at, status_info:deficiency_statuses!fk_deficiencies_status(name, active), priority_info:deficiency_priorities!fk_deficiencies_priority(name)",
			)
			.eq("assigned_to", currentMember.id),
		supabase
			.from("training_assignment_members")
			.select(
				"id, training_assignment_id, completion_status, due_at, completed_at, hours_earned",
			)
			.eq("department_id", currentMember.departmentId)
			.eq("member_id", currentMember.id)
			.order("created_at", { ascending: false }),
		supabase
			.from("ems_member_track_profiles")
			.select("id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date")
			.eq("department_id", currentMember.departmentId)
			.eq("member_id", currentMember.id)
			.order("effective_start_date", { ascending: false }),
	]);

	const departmentName = (deptRow as { name?: string } | null)?.name ?? "Redline Fire Department";
	const roleAssignment = (memberRoleRow ?? null) as MemberRoleAssignmentRow | null;
	const memberFirstName = roleAssignment?.first_name || currentMember.name.split(" ")[0] || currentMember.name;
	const memberRequirementStartDate = roleAssignment?.hire_start_date ?? roleAssignment?.created_at ?? null;

	const attendance = (attendanceRows ?? []) as TrainingAttendanceRow[];
	const approvedOutside = (approvedOutsideRows ?? []) as OutsideSubmissionRow[];
	const rawMemberCertifications = (certificationsRows ?? []) as MemberCertificationRow[];
	const certificationTypes = (certificationTypesRows ?? []) as CertificationTypeRow[];
	const requirements = (requirementsRows ?? []) as RequirementInput[];
	const departmentRoles = ((departmentRolesRows ?? []) as DepartmentRoleRow[]).map((row) => ({
		id: row.id,
		name: row.name,
		active: row.active,
	}));
	const qualificationTypes: CatalogRow[] = ((qualificationTypesRows ?? []) as CatalogRow[]).map((row) => ({
		id: row.id,
		name: row.name,
		active: row.active,
	}));
	const memberQualifications = ((memberQualificationsRows ?? []) as Array<{ qualification_id: string }>).map((row) => ({
		qualification_id: row.qualification_id,
	}));
	const memberCertifications = buildCanonicalMemberCertificationRows({
		certificationTypes: certificationTypes.map((row) => ({ id: row.id, name: row.name, active: true } satisfies CatalogRow)),
		qualificationTypes,
		memberCertifications: rawMemberCertifications,
		memberQualifications,
	}).map((row) => ({
		id: row.id ?? row.certification_id,
		certification_id: row.certification_id,
		certificate_number: row.certificate_number ?? null,
		issued_at: row.issued_at ?? "",
		expires_at: row.expires_at,
	}));
	const roleRequiredCertifications = ((roleRequiredCertificationRows ?? []) as RoleRequiredCertificationRow[]).map((row) => ({
		department_role_id: row.department_role_id,
		certification_id: row.certification_id,
	}));
	const roleRequiredQualifications = ((roleRequiredQualificationRows ?? []) as RoleRequiredQualificationRow[]).map((row) => ({
		department_role_id: row.department_role_id,
		qualification_id: row.qualification_id,
	}));
	const assignedDeficiencies = (assignedDeficiencyRows ?? []) as DeficiencyAssignedRow[];
	const assignmentMembers = (assignmentMemberRows ?? []) as AssignmentMemberRow[];
	const emsTrackProfiles = (emsTrackProfileRows ?? []) as EmsTrackProfileAuthorityRow[];

	const assignmentIds = Array.from(
		new Set(
			assignmentMembers
				.map((row) => row.training_assignment_id)
				.filter((id) => typeof id === "string" && id.length > 0),
		),
	);

	let assignments: AssignmentRow[] = [];
	if (assignmentIds.length > 0) {
		const { data: assignmentRowsData } = await supabase
			.from("training_assignments")
			.select("id, title, category_id, due_at, hours_credit, is_required, review_required, status")
			.eq("department_id", currentMember.departmentId)
			.in("id", assignmentIds);

		assignments = (assignmentRowsData ?? []) as AssignmentRow[];
	}

	const attendedEventIds = Array.from(
		new Set(attendance.map((row) => row.training_event_id).filter((id) => typeof id === "string" && id.length > 0)),
	);

	let attendedEvents: TrainingEventRow[] = [];
	if (attendedEventIds.length > 0) {
		const { data: eventsRows } = await supabase
			.from("training_events")
			.select("id, title, category_id, starts_at, hours_credit")
			.eq("department_id", currentMember.departmentId)
			.in("id", attendedEventIds)
			.order("starts_at", { ascending: false });

		attendedEvents = (eventsRows ?? []) as TrainingEventRow[];
	}

	const categoryIds = Array.from(
		new Set(
			[
				...attendedEvents.map((row) => row.category_id),
				...approvedOutside.map((row) => row.category_id),
				...assignments.map((row) => row.category_id),
			].filter((id): id is string => Boolean(id)),
		),
	);

	let categories: TrainingCategoryRow[] = [];
	if (categoryIds.length > 0) {
		const { data: categoryRows } = await supabase
			.from("training_categories")
			.select("id, name")
			.eq("department_id", currentMember.departmentId)
			.in("id", categoryIds);

		categories = (categoryRows ?? []) as TrainingCategoryRow[];
	}

	const categoryNameById = new Map(categories.map((row) => [row.id, row.name]));
	const certificationNameById = new Map(certificationTypes.map((row) => [row.id, row.name]));
	const certificationTypeById = buildCertificationTypeMetaById(
		certificationTypes.map((row) => ({
			id: row.id,
			ems_authority: row.ems_authority,
			ems_certification_level: row.ems_certification_level,
		})),
	);

	const memberDepartmentRoleId = roleAssignment?.department_role_id ?? null;
	const selectedDepartmentRole = memberDepartmentRoleId
		? departmentRoles.find((row) => row.id === memberDepartmentRoleId) ?? null
		: null;

	const assignmentById = new Map(assignments.map((row) => [row.id, row]));
	const approvedHomeworkMembers = assignmentMembers.filter((row) => row.completion_status === "approved");

	const fireAnnualComplianceRows = [
		...attendedEvents.map((event) => ({
			categoryId: event.category_id,
			hours: event.hours_credit,
		})),
		...approvedOutside.map((submission) => ({
			categoryId: submission.category_id,
			hours: submission.hours,
		})),
		...approvedHomeworkMembers.map((approvedHomework) => {
			const assignment = assignmentById.get(approvedHomework.training_assignment_id);
			const assignmentHours = assignment ? parseHours(assignment.hours_credit) : 0;
			const rowHours = parseHours(approvedHomework.hours_earned);
			return {
				categoryId: assignment?.category_id ?? null,
				hours: rowHours > 0 ? rowHours : assignmentHours,
			};
		}),
	];

	const categoryHoursMap = new Map<string, { categoryId: string | null; name: string; hours: number }>();
	for (const event of attendedEvents) {
		const categoryName = event.category_id ? categoryNameById.get(event.category_id) ?? "Uncategorized" : "Uncategorized";
		const key = event.category_id || "uncategorized";
		const current = categoryHoursMap.get(key) ?? { categoryId: event.category_id, name: categoryName, hours: 0 };
		current.hours += parseHours(event.hours_credit);
		categoryHoursMap.set(key, current);
	}
	for (const submission of approvedOutside) {
		const categoryName = submission.category_id ? categoryNameById.get(submission.category_id) ?? "Uncategorized" : "Uncategorized";
		const key = submission.category_id || "uncategorized";
		const current = categoryHoursMap.get(key) ?? { categoryId: submission.category_id, name: categoryName, hours: 0 };
		current.hours += parseHours(submission.hours);
		categoryHoursMap.set(key, current);
	}
	for (const approvedHomework of approvedHomeworkMembers) {
		const assignment = assignmentById.get(approvedHomework.training_assignment_id);
		if (!assignment) {
			continue;
		}
		const categoryName = assignment.category_id ? categoryNameById.get(assignment.category_id) ?? "Uncategorized" : "Uncategorized";
		const key = assignment.category_id || "uncategorized";
		const current = categoryHoursMap.get(key) ?? { categoryId: assignment.category_id, name: categoryName, hours: 0 };
		const assignmentHours = parseHours(assignment.hours_credit);
		const rowHours = parseHours(approvedHomework.hours_earned);
		current.hours += rowHours > 0 ? rowHours : assignmentHours;
		categoryHoursMap.set(key, current);
	}

	const assignedDeficiencyIds = assignedDeficiencies.map((row) => row.id).filter((id) => typeof id === "string" && id.length > 0);
	let assignmentHistoryRows: DeficiencyAssignmentHistoryRow[] = [];

	if (assignedDeficiencyIds.length > 0) {
		const { data: assignmentRows } = await supabase
			.from("deficiency_history")
			.select("deficiency_id, member_id, event_type, created_at")
			.in("deficiency_id", assignedDeficiencyIds)
			.eq("member_id", currentMember.id)
			.eq("event_type", "Assigned")
			.order("created_at", { ascending: false });

		assignmentHistoryRows = (assignmentRows ?? []) as DeficiencyAssignmentHistoryRow[];
	}

	const personalAssignmentStartedAtByDeficiencyId = new Map<string, string>();
	for (const row of assignmentHistoryRows) {
		if (!row.deficiency_id || !row.created_at) {
			continue;
		}

		if (!personalAssignmentStartedAtByDeficiencyId.has(row.deficiency_id)) {
			personalAssignmentStartedAtByDeficiencyId.set(row.deficiency_id, row.created_at);
		}
	}

	const authoritativeReadiness = computeAuthoritativeMemberReadiness({
		currentMemberId: currentMember.id,
		memberStartDate: memberRequirementStartDate,
		memberDepartmentRoleId,
		roleName: selectedDepartmentRole?.name ?? null,
		canonicalMemberCertifications: memberCertifications,
		certificationNameById,
		certificationTypeById,
		emsTrackProfiles,
		roleRequiredCertifications,
		certificationCatalog: certificationTypes.map((row) => ({ id: row.id, name: row.name, active: true } satisfies CatalogRow)),
		qualificationCatalog: qualificationTypes,
		roleRequiredQualifications,
		memberQualifications,
		requirements,
		categoryNameById,
		fireAnnualComplianceRows,
		categoryHours: Array.from(categoryHoursMap.values()).map((row) => ({ categoryId: row.categoryId, categoryName: row.name, hours: row.hours })),
		trainingAssignments: assignments,
		assignmentMembers,
		deficiencyItems: assignedDeficiencies.map((row) => {
			const status = normalizeDeficiencyStatus(row.status_info);
			const priority = normalizeDeficiencyPriority(row.priority_info);

			return {
				id: row.id,
				deficiencyNumber: row.deficiency_number,
				description: row.description,
				priorityName: priority.name,
				assignedToMemberId: row.assigned_to,
				statusName: status.name,
				statusActive: status.active,
				createdAt: row.created_at,
				reportedAt: row.reported_at,
				personalAssignedAt: personalAssignmentStartedAtByDeficiencyId.get(row.id) ?? null,
			};
		}),
	});

	const readinessScore = authoritativeReadiness.readiness;
	const coachSummary = getAuthoritativeCoachSummary({
		readinessState: readinessScore,
		isSelf: true,
	});

	const readinessScorePercent = readinessScore.scorePercent;
	const readiness = readinessScorePercent ?? 0;
	const gaugeSize = 108;
	const stroke = 7;
	const radius = (gaugeSize - stroke) / 2;
	const circumference = 2 * Math.PI * radius;
	const startAngle = 135;
	const sweepAngle = 270;
	const arcLength = (circumference * sweepAngle) / 360;
	const progressLength = (readiness / 100) * arcLength;
	const tickCount = 18;
	const innerTickCount = 36;
	const notificationCount = assignedDeficiencies.length;
	const visibleQuickActions = quickActions.filter((item) => {
		if (item.label === "Maintenance") return Boolean(hasMobileMaintenanceFieldEntry);
		if (item.label === "Reports") return hasMobileReportsAccess;
		return true;
	});
	if (hasDepartmentReadinessAccess) {
		visibleQuickActions.push({ label: "Department Readiness", icon: Shield });
	}

	return (
		<main className="min-h-screen overscroll-y-none bg-[#020202] text-white">
			<div className="relative mx-auto min-h-screen w-full max-w-xl md:max-w-2xl lg:max-w-4xl bg-[#050505]">
				<div className="pointer-events-none fixed inset-x-0 top-0 z-0 mx-auto h-[280px] w-full max-w-xl md:max-w-2xl lg:max-w-4xl overflow-hidden border-b border-white/10">
					<Image
						src="/branding/logos/desktop.png"
						alt="Firefighter background"
						fill
						priority
						className="object-cover brightness-145 contrast-128 saturate-138"
						style={{ objectPosition: "84% calc(55% + 6px)" }}
					/>
					<div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.06),rgba(0,0,0,0.18)_48%,rgba(0,0,0,0.46))]" />
				</div>

				<div className="relative z-10 h-[280px] overflow-hidden border-b border-white/10">

					<div className="absolute inset-x-6 top-5 flex items-center justify-between text-[12px] font-semibold tracking-tight">
						<span>9:41</span>
						<div className="flex items-center gap-2 text-sm text-white/80">
							<span className="h-2 w-2 rounded-full bg-white" />
							<span className="h-2 w-2 rounded-full bg-white/70" />
							<span className="h-2 w-2 rounded-full bg-white/40" />
						</div>
					</div>

					<div className="absolute left-6 right-6 top-20">
						<div className="flex items-start justify-between">
							<button className={`relative mt-2 rounded-full border border-white/25 bg-black/30 p-2 text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)] ${buttonInteraction}`}>
								<Bell className="h-6 w-6" />
								{notificationCount > 0 && (
									<span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#ef2b2d] text-xs font-bold text-white">
										{notificationCount}
									</span>
								)}
							</button>
						</div>

						<p className="mt-6 -translate-y-[116px] text-[12px] font-semibold uppercase tracking-[0.22em] text-white/75">
							{departmentName}
						</p>
						<h1 className="mt-4 -translate-y-[130px] translate-x-[10px] text-[22px] font-semibold leading-none tracking-tight">
							{memberFirstName}
						</h1>
						<div className="mt-4 h-[3px] w-10 bg-[#ef2b2d]" />
					</div>
				</div>

				<div className="relative z-10 -mt-6 px-4 pb-48">
					<section
						className="-mt-[47px] relative h-[175.2px] overflow-hidden border border-white/16 bg-[linear-gradient(to_bottom,rgba(35,35,35,0.96),rgba(10,10,10,0.99))] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.46),0_3px_12px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-14px_20px_rgba(0,0,0,0.24)]"
						style={{ clipPath: "polygon(6% 0, 94% 0, 100% 12%, 100% 89%, 95% 100%, 5% 100%, 0 89%, 0 12%)" }}
					>
						<div className="pointer-events-none absolute left-[14px] right-[14px] top-[1px] h-px bg-[linear-gradient(to_right,rgba(255,255,255,0),rgba(245,245,245,0.24),rgba(255,255,255,0))]" />
						<div className="pointer-events-none absolute left-[18px] top-[9px] h-[10px] w-[14px] -skew-x-[18deg] border-l border-t border-white/16" />
						<div className="pointer-events-none absolute right-[18px] top-[9px] h-[10px] w-[14px] skew-x-[18deg] border-r border-t border-white/14" />
						<div className="pointer-events-none absolute inset-x-6 top-2 h-7 rounded-full bg-[linear-gradient(to_bottom,rgba(255,255,255,0.18),rgba(255,255,255,0))] blur-[1px]" />
						<div className="translate-y-[14px] flex items-center gap-4">
							<div className="relative flex h-[92px] w-[92px] flex-shrink-0 items-center justify-center rounded-full bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-10px_16px_rgba(0,0,0,0.48)]">
								<span className="pointer-events-none absolute inset-[7px] rounded-full shadow-[0_0_18px_rgba(239,43,45,0.22)]" />
								<span className="pointer-events-none absolute left-1/2 top-[7px] h-[26px] w-[68px] -translate-x-1/2 rounded-full bg-[linear-gradient(to_bottom,rgba(255,255,255,0.2),rgba(255,255,255,0))] blur-[1px]" />
								<svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}>
									<g style={{ transform: `rotate(${startAngle}deg)`, transformOrigin: `${gaugeSize / 2}px ${gaugeSize / 2}px` }}>
										{Array.from({ length: innerTickCount }).map((_, index) => {
											const tickAngle = (sweepAngle / (innerTickCount - 1)) * index;
											return (
												<line
													key={`inner-${index}`}
													x1={gaugeSize / 2}
													y1={17}
													x2={gaugeSize / 2}
													y2={20}
													stroke="rgba(255,255,255,0.18)"
													strokeWidth={0.9}
													strokeLinecap="round"
													transform={`rotate(${tickAngle} ${gaugeSize / 2} ${gaugeSize / 2})`}
												/>
											);
										})}
									</g>
									<g style={{ transform: `rotate(${startAngle}deg)`, transformOrigin: `${gaugeSize / 2}px ${gaugeSize / 2}px` }}>
										{Array.from({ length: tickCount }).map((_, index) => {
											const tickAngle = (sweepAngle / (tickCount - 1)) * index;
											const isRedline = index >= tickCount - 4;
											return (
												<line
													key={index}
													x1={gaugeSize / 2}
													y1={isRedline ? 8 : 10}
													x2={gaugeSize / 2}
													y2={isRedline ? 16 : 14}
													stroke={isRedline ? "rgba(239,43,45,0.9)" : "rgba(255,255,255,0.2)"}
													strokeWidth={isRedline ? 1.9 : 1}
													strokeLinecap="round"
													transform={`rotate(${tickAngle} ${gaugeSize / 2} ${gaugeSize / 2})`}
												/>
											);
										})}
									</g>
									<circle
										cx={gaugeSize / 2}
										cy={gaugeSize / 2}
										r={radius}
										stroke="rgba(255,255,255,0.14)"
										strokeWidth={stroke}
										strokeDasharray={`${arcLength} ${circumference}`}
										fill="none"
										style={{
											transform: `rotate(${startAngle}deg)`,
											transformOrigin: `${gaugeSize / 2}px ${gaugeSize / 2}px`,
										}}
									/>
									<circle
										cx={gaugeSize / 2}
										cy={gaugeSize / 2}
										r={radius}
										stroke="#ef2b2d"
										strokeWidth={stroke}
										strokeLinecap="round"
										strokeDasharray={`${progressLength} ${circumference}`}
										fill="none"
										style={{
											transform: `rotate(${startAngle}deg)`,
											transformOrigin: `${gaugeSize / 2}px ${gaugeSize / 2}px`,
											filter: "drop-shadow(0 0 5px rgba(239,43,45,0.34))",
										}}
									/>
								</svg>
								<div className="relative z-10 text-center">
									<div className="text-[38px] font-semibold leading-none tracking-tight">
										{readinessScorePercent === null ? "--" : Math.round(readinessScorePercent)}
										{readinessScorePercent !== null && <span className="text-[23px]">%</span>}
									</div>
								</div>
							</div>

							<div className="min-w-0 flex-1">
								<p className="w-full translate-y-[-11px] whitespace-nowrap text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">My Readiness</p>
								<div
									className="readiness-flow mx-auto mt-1 h-[2px] w-[230px] -translate-y-[11px] bg-[linear-gradient(to_right,rgba(239,43,45,0),rgba(120,12,12,0.92),rgba(239,43,45,0))]"
								/>
								<h2
									className="mt-1 text-[21px] font-semibold uppercase tracking-[0.03em] text-[#ff3c36]"
									style={{ fontFamily: '"Ultra Pro", sans-serif' }}
								>
									{readinessScorePercent !== null && readinessScorePercent >= 80 ? "Redline Ready" : "Readiness"}
								</h2>
								<p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/85 line-clamp-2">
									<Shield className="h-3.5 w-3.5 flex-shrink-0 text-[#ef2b2d]" />
									<span>{coachSummary.sentence}</span>
								</p>
								<button className={`mt-1 inline-flex h-9 min-w-[190px] -translate-x-[10px] translate-y-[20px] items-center justify-between gap-2 rounded-[12px] border border-[#ef2b2d] bg-[#ef2b2d] px-6 text-[12px] font-semibold text-white/90 shadow-[0_10px_22px_rgba(0,0,0,0.3)] hover:bg-[#ff3c36] ${buttonInteraction}`}>
									<Link href="/mobile/my-readiness">View My Readiness</Link>
									<ChevronRight className="h-4 w-4 text-white" />
								</button>
							</div>

						</div>
					</section>

					<SectionHeader title="FIELD ACTIONS" meta={`${visibleQuickActions.length} Actions`} />
					<div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-2 lg:grid-cols-2">
						{visibleQuickActions.map((item) => (
							<ActionCard
								key={item.label}
								label={item.label}
								Icon={item.icon}
								href={item.label === "Apparatus Checks" ? "/mobile/apparatus-checks" : item.label === "Pre-Plans" ? "/mobile/pre-plans" : item.label === "Log Training" ? "/mobile/training/new" : item.label === "EMS Supplies" ? "/mobile/ems-supplies" : item.label === "Gas Monitor Calibration" ? "/mobile/gas-monitor-calibration" : item.label === "Ladder Inspections" ? "/mobile/ladder-inspections" : item.label === "Rope Inspections" ? "/mobile/rope-inspections" : item.label === "Hose Testing" ? "/mobile/hose-testing" : item.label === "Inventory" ? "/mobile/inventory" : item.label === "Department Readiness" ? "/mobile/department-readiness" : item.label === "Deficiencies" ? "/mobile/deficiencies" : item.label === "Maintenance" ? "/mobile/maintenance" : item.label === "Documents" ? "/mobile/documents" : item.label === "Reports" ? "/mobile/reports" : undefined}
							/>
						))}
					</div>
				</div>

			</div>

			<style>{`
				.readiness-flow {
					background-size: 200% 100%;
					animation: readiness-flow 2.1s linear infinite;
				}

				@keyframes readiness-flow {
					0% {
						background-position: -200% 0;
					}
					100% {
						background-position: 200% 0;
					}
				}
			`}</style>
		</main>
	);
}
