export type CanonicalCertification = {
  id: string;
  department_id?: string;
  canonical_certification_id?: string | null;
};

export function createCertificationResolver(catalog: readonly CanonicalCertification[]) {
  const byId = new Map(catalog.map((row) => [row.id, row]));
  return (id: string): string => {
    const row = byId.get(id);
    if (!row?.canonical_certification_id) return id;
    const target = byId.get(row.canonical_certification_id);
    if (!target || target.canonical_certification_id || target.id === id ||
      (!row.department_id || row.department_id !== target.department_id)) {
      throw new Error("Invalid department certification mapping. Contact an administrator.");
    }
    return target.id;
  };
}

export function isSelectableCertification(row: CanonicalCertification & { active: boolean | null }) {
  return row.active !== false && !row.canonical_certification_id;
}

export type CertificationDetail = {
  edition_details: string;
  source_reference: string | null;
};

export type CertificationDetailsRelation = CertificationDetail | CertificationDetail[] | null;

export function certificationDetailText(details: CertificationDetailsRelation | undefined) {
  return (Array.isArray(details) ? details[0] : details)?.edition_details ?? "";
}

export function certificationDisplayName(name: string, details: CertificationDetailsRelation | undefined) {
  const detail = certificationDetailText(details);
  return detail ? `${name} (${detail})` : name;
}
