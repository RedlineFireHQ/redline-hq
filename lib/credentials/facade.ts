export type CredentialSourceType = "certification" | "qualification";

export type CredentialRequirementStatus = "required" | "additional";

export type CredentialEmsAuthority = "iowa" | "nremt";

export type CredentialEmsLevel = "emr" | "emt" | "aemt" | "paramedic";

export type CertificationCatalogRow = {
	id: string;
	name: string;
	active: boolean | null;
	ems_authority: CredentialEmsAuthority | null;
	ems_certification_level: CredentialEmsLevel | null;
};

export type QualificationCatalogRow = {
	id: string;
	name: string;
	active: boolean | null;
};

export type MemberCertificationRow = {
	id: string;
	member_id: string;
	certification_id: string;
	issued_at: string;
	expires_at: string | null;
	supporting_document_id: string | null;
};

export type MemberQualificationRow = {
	id: string;
	member_id: string;
	qualification_id: string;
	earned_at: string;
	supporting_document_id: string | null;
};

export type RoleRequiredCertificationRow = {
	id: string;
	department_role_id: string;
	certification_id: string;
};

export type RoleRequiredQualificationRow = {
	id: string;
	department_role_id: string;
	qualification_id: string;
};

export type SupportingDocumentRow = {
	id: string;
	title: string | null;
	document_number: string | null;
};

export type CredentialSupportingDocument = {
	id: string;
	title: string | null;
	documentNumber: string | null;
};

export type CredentialCatalogItem = {
	id: string;
	name: string;
	sourceType: CredentialSourceType;
	expires: boolean;
	active: boolean;
	emsAuthority: CredentialEmsAuthority | null;
	emsCertificationLevel: CredentialEmsLevel | null;
};

export type MemberCredentialItem = {
	id: string;
	memberId: string;
	catalogId: string;
	name: string;
	sourceType: CredentialSourceType;
	expires: boolean;
	achievedAt: string;
	expiresAt: string | null;
	supportingDocumentId: string | null;
	supportingDocument: CredentialSupportingDocument | null;
	emsAuthority: CredentialEmsAuthority | null;
	emsCertificationLevel: CredentialEmsLevel | null;
};

export type RequiredCredentialItem = {
	id: string;
	departmentRoleId: string;
	catalogId: string;
	name: string;
	sourceType: CredentialSourceType;
	expires: boolean;
	requirementStatus: "required";
	emsAuthority: CredentialEmsAuthority | null;
	emsCertificationLevel: CredentialEmsLevel | null;
};

export type MemberCredentialWithRequirementStatus = MemberCredentialItem & {
	requirementStatus: CredentialRequirementStatus;
};

export type CredentialWriteRoute = "member_certifications" | "member_qualifications";

function buildSupportingDocumentMap(documents: SupportingDocumentRow[]) {
	const map = new Map<string, CredentialSupportingDocument>();
	for (const document of documents) {
		map.set(document.id, {
			id: document.id,
			title: document.title,
			documentNumber: document.document_number,
		});
	}
	return map;
}

function assertEmsSafety(input: {
	sourceType: CredentialSourceType;
	expires: boolean;
	emsAuthority: CredentialEmsAuthority | null;
}) {
	if (input.sourceType === "qualification" && input.emsAuthority) {
		throw new Error("EMS metadata is only valid for certification records.");
	}

	if (input.emsAuthority && !input.expires) {
		throw new Error("EMS certifications must remain expiring credentials.");
	}
}

export function buildCredentialCatalog(params: {
	certificationTypes: CertificationCatalogRow[];
	qualificationTypes: QualificationCatalogRow[];
}) {
	const certifications: CredentialCatalogItem[] = params.certificationTypes.map((row) => {
		const expires = true;
		const normalized: CredentialCatalogItem = {
			id: row.id,
			name: row.name,
			sourceType: "certification",
			expires,
			active: row.active !== false,
			emsAuthority: row.ems_authority,
			emsCertificationLevel: row.ems_certification_level,
		};

		assertEmsSafety({
			sourceType: normalized.sourceType,
			expires: normalized.expires,
			emsAuthority: normalized.emsAuthority,
		});

		return normalized;
	});

	const qualifications: CredentialCatalogItem[] = params.qualificationTypes.map((row) => ({
		id: row.id,
		name: row.name,
		sourceType: "qualification",
		expires: false,
		active: row.active !== false,
		emsAuthority: null,
		emsCertificationLevel: null,
	}));

	return [...certifications, ...qualifications];
}

export function buildMemberCredentials(params: {
	memberCertifications: MemberCertificationRow[];
	memberQualifications: MemberQualificationRow[];
	certificationTypes: CertificationCatalogRow[];
	qualificationTypes: QualificationCatalogRow[];
	supportingDocuments?: SupportingDocumentRow[];
}) {
	const certificationById = new Map(params.certificationTypes.map((row) => [row.id, row]));
	const qualificationById = new Map(params.qualificationTypes.map((row) => [row.id, row]));
	const supportingDocumentById = buildSupportingDocumentMap(params.supportingDocuments ?? []);

	const certifications: MemberCredentialItem[] = params.memberCertifications.map((row) => {
		const certification = certificationById.get(row.certification_id);
		const item: MemberCredentialItem = {
			id: row.id,
			memberId: row.member_id,
			catalogId: row.certification_id,
			name: certification?.name ?? "Unknown Certification",
			sourceType: "certification",
			expires: row.expires_at !== null,
			achievedAt: row.issued_at,
			expiresAt: row.expires_at,
			supportingDocumentId: row.supporting_document_id,
			supportingDocument: row.supporting_document_id
				? supportingDocumentById.get(row.supporting_document_id) ?? null
				: null,
			emsAuthority: certification?.ems_authority ?? null,
			emsCertificationLevel: certification?.ems_certification_level ?? null,
		};

		assertEmsSafety({
			sourceType: item.sourceType,
			expires: item.expires,
			emsAuthority: item.emsAuthority,
		});

		return item;
	});

	const qualifications: MemberCredentialItem[] = params.memberQualifications.map((row) => ({
		id: row.id,
		memberId: row.member_id,
		catalogId: row.qualification_id,
		name: qualificationById.get(row.qualification_id)?.name ?? "Unknown Qualification",
		sourceType: "qualification",
		expires: false,
		achievedAt: row.earned_at,
		expiresAt: null,
		supportingDocumentId: row.supporting_document_id,
		supportingDocument: row.supporting_document_id
			? supportingDocumentById.get(row.supporting_document_id) ?? null
			: null,
		emsAuthority: null,
		emsCertificationLevel: null,
	}));

	return [...certifications, ...qualifications];
}

export function buildRequiredCredentials(params: {
	roleRequiredCertifications: RoleRequiredCertificationRow[];
	roleRequiredQualifications: RoleRequiredQualificationRow[];
	certificationTypes: CertificationCatalogRow[];
	qualificationTypes: QualificationCatalogRow[];
	departmentRoleId?: string | null;
}) {
	const certificationById = new Map(params.certificationTypes.map((row) => [row.id, row]));
	const qualificationById = new Map(params.qualificationTypes.map((row) => [row.id, row]));

	const requiredCertifications = params.roleRequiredCertifications
		.filter((row) => (params.departmentRoleId ? row.department_role_id === params.departmentRoleId : true))
		.map((row) => {
			const certification = certificationById.get(row.certification_id);
			const item: RequiredCredentialItem = {
				id: row.id,
				departmentRoleId: row.department_role_id,
				catalogId: row.certification_id,
				name: certification?.name ?? "Unknown Certification",
				sourceType: "certification",
				expires: true,
				requirementStatus: "required",
				emsAuthority: certification?.ems_authority ?? null,
				emsCertificationLevel: certification?.ems_certification_level ?? null,
			};

			assertEmsSafety({
				sourceType: item.sourceType,
				expires: item.expires,
				emsAuthority: item.emsAuthority,
			});

			return item;
		});

	const requiredQualifications = params.roleRequiredQualifications
		.filter((row) => (params.departmentRoleId ? row.department_role_id === params.departmentRoleId : true))
		.map((row) => ({
			id: row.id,
			departmentRoleId: row.department_role_id,
			catalogId: row.qualification_id,
			name: qualificationById.get(row.qualification_id)?.name ?? "Unknown Qualification",
			sourceType: "qualification" as const,
			expires: false,
			requirementStatus: "required" as const,
			emsAuthority: null,
			emsCertificationLevel: null,
		}));

	return [...requiredCertifications, ...requiredQualifications];
}

export function applyCredentialRequirementStatus(params: {
	memberCredentials: MemberCredentialItem[];
	requiredCredentials: RequiredCredentialItem[];
}) {
	const requiredKeys = new Set(
		params.requiredCredentials.map((row) => `${row.sourceType}:${row.catalogId}`),
	);
	const requiredNames = new Set(
		params.requiredCredentials.map((row) => row.name.trim().toLowerCase()).filter((value) => value.length > 0),
	);

	return params.memberCredentials.map((row) => ({
		...row,
		requirementStatus: requiredKeys.has(`${row.sourceType}:${row.catalogId}`) || requiredNames.has(row.name.trim().toLowerCase())
			? "required"
			: "additional",
	}));
}

export function getCredentialWriteRouteForCreate(input: {
	expires: boolean;
	emsAuthority?: CredentialEmsAuthority | null;
}) {
	if (input.emsAuthority && !input.expires) {
		throw new Error("EMS certifications must remain expiring credentials.");
	}

	return "member_certifications";
}

export function getCredentialWriteRouteForExisting(input: {
	sourceType: CredentialSourceType;
	expires: boolean;
	emsAuthority?: CredentialEmsAuthority | null;
}) {
	const emsAuthority = input.emsAuthority ?? null;
	assertEmsSafety({
		sourceType: input.sourceType,
		expires: input.expires,
		emsAuthority,
	});

	if (input.sourceType === "certification") {
		return "member_certifications" as const;
	}

	return "member_qualifications" as const;
}
