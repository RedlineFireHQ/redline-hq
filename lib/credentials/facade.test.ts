import assert from "node:assert/strict";
import test from "node:test";

import {
	applyCredentialRequirementStatus,
	buildCredentialCatalog,
	buildMemberCredentials,
	buildRequiredCredentials,
	getCredentialWriteRouteForCreate,
	getCredentialWriteRouteForExisting,
	type CertificationCatalogRow,
	type MemberCertificationRow,
	type MemberQualificationRow,
	type QualificationCatalogRow,
	type RoleRequiredCertificationRow,
	type RoleRequiredQualificationRow,
	type SupportingDocumentRow,
} from "@/lib/credentials/facade";

const certifications: CertificationCatalogRow[] = [
	{
		id: "ff1-cert",
		name: "Firefighter 1",
		active: true,
		ems_authority: null,
		ems_certification_level: null,
	},
	{
		id: "iowa-emt-cert",
		name: "Iowa EMT",
		active: true,
		ems_authority: "iowa",
		ems_certification_level: "emt",
	},
];

const qualifications: QualificationCatalogRow[] = [
	{
		id: "ff1-qual",
		name: "Firefighter 1",
		active: true,
	},
];

const supportingDocuments: SupportingDocumentRow[] = [
	{
		id: "doc-1",
		title: "FF1 Card",
		document_number: "DOC-100",
	},
];

test("certification catalog items normalize to expires=true", () => {
	const catalog = buildCredentialCatalog({
		certificationTypes: certifications,
		qualificationTypes: [],
	});

	assert.equal(catalog.length, 2);
	assert.equal(catalog.every((row) => row.sourceType === "certification" && row.expires === true), true);
});

test("qualification catalog items normalize to expires=false", () => {
	const catalog = buildCredentialCatalog({
		certificationTypes: [],
		qualificationTypes: qualifications,
	});

	assert.equal(catalog.length, 1);
	assert.equal(catalog[0].sourceType, "qualification");
	assert.equal(catalog[0].expires, false);
});

test("member certification with expires_at normalizes to expires=true", () => {
	const memberCertifications: MemberCertificationRow[] = [
		{
			id: "mc-1",
			member_id: "member-1",
			certification_id: "ff1-cert",
			issued_at: "2026-01-01",
			expires_at: "2028-01-01",
			supporting_document_id: "doc-1",
		},
	];

	const rows = buildMemberCredentials({
		memberCertifications,
		memberQualifications: [],
		certificationTypes: certifications,
		qualificationTypes: qualifications,
		supportingDocuments,
	});

	assert.equal(rows.length, 1);
	assert.equal(rows[0].sourceType, "certification");
	assert.equal(rows[0].expires, true);
	assert.equal(rows[0].expiresAt, "2028-01-01");
});

test("member certification with expires_at null normalizes to expires=false", () => {
	const memberCertifications: MemberCertificationRow[] = [
		{
			id: "mc-2",
			member_id: "member-1",
			certification_id: "ff1-cert",
			issued_at: "2026-01-01",
			expires_at: null,
			supporting_document_id: null,
		},
	];

	const rows = buildMemberCredentials({
		memberCertifications,
		memberQualifications: [],
		certificationTypes: certifications,
		qualificationTypes: qualifications,
	});

	assert.equal(rows.length, 1);
	assert.equal(rows[0].sourceType, "certification");
	assert.equal(rows[0].expires, false);
	assert.equal(rows[0].expiresAt, null);
});

test("qualification member record normalizes to expires=false", () => {
	const memberQualifications: MemberQualificationRow[] = [
		{
			id: "mq-1",
			member_id: "member-1",
			qualification_id: "ff1-qual",
			earned_at: "2026-02-01",
			supporting_document_id: null,
		},
	];

	const rows = buildMemberCredentials({
		memberCertifications: [],
		memberQualifications,
		certificationTypes: certifications,
		qualificationTypes: qualifications,
	});

	assert.equal(rows.length, 1);
	assert.equal(rows[0].sourceType, "qualification");
	assert.equal(rows[0].expires, false);
	assert.equal(rows[0].expiresAt, null);
	assert.equal(rows[0].achievedAt, "2026-02-01");
});

test("EMS certification remains certification/expiring and retains EMS metadata", () => {
	const memberCertifications: MemberCertificationRow[] = [
		{
			id: "mc-3",
			member_id: "member-1",
			certification_id: "iowa-emt-cert",
			issued_at: "2026-03-01",
			expires_at: "2028-03-01",
			supporting_document_id: null,
		},
	];

	const rows = buildMemberCredentials({
		memberCertifications,
		memberQualifications: [],
		certificationTypes: certifications,
		qualificationTypes: qualifications,
	});

	assert.equal(rows[0].emsAuthority, "iowa");
	assert.equal(rows[0].emsCertificationLevel, "emt");
	assert.equal(rows[0].sourceType, "certification");
	assert.equal(rows[0].expires, true);

	const catalog = buildCredentialCatalog({
		certificationTypes: certifications,
		qualificationTypes: qualifications,
	});
	const iowa = catalog.find((row) => row.id === "iowa-emt-cert");
	assert.ok(iowa);
	assert.equal(iowa?.sourceType, "certification");
	assert.equal(iowa?.emsAuthority, "iowa");
	assert.equal(iowa?.expires, true);
});

test("EMS credential cannot be created as a non-expiring certification", () => {
	assert.throws(
		() => getCredentialWriteRouteForCreate({ expires: false, emsAuthority: "iowa" }),
		/EMS certifications must remain expiring credentials/,
	);
});

test("non-expiring certification create path still writes to member_certifications", () => {
	assert.equal(getCredentialWriteRouteForCreate({ expires: false, emsAuthority: null }), "member_certifications");
});

test("supporting document information is preserved on normalized member credentials", () => {
	const memberCertifications: MemberCertificationRow[] = [
		{
			id: "mc-4",
			member_id: "member-1",
			certification_id: "ff1-cert",
			issued_at: "2026-04-01",
			expires_at: "2028-04-01",
			supporting_document_id: "doc-1",
		},
	];

	const rows = buildMemberCredentials({
		memberCertifications,
		memberQualifications: [],
		certificationTypes: certifications,
		qualificationTypes: qualifications,
		supportingDocuments,
	});

	assert.equal(rows[0].supportingDocumentId, "doc-1");
	assert.equal(rows[0].supportingDocument?.id, "doc-1");
	assert.equal(rows[0].supportingDocument?.title, "FF1 Card");
	assert.equal(rows[0].supportingDocument?.documentNumber, "DOC-100");
});

test("required certification routes to certification write path", () => {
	const requiredCertificationRows: RoleRequiredCertificationRow[] = [
		{
			id: "rrc-1",
			department_role_id: "role-1",
			certification_id: "ff1-cert",
		},
	];

	const requiredQualificationRows: RoleRequiredQualificationRow[] = [
		{
			id: "rrq-1",
			department_role_id: "role-1",
			qualification_id: "ff1-qual",
		},
	];

	const requiredCredentials = buildRequiredCredentials({
		roleRequiredCertifications: requiredCertificationRows,
		roleRequiredQualifications: requiredQualificationRows,
		certificationTypes: certifications,
		qualificationTypes: qualifications,
		departmentRoleId: "role-1",
	});
	const requiredCertification = requiredCredentials.find((row) => row.sourceType === "certification");
	assert.ok(requiredCertification);

	const route = getCredentialWriteRouteForExisting({
		sourceType: requiredCertification.sourceType,
		expires: requiredCertification.expires,
		emsAuthority: requiredCertification.emsAuthority,
	});

	assert.equal(route, "member_certifications");
});

test("required qualification routes to qualification write path", () => {
	const requiredCertificationRows: RoleRequiredCertificationRow[] = [
		{
			id: "rrc-1",
			department_role_id: "role-1",
			certification_id: "ff1-cert",
		},
	];

	const requiredQualificationRows: RoleRequiredQualificationRow[] = [
		{
			id: "rrq-1",
			department_role_id: "role-1",
			qualification_id: "ff1-qual",
		},
	];

	const requiredCredentials = buildRequiredCredentials({
		roleRequiredCertifications: requiredCertificationRows,
		roleRequiredQualifications: requiredQualificationRows,
		certificationTypes: certifications,
		qualificationTypes: qualifications,
		departmentRoleId: "role-1",
	});
	const requiredQualification = requiredCredentials.find((row) => row.sourceType === "qualification");
	assert.ok(requiredQualification);

	const route = getCredentialWriteRouteForExisting({
		sourceType: requiredQualification.sourceType,
		expires: requiredQualification.expires,
		emsAuthority: requiredQualification.emsAuthority,
	});

	assert.equal(route, "member_qualifications");
});

test("no catalog expiration behavior is derived from historical member records", () => {
	buildMemberCredentials({
		memberCertifications: [
			{
				id: "mc-historical",
				member_id: "member-1",
				certification_id: "ff1-cert",
				issued_at: "2026-05-01",
				expires_at: null,
				supporting_document_id: null,
			},
		],
		memberQualifications: [],
		certificationTypes: certifications,
		qualificationTypes: qualifications,
	});

	const catalog = buildCredentialCatalog({
		certificationTypes: certifications,
		qualificationTypes: qualifications,
	});

	const ff1Certification = catalog.find((row) => row.id === "ff1-cert");
	assert.ok(ff1Certification);
	assert.equal(ff1Certification.sourceType, "certification");
	assert.equal(ff1Certification.expires, true);
});

test("required credentials normalize and requirement status is preserved", () => {
	const requiredCertificationRows: RoleRequiredCertificationRow[] = [
		{
			id: "rrc-1",
			department_role_id: "role-1",
			certification_id: "ff1-cert",
		},
	];

	const requiredQualificationRows: RoleRequiredQualificationRow[] = [
		{
			id: "rrq-1",
			department_role_id: "role-1",
			qualification_id: "ff1-qual",
		},
	];

	const required = buildRequiredCredentials({
		roleRequiredCertifications: requiredCertificationRows,
		roleRequiredQualifications: requiredQualificationRows,
		certificationTypes: certifications,
		qualificationTypes: qualifications,
		departmentRoleId: "role-1",
	});

	assert.equal(required.length, 2);
	assert.equal(required.some((row) => row.sourceType === "certification" && row.catalogId === "ff1-cert"), true);
	assert.equal(required.some((row) => row.sourceType === "qualification" && row.catalogId === "ff1-qual"), true);
	assert.equal(required.every((row) => row.requirementStatus === "required"), true);

	const memberRows = buildMemberCredentials({
		memberCertifications: [
			{
				id: "mc-5",
				member_id: "member-1",
				certification_id: "ff1-cert",
				issued_at: "2026-04-01",
				expires_at: "2028-04-01",
				supporting_document_id: null,
			},
		],
		memberQualifications: [],
		certificationTypes: certifications,
		qualificationTypes: qualifications,
	});

	const withStatus = applyCredentialRequirementStatus({
		memberCredentials: memberRows,
		requiredCredentials: required,
	});

	assert.equal(withStatus[0].requirementStatus, "required");
});

test("legacy qualification requirement name marks matching certification as required", () => {
	const required = buildRequiredCredentials({
		roleRequiredCertifications: [],
		roleRequiredQualifications: [
			{
				id: "rrq-legacy",
				department_role_id: "role-1",
				qualification_id: "ff1-qual",
			},
		],
		certificationTypes: certifications,
		qualificationTypes: qualifications,
		departmentRoleId: "role-1",
	});

	const memberRows = buildMemberCredentials({
		memberCertifications: [
			{
				id: "mc-legacy-match",
				member_id: "member-1",
				certification_id: "ff1-cert",
				issued_at: "2026-04-01",
				expires_at: null,
				supporting_document_id: null,
			},
		],
		memberQualifications: [],
		certificationTypes: certifications,
		qualificationTypes: qualifications,
	});

	const withStatus = applyCredentialRequirementStatus({
		memberCredentials: memberRows,
		requiredCredentials: required,
	});

	assert.equal(withStatus[0].requirementStatus, "required");
});
