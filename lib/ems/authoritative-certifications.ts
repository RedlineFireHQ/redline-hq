import { getCertificationStatus, type CertificationStatus } from "@/lib/readiness/member-readiness";
import type { EmsCertificationLevel } from "@/lib/ems/requirements";

export type EmsAuthority = "iowa" | "nremt";

export type CertificationTypeEmsMeta = {
  id: string;
  ems_authority: string | null;
  ems_certification_level: string | null;
};

export type MemberCertificationAuthorityRow = {
  member_id: string;
  certification_id: string;
  certificate_number: string | null;
  expires_at: string | null;
  issued_at: string;
};

export type EmsTrackProfileAuthorityRow = {
  track: "iowa" | "nremt";
  certification_level: "emr" | "emt" | "aemt" | "paramedic";
  track_status: "active" | "inactive" | "expired" | "not_maintained" | "needs_review";
  maintain_track: boolean;
  certification_number: string | null;
  expiration_date: string | null;
  effective_start_date: string;
  effective_end_date: string | null;
};

export type AuthoritativeEmsCertification = {
  authority: EmsAuthority;
  level: EmsCertificationLevel;
  certificationNumber: string | null;
  expirationDate: string | null;
  issuedAt: string;
};

function normalizeAuthority(value: string | null): EmsAuthority | null {
  if (value === "iowa" || value === "nremt") {
    return value;
  }

  return null;
}

function normalizeLevel(value: string | null): EmsCertificationLevel | null {
  if (value === "emr" || value === "emt" || value === "aemt" || value === "paramedic") {
    return value;
  }

  return null;
}

function isExpired(dateValue: string | null) {
  if (!dateValue) {
    return false;
  }

  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed.getTime() < today.getTime();
}

function isLaterDate(left: string, right: string) {
  const leftTs = Date.parse(left);
  const rightTs = Date.parse(right);
  if (!Number.isFinite(leftTs) || !Number.isFinite(rightTs)) {
    return left > right;
  }

  return leftTs > rightTs;
}

export function buildCertificationTypeMetaById(rows: CertificationTypeEmsMeta[]) {
  const byId = new Map<string, { authority: EmsAuthority | null; level: EmsCertificationLevel | null }>();
  for (const row of rows) {
    byId.set(row.id, {
      authority: normalizeAuthority(row.ems_authority),
      level: normalizeLevel(row.ems_certification_level),
    });
  }

  return byId;
}

export function findCurrentTrackProfile(
  profiles: EmsTrackProfileAuthorityRow[],
  track: EmsAuthority,
): EmsTrackProfileAuthorityRow | null {
  return (
    profiles.find((profile) => profile.track === track && profile.effective_end_date === null) ??
    profiles.find((profile) => profile.track === track) ??
    null
  );
}

export function resolveAuthoritativeEmsCertificationsForMember(params: {
  memberCertifications: MemberCertificationAuthorityRow[];
  certificationTypeById: Map<string, { authority: EmsAuthority | null; level: EmsCertificationLevel | null }>;
}) {
  const bestByAuthority = new Map<EmsAuthority, AuthoritativeEmsCertification>();

  for (const cert of params.memberCertifications) {
    const meta = params.certificationTypeById.get(cert.certification_id);
    if (!meta?.authority || !meta.level) {
      continue;
    }

    const candidate: AuthoritativeEmsCertification = {
      authority: meta.authority,
      level: meta.level,
      certificationNumber: cert.certificate_number,
      expirationDate: cert.expires_at,
      issuedAt: cert.issued_at,
    };

    const existing = bestByAuthority.get(meta.authority);
    if (!existing) {
      bestByAuthority.set(meta.authority, candidate);
      continue;
    }

    if (isLaterDate(candidate.issuedAt, existing.issuedAt)) {
      bestByAuthority.set(meta.authority, candidate);
    }
  }

  return {
    iowa: bestByAuthority.get("iowa") ?? null,
    nremt: bestByAuthority.get("nremt") ?? null,
  };
}

export function applyAuthoritativeCertificationToTrackProfile(params: {
  track: EmsAuthority;
  profile: EmsTrackProfileAuthorityRow | null;
  authoritativeCertification: AuthoritativeEmsCertification | null;
}): EmsTrackProfileAuthorityRow | null {
  const { track, profile, authoritativeCertification } = params;

  if (!profile && !authoritativeCertification) {
    return null;
  }

  const base = profile ?? {
    track,
    certification_level: authoritativeCertification?.level ?? "emt",
    track_status: authoritativeCertification ? "active" : track === "nremt" ? "not_maintained" : "inactive",
    maintain_track: track === "iowa" || authoritativeCertification !== null,
    certification_number: null,
    expiration_date: null,
    effective_start_date: authoritativeCertification?.issuedAt ?? new Date().toISOString().slice(0, 10),
    effective_end_date: null,
  };

  const maintainTrack = track === "iowa" ? true : base.maintain_track === true;
  const expirationDate = authoritativeCertification?.expirationDate ?? base.expiration_date;
  const certificationLevel = authoritativeCertification?.level ?? base.certification_level;
  const certificationNumber = authoritativeCertification?.certificationNumber ?? base.certification_number;

  let trackStatus = base.track_status;
  if (track === "nremt" && maintainTrack !== true) {
    trackStatus = "not_maintained";
  } else if (authoritativeCertification) {
    if (isExpired(expirationDate)) {
      trackStatus = "expired";
    } else if (!profile || trackStatus === "expired") {
      trackStatus = "active";
    }
  }

  return {
    ...base,
    maintain_track: maintainTrack,
    certification_level: certificationLevel,
    certification_number: certificationNumber,
    expiration_date: expirationDate,
    track_status: trackStatus,
  };
}

export function resolveCertificationStatusFromTrack(params: {
  track: EmsTrackProfileAuthorityRow | null;
  warningDays: number;
  genericStatus: CertificationStatus;
}): CertificationStatus {
  if (!params.track) {
    return params.genericStatus;
  }

  if (params.track.track === "nremt" && params.track.maintain_track !== true) {
    return "expired";
  }

  if (params.track.track_status !== "active") {
    return "expired";
  }

  return getCertificationStatus(params.track.expiration_date, params.warningDays);
}
