import type { EmsCertificationLevel } from "@/lib/ems/requirements";
import { getCertificationStatus, type CertificationStatus } from "@/lib/readiness/member-readiness";

export type EmsTrackProfileSummary = {
  track: "iowa" | "nremt";
  certification_level: EmsCertificationLevel;
  track_status: "active" | "inactive" | "expired" | "not_maintained" | "needs_review";
  maintain_track: boolean;
  certification_number: string | null;
  expiration_date: string | null;
  effective_end_date: string | null;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function containsWord(value: string, token: string) {
  return new RegExp(`\\b${token}\\b`, "i").test(value);
}

function inferEmsAuthority(name: string): "iowa" | "nremt" | null {
  const normalized = normalize(name);

  if (normalized.includes("nremt") || normalized.includes("national registry")) {
    return "nremt";
  }

  if (normalized.includes("iowa")) {
    return "iowa";
  }

  if (
    normalized.includes("paramedic") ||
    normalized.includes("advanced emt") ||
    normalized.includes("aemt") ||
    normalized.includes("emtb") ||
    normalized.includes("emt-b") ||
    containsWord(normalized, "emt") ||
    containsWord(normalized, "emr") ||
    normalized.includes("emergency medical responder")
  ) {
    return "iowa";
  }

  return null;
}

function inferEmsLevel(name: string): EmsCertificationLevel | null {
  const normalized = normalize(name);

  if (normalized.includes("paramedic")) {
    return "paramedic";
  }

  if (normalized.includes("advanced emt") || normalized.includes("aemt")) {
    return "aemt";
  }

  if (normalized.includes("emtb") || normalized.includes("emt-b") || containsWord(normalized, "emt")) {
    return "emt";
  }

  if (containsWord(normalized, "emr") || normalized.includes("emergency medical responder")) {
    return "emr";
  }

  return null;
}

function isDateInPast(value: string | null) {
  if (!value) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed.getTime() < today.getTime();
}

export function isEmsCertificationName(name: string) {
  return inferEmsAuthority(name) !== null;
}

export function selectCurrentEmsTrackProfile(
  profiles: EmsTrackProfileSummary[],
  track: "iowa" | "nremt",
): EmsTrackProfileSummary | null {
  return (
    profiles.find((profile) => profile.track === track && profile.effective_end_date === null) ??
    profiles.find((profile) => profile.track === track) ??
    null
  );
}

export function resolveCertificationStatusFromAuthority(params: {
  certificationName: string;
  genericStatus: CertificationStatus;
  warningDays: number;
  iowaProfile: EmsTrackProfileSummary | null;
  nremtProfile: EmsTrackProfileSummary | null;
}): CertificationStatus {
  const authority = inferEmsAuthority(params.certificationName);
  if (!authority) {
    return params.genericStatus;
  }

  const profile = authority === "nremt" ? params.nremtProfile : params.iowaProfile;
  if (!profile) {
    return "expired";
  }

  const requiredLevel = inferEmsLevel(params.certificationName);
  if (requiredLevel && profile.certification_level !== requiredLevel) {
    return "expired";
  }

  return getTrackCertificationStatus(profile, params.warningDays);
}

export function getTrackCertificationStatus(
  profile: EmsTrackProfileSummary,
  warningDays: number,
): CertificationStatus {
  if (profile.track === "nremt" && profile.maintain_track !== true) {
    return "expired";
  }

  if (profile.track_status !== "active") {
    return "expired";
  }

  if (isDateInPast(profile.effective_end_date)) {
    return "expired";
  }

  return getCertificationStatus(profile.expiration_date, warningDays);
}
