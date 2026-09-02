import assert from "node:assert/strict";
import test from "node:test";

import {
  getTrackCertificationStatus,
  isEmsCertificationName,
  resolveCertificationStatusFromAuthority,
  selectCurrentEmsTrackProfile,
  type EmsTrackProfileSummary,
} from "@/lib/ems/certification-authority";

const activeIowaEmt: EmsTrackProfileSummary = {
  track: "iowa",
  certification_level: "emt",
  track_status: "active",
  maintain_track: true,
  certification_number: "EMT123",
  expiration_date: "2030-01-01",
  effective_end_date: null,
};

const activeNremtEmt: EmsTrackProfileSummary = {
  track: "nremt",
  certification_level: "emt",
  track_status: "active",
  maintain_track: true,
  certification_number: "NREMT123",
  expiration_date: "2030-01-01",
  effective_end_date: null,
};

test("detects EMS certification names", () => {
  assert.equal(isEmsCertificationName("EMTB"), true);
  assert.equal(isEmsCertificationName("Iowa EMT"), true);
  assert.equal(isEmsCertificationName("NREMT EMT"), true);
  assert.equal(isEmsCertificationName("Firefighter I"), false);
});

test("resolves Iowa EMS-like generic certification from Iowa track", () => {
  const status = resolveCertificationStatusFromAuthority({
    certificationName: "EMTB",
    genericStatus: "current",
    warningDays: 60,
    iowaProfile: activeIowaEmt,
    nremtProfile: activeNremtEmt,
  });

  assert.equal(status, "current");
});

test("resolves NREMT certification from NREMT track", () => {
  const status = resolveCertificationStatusFromAuthority({
    certificationName: "NREMT EMT",
    genericStatus: "current",
    warningDays: 60,
    iowaProfile: activeIowaEmt,
    nremtProfile: activeNremtEmt,
  });

  assert.equal(status, "current");
});

test("generic EMTB does not override expired Iowa track", () => {
  const status = resolveCertificationStatusFromAuthority({
    certificationName: "EMTB",
    genericStatus: "current",
    warningDays: 60,
    iowaProfile: {
      ...activeIowaEmt,
      expiration_date: "2000-01-01",
    },
    nremtProfile: activeNremtEmt,
  });

  assert.equal(status, "expired");
});

test("non-EMS certifications continue using generic member_certifications status", () => {
  const status = resolveCertificationStatusFromAuthority({
    certificationName: "Firefighter I",
    genericStatus: "expiring_soon",
    warningDays: 60,
    iowaProfile: activeIowaEmt,
    nremtProfile: activeNremtEmt,
  });

  assert.equal(status, "expiring_soon");
});

test("NREMT maintained false returns expired certification status", () => {
  const status = getTrackCertificationStatus(
    {
      ...activeNremtEmt,
      maintain_track: false,
    },
    60,
  );

  assert.equal(status, "expired");
});

test("selectCurrentEmsTrackProfile prefers active profile with open effective range", () => {
  const profiles: EmsTrackProfileSummary[] = [
    {
      ...activeIowaEmt,
      certification_number: "OLD",
      effective_end_date: "2025-12-31",
    },
    activeIowaEmt,
  ];

  const selected = selectCurrentEmsTrackProfile(profiles, "iowa");
  assert.ok(selected);
  assert.equal(selected.certification_number, "EMT123");
});
