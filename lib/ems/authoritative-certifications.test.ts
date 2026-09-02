import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoritativeCertificationToTrackProfile,
  buildCertificationTypeMetaById,
  resolveAuthoritativeEmsCertificationsForMember,
  resolveCertificationStatusFromTrack,
  type EmsTrackProfileAuthorityRow,
  type MemberCertificationAuthorityRow,
} from "@/lib/ems/authoritative-certifications";

function addDays(days: number) {
  const now = new Date();
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days);
  return new Date(utc).toISOString().slice(0, 10);
}

const certificationTypeMeta = buildCertificationTypeMetaById([
  { id: "iowa-emt", ems_authority: "iowa", ems_certification_level: "emt" },
  { id: "nremt-emt", ems_authority: "nremt", ems_certification_level: "emt" },
  { id: "generic-emtb", ems_authority: null, ems_certification_level: null },
  { id: "ff1", ems_authority: null, ems_certification_level: null },
]);

function resolve(memberCertifications: MemberCertificationAuthorityRow[]) {
  return resolveAuthoritativeEmsCertificationsForMember({
    memberCertifications,
    certificationTypeById: certificationTypeMeta,
  });
}

const iowaBaseTrack: EmsTrackProfileAuthorityRow = {
  track: "iowa",
  certification_level: "emt",
  track_status: "active",
  maintain_track: true,
  certification_number: "IA-TRACK-OLD",
  expiration_date: addDays(30),
  effective_start_date: "2026-01-01",
  effective_end_date: null,
};

const nremtBaseTrack: EmsTrackProfileAuthorityRow = {
  track: "nremt",
  certification_level: "emt",
  track_status: "active",
  maintain_track: true,
  certification_number: "NR-TRACK-OLD",
  expiration_date: addDays(30),
  effective_start_date: "2026-01-01",
  effective_end_date: null,
};

test("Iowa certification metadata is authoritative for number and expiration", () => {
  const authoritative = resolve([
    {
      member_id: "m1",
      certification_id: "iowa-emt",
      certificate_number: "IA-AUTH-100",
      issued_at: "2026-08-01",
      expires_at: addDays(120),
    },
    {
      member_id: "m1",
      certification_id: "generic-emtb",
      certificate_number: "EMTB-GENERIC-999",
      issued_at: "2026-08-15",
      expires_at: addDays(365),
    },
  ]);

  const projected = applyAuthoritativeCertificationToTrackProfile({
    track: "iowa",
    profile: iowaBaseTrack,
    authoritativeCertification: authoritative.iowa,
  });

  assert.ok(projected);
  assert.equal(projected.certification_number, "IA-AUTH-100");
  assert.equal(projected.expiration_date, authoritative.iowa?.expirationDate ?? null);
});

test("NREMT certification metadata is authoritative for number and expiration", () => {
  const authoritative = resolve([
    {
      member_id: "m1",
      certification_id: "nremt-emt",
      certificate_number: "NR-AUTH-200",
      issued_at: "2026-08-02",
      expires_at: addDays(90),
    },
  ]);

  const projected = applyAuthoritativeCertificationToTrackProfile({
    track: "nremt",
    profile: nremtBaseTrack,
    authoritativeCertification: authoritative.nremt,
  });

  assert.ok(projected);
  assert.equal(projected.certification_number, "NR-AUTH-200");
  assert.equal(projected.expiration_date, authoritative.nremt?.expirationDate ?? null);
});

test("Generic EMTB does not override Iowa or NREMT authoritative certifications", () => {
  const authoritative = resolve([
    {
      member_id: "m1",
      certification_id: "iowa-emt",
      certificate_number: "IA-AUTH-101",
      issued_at: "2026-08-01",
      expires_at: addDays(-1),
    },
    {
      member_id: "m1",
      certification_id: "nremt-emt",
      certificate_number: "NR-AUTH-201",
      issued_at: "2026-08-01",
      expires_at: addDays(-2),
    },
    {
      member_id: "m1",
      certification_id: "generic-emtb",
      certificate_number: "EMTB-GENERIC-OVERRIDE",
      issued_at: "2026-08-20",
      expires_at: addDays(365),
    },
  ]);

  const iowaProjected = applyAuthoritativeCertificationToTrackProfile({
    track: "iowa",
    profile: iowaBaseTrack,
    authoritativeCertification: authoritative.iowa,
  });
  const nremtProjected = applyAuthoritativeCertificationToTrackProfile({
    track: "nremt",
    profile: nremtBaseTrack,
    authoritativeCertification: authoritative.nremt,
  });

  assert.ok(iowaProjected);
  assert.ok(nremtProjected);
  assert.equal(iowaProjected.certification_number, "IA-AUTH-101");
  assert.equal(nremtProjected.certification_number, "NR-AUTH-201");

  const iowaStatus = resolveCertificationStatusFromTrack({
    track: iowaProjected,
    warningDays: 60,
    genericStatus: "current",
  });
  const nremtStatus = resolveCertificationStatusFromTrack({
    track: nremtProjected,
    warningDays: 60,
    genericStatus: "current",
  });

  assert.equal(iowaStatus, "expired");
  assert.equal(nremtStatus, "expired");
});

test("Updating authoritative expiration updates derived EMS status", () => {
  const currentCert = {
    member_id: "m1",
    certification_id: "iowa-emt",
    certificate_number: "IA-AUTH-102",
    issued_at: "2026-08-01",
    expires_at: addDays(100),
  } satisfies MemberCertificationAuthorityRow;

  const expiredCert = {
    ...currentCert,
    expires_at: addDays(-3),
  };

  const currentProjected = applyAuthoritativeCertificationToTrackProfile({
    track: "iowa",
    profile: iowaBaseTrack,
    authoritativeCertification: resolve([currentCert]).iowa,
  });
  const expiredProjected = applyAuthoritativeCertificationToTrackProfile({
    track: "iowa",
    profile: iowaBaseTrack,
    authoritativeCertification: resolve([expiredCert]).iowa,
  });

  assert.ok(currentProjected);
  assert.ok(expiredProjected);

  const currentStatus = resolveCertificationStatusFromTrack({
    track: currentProjected,
    warningDays: 60,
    genericStatus: "current",
  });
  const expiredStatus = resolveCertificationStatusFromTrack({
    track: expiredProjected,
    warningDays: 60,
    genericStatus: "current",
  });

  assert.equal(currentStatus, "current");
  assert.equal(expiredStatus, "expired");
});

test("NREMT not maintained does not create an Iowa failure", () => {
  const iowaProjected = applyAuthoritativeCertificationToTrackProfile({
    track: "iowa",
    profile: iowaBaseTrack,
    authoritativeCertification: resolve([
      {
        member_id: "m1",
        certification_id: "iowa-emt",
        certificate_number: "IA-AUTH-103",
        issued_at: "2026-08-01",
        expires_at: addDays(45),
      },
    ]).iowa,
  });

  const nremtNotMaintained = {
    ...nremtBaseTrack,
    maintain_track: false,
    track_status: "not_maintained" as const,
  };

  const iowaStatus = resolveCertificationStatusFromTrack({
    track: iowaProjected,
    warningDays: 60,
    genericStatus: "expired",
  });

  const nremtStatus = resolveCertificationStatusFromTrack({
    track: nremtNotMaintained,
    warningDays: 60,
    genericStatus: "current",
  });

  assert.equal(iowaStatus, "expiring_soon");
  assert.equal(nremtStatus, "expired");
});

test("Non-EMS certifications continue using generic status", () => {
  const genericStatus = resolveCertificationStatusFromTrack({
    track: null,
    warningDays: 60,
    genericStatus: "expiring_soon",
  });

  assert.equal(genericStatus, "expiring_soon");
});
