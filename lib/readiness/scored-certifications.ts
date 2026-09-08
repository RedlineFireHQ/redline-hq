import type { CertificationStatus } from "@/lib/readiness/member-readiness";

type EmsAuthority = "iowa" | "nremt";

export type CertificationStatusInput = {
	certificationId: string;
	certificationName: string;
	status: CertificationStatus;
	authority: EmsAuthority | null;
	expiresAt?: string | null;
};

export type RoleRequiredCertificationScopeRow = {
	department_role_id: string;
	certification_id: string;
};

export function buildScoredCertificationStatuses(params: {
	memberDepartmentRoleId: string | null;
	certificationStatuses: CertificationStatusInput[];
	roleRequiredCertifications: RoleRequiredCertificationScopeRow[];
	includeIowaAuthority: boolean;
	includeNremtAuthority: boolean;
	certificationNameById?: Map<string, string>;
}) {
	const selectedIds = new Set<string>();
	const selected: Array<{ certificationId: string; certificationName: string; status: CertificationStatus }> = [];
	const byId = new Map(params.certificationStatuses.map((row) => [row.certificationId, row]));

	for (const row of params.roleRequiredCertifications) {
		if (!params.memberDepartmentRoleId || row.department_role_id !== params.memberDepartmentRoleId) {
			continue;
		}

		if (selectedIds.has(row.certification_id)) {
			continue;
		}

		const existing = byId.get(row.certification_id);
		if (existing?.expiresAt === null) {
			continue;
		}
		selectedIds.add(row.certification_id);
		selected.push({
			certificationId: row.certification_id,
			certificationName:
				existing?.certificationName ??
				params.certificationNameById?.get(row.certification_id) ??
				"Certification",
			status: existing?.status ?? "expired",
		});
	}

	for (const row of params.certificationStatuses) {
		const includeAuthority =
			(row.authority === "iowa" && params.includeIowaAuthority) ||
			(row.authority === "nremt" && params.includeNremtAuthority);

		if (!includeAuthority || row.expiresAt === null || selectedIds.has(row.certificationId)) {
			continue;
		}

		selectedIds.add(row.certificationId);
		selected.push({
			certificationId: row.certificationId,
			certificationName: row.certificationName,
			status: row.status,
		});
	}

	return selected;
}