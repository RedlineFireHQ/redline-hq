import { getCertificationStatus, type CertificationStatus } from "@/lib/readiness/member-readiness";
import { assertEmsLevelForTrack, isEmsCertificationLevel, type EmsCertificationLevel } from "@/lib/ems/requirements";

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
  certification_level: "emr" | "emt" | "aemt" | "paramedic" | "ccp";
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
  if (isEmsCertificationLevel(value)) {
    return value;
  }

  return null;
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
    const authority = normalizeAuthority(row.ems_authority);
    const level = normalizeLevel(row.ems_certification_level);
    if (authority && level) assertEmsLevelForTrack(authority, level);
    byId.set(row.id, {
      authority,
      level,
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

// EMS trackers are configured manually by authorized personnel (see
// PersonnelEmsTracksSection): certification number, level, issue/renewal date,
// and expiration live on the track profile itself. This function no longer
// overlays data from the general Personnel Certifications list - mixing ACLS,
// CPR, and other certifications into EMS CE tracking caused incorrect
// auto-configuration. It now only normalizes the stored profile (for example,
// marking a track expired once its stored expiration date passes). The
// authoritativeCertification parameter is retained for call-site compatibility
// and intentionally ignored.
export function applyAuthoritativeCertificationToTrackProfile(params: {
  track: EmsAuthority;
  profile: EmsTrackProfileAuthorityRow | null;
  authoritativeCertification: AuthoritativeEmsCertification | null;
}): EmsTrackProfileAuthorityRow | null {
  const { track, profile } = params;

  if (!profile) {
    return null;
  }

  const maintainTrack = track === "iowa" ? true : profile.maintain_track === true;

  // Date-based expiry is handled downstream (calculateEmsReadiness flags the
  // track and getCertificationStatus reports it); do not rewrite the stored
  // status here or completed-hour totals would be dropped.
  let trackStatus = profile.track_status;
  if (track === "nremt" && maintainTrack !== true) {
    trackStatus = "not_maintained";
  }

  return {
    ...profile,
    maintain_track: maintainTrack,
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
