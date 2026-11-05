import type { CertificationStatus } from "@/lib/readiness/member-readiness";
import { createCertificationResolver, type CanonicalCertification } from "@/lib/credentials/canonical-certifications";

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
	includeNonExpiringRoleRequirements?: boolean;
	certificationNameById?: Map<string, string>;
	certificationCatalog?: Array<CanonicalCertification & { name?: string }>;
}) {
	const selectedIds = new Set<string>();
	const selected: Array<{ certificationId: string; certificationName: string; status: CertificationStatus }> = [];
	const resolve = createCertificationResolver(params.certificationCatalog ?? []);
	const canonicalNameById = new Map((params.certificationCatalog ?? []).map(row => [row.id, row.name]));
	const byId = new Map<string, CertificationStatusInput>();
	const priority = { expired: 0, expiring_soon: 1, current: 2 };
	for (const row of params.certificationStatuses) {
		const id = resolve(row.certificationId);
		const previous = byId.get(id);
		if (!previous || priority[row.status] > priority[previous.status] ||
			(row.status === previous.status && row.expiresAt === null)) byId.set(id, row);
	}

	for (const row of params.roleRequiredCertifications) {
		if (!params.memberDepartmentRoleId || row.department_role_id !== params.memberDepartmentRoleId) {
			continue;
		}

		const certificationId = resolve(row.certification_id);
		if (selectedIds.has(certificationId)) {
			continue;
		}

		const existing = byId.get(certificationId);
		if (existing?.expiresAt === null && !params.includeNonExpiringRoleRequirements) {
			continue;
		}
		selectedIds.add(certificationId);
		selected.push({
			certificationId,
			certificationName:
				params.certificationNameById?.get(certificationId) ??
				canonicalNameById.get(certificationId) ??
				existing?.certificationName ??
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