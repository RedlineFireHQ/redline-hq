import assert from "node:assert/strict";
import test from "node:test";

import { buildMemberReadinessScore, type RequirementInput } from "@/lib/readiness/member-readiness";
import { buildScoredCertificationStatuses } from "@/lib/readiness/scored-certifications";

function annualHoursRequirement(minimumHours: number): RequirementInput {
	return {
		id: "annual-hours",
		name: "Required Annual Training Hours",
		requirement_kind: "annual_hours",
		period_type: "annual",
		minimum_hours: minimumHours,
		category_id: null,
		due_frequency_rule: null,
		required_topic: null,
		sort_order: 0,
		config_json: null,
		active: true,
	};
}

test("authoritative readiness certification scope excludes generic EMT duplicates", () => {
	const scoped = buildScoredCertificationStatuses({
		memberDepartmentRoleId: "firefighter",
		certificationStatuses: [
			{ certificationId: "generic-emt", certificationName: "EMT", status: "current", authority: null },
			{ certificationId: "ff1", certificationName: "Firefighter 1", status: "current", authority: null },
			{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current", authority: "iowa" },
			{ certificationId: "nremt-emt", certificationName: "NREMT EMT", status: "current", authority: "nremt" },
		],
		roleRequiredCertifications: [{ department_role_id: "firefighter", certification_id: "ff1" }],
		includeIowaAuthority: true,
		includeNremtAuthority: true,
	});

	assert.deepEqual(
		scoped.map((row) => row.certificationId),
		["ff1", "iowa-emt", "nremt-emt"],
	);
});

test("optional NREMT is excluded from the certification bucket when not maintained", () => {
	const scoped = buildScoredCertificationStatuses({
		memberDepartmentRoleId: "firefighter",
		certificationStatuses: [
			{ certificationId: "ff1", certificationName: "Firefighter 1", status: "current", authority: null },
			{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current", authority: "iowa" },
			{ certificationId: "nremt-emt", certificationName: "NREMT EMT", status: "current", authority: "nremt" },
		],
		roleRequiredCertifications: [{ department_role_id: "firefighter", certification_id: "ff1" }],
		includeIowaAuthority: true,
		includeNremtAuthority: false,
	});

	assert.deepEqual(
		scoped.map((row) => row.certificationId),
		["ff1", "iowa-emt"],
	);
});

test("locked member readiness bucket math remains 40/40/10/10", () => {
	const score = buildMemberReadinessScore({
		requirementRows: [annualHoursRequirement(24)],
		departmentHours: 0,
		evaluationDate: "2026-12-31",
		categoryHours: [],
		categoryNameById: new Map(),
		certificationStatuses: [
			{ certificationId: "ff1", certificationName: "Firefighter 1", status: "current" },
			{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current" },
			{ certificationId: "nremt-emt", certificationName: "NREMT EMT", status: "current" },
		],
		scoredCertificationStatuses: [
			{ certificationId: "ff1", certificationName: "Firefighter 1", status: "current" },
			{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current" },
			{ certificationId: "nremt-emt", certificationName: "NREMT EMT", status: "current" },
		],
		qualificationReadiness: {
			hasAssignedRole: true,
			roleName: "Firefighter",
			requiredQualifications: [],
			completedQualifications: [],
			missingQualifications: [],
		},
		deficiencyItems: [],
		currentMemberId: "member-1",
	});

	assert.equal(score.scorePercent, 60);
	assert.equal(score.qualificationsScore, 10);
	assert.equal(score.deficiencyPenaltyPercent, 0);
	assert.equal(score.factors.find((factor) => factor.category === "training")?.completionPercent, 0);
	assert.equal(score.factors.filter((factor) => factor.category === "certification").length, 3);
});