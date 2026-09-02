"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { triggerEmsAllocationRecalculation } from "@/lib/ems/recalculate-client";
import { supabase } from "@/lib/supabase";

type EmsTrack = "iowa" | "nremt";
type EmsLevel = "emr" | "emt" | "aemt" | "paramedic";
type TrackStatus = "active" | "inactive" | "expired" | "not_maintained" | "needs_review";

type EmsTrackRow = {
  id: string;
  track: EmsTrack;
  certification_level: EmsLevel;
  track_status: TrackStatus;
  maintain_track: boolean;
  certification_number: string | null;
  expiration_date: string | null;
  effective_start_date: string;
  effective_end_date: string | null;
  notes: string | null;
};

type TrackFormState = {
  level: EmsLevel;
  status: TrackStatus;
  maintainTrack: boolean;
  notes: string;
};

interface PersonnelEmsTracksSectionProps {
  departmentId: string | null;
  memberId: string;
  editorMemberId: string;
  trackRows: EmsTrackRow[];
}

function todayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function initialTrackForm(track: EmsTrack, row: EmsTrackRow | null): TrackFormState {
  if (!row) {
    return {
      level: "emt",
      status: track === "nremt" ? "not_maintained" : "active",
      maintainTrack: track === "iowa",
      notes: "",
    };
  }

  return {
    level: row.certification_level,
    status: row.track_status,
    maintainTrack: row.maintain_track,
    notes: row.notes ?? "",
  };
}

function prettyTrack(track: EmsTrack) {
  return track === "iowa" ? "Iowa EMS" : "National Registry";
}

export default function PersonnelEmsTracksSection({
  departmentId,
  memberId,
  editorMemberId,
  trackRows,
}: PersonnelEmsTracksSectionProps) {
  const router = useRouter();
  const [rows, setRows] = useState(trackRows);
  const [savingTrack, setSavingTrack] = useState<EmsTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const iowaRow = useMemo(
    () => rows.find((row) => row.track === "iowa" && row.effective_end_date === null) ?? rows.find((row) => row.track === "iowa") ?? null,
    [rows],
  );

  const nremtRow = useMemo(
    () => rows.find((row) => row.track === "nremt" && row.effective_end_date === null) ?? rows.find((row) => row.track === "nremt") ?? null,
    [rows],
  );

  const [iowaForm, setIowaForm] = useState<TrackFormState>(initialTrackForm("iowa", iowaRow));
  const [nremtForm, setNremtForm] = useState<TrackFormState>(initialTrackForm("nremt", nremtRow));

  async function saveTrack(track: EmsTrack, form: TrackFormState, existingRow: EmsTrackRow | null) {
    if (!departmentId) {
      setError("Department context is unavailable.");
      return;
    }

    setSavingTrack(track);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        department_id: departmentId,
        member_id: memberId,
        track,
        certification_level: form.level,
        track_status: track === "nremt" && !form.maintainTrack ? "not_maintained" : form.status,
        maintain_track: track === "iowa" ? true : form.maintainTrack,
        notes: form.notes.trim() || null,
        updated_by: editorMemberId,
      };

      if (existingRow) {
        const { data, error: updateError } = await supabase
          .from("ems_member_track_profiles")
          .update(payload)
          .eq("id", existingRow.id)
          .eq("department_id", departmentId)
          .select("id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date, notes")
          .single();

        if (updateError || !data) {
          setError(updateError?.message || `Unable to update ${prettyTrack(track)} profile.`);
          setSavingTrack(null);
          return;
        }

        const updated: EmsTrackRow = {
          id: String(data.id),
          track: data.track === "nremt" ? "nremt" : "iowa",
          certification_level: data.certification_level as EmsLevel,
          track_status: data.track_status as TrackStatus,
          maintain_track: data.maintain_track === true,
          certification_number: typeof data.certification_number === "string" ? data.certification_number : null,
          expiration_date: typeof data.expiration_date === "string" ? data.expiration_date : null,
          effective_start_date: typeof data.effective_start_date === "string" ? data.effective_start_date : todayDateKey(),
          effective_end_date: typeof data.effective_end_date === "string" ? data.effective_end_date : null,
          notes: typeof data.notes === "string" ? data.notes : null,
        };

        setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      } else {
        const { data, error: insertError } = await supabase
          .from("ems_member_track_profiles")
          .insert({
            ...payload,
            created_by: editorMemberId,
            effective_start_date: todayDateKey(),
          })
          .select("id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date, notes")
          .single();

        if (insertError || !data) {
          setError(insertError?.message || `Unable to create ${prettyTrack(track)} profile.`);
          setSavingTrack(null);
          return;
        }

        const inserted: EmsTrackRow = {
          id: String(data.id),
          track: data.track === "nremt" ? "nremt" : "iowa",
          certification_level: data.certification_level as EmsLevel,
          track_status: data.track_status as TrackStatus,
          maintain_track: data.maintain_track === true,
          certification_number: typeof data.certification_number === "string" ? data.certification_number : null,
          expiration_date: typeof data.expiration_date === "string" ? data.expiration_date : null,
          effective_start_date: typeof data.effective_start_date === "string" ? data.effective_start_date : todayDateKey(),
          effective_end_date: typeof data.effective_end_date === "string" ? data.effective_end_date : null,
          notes: typeof data.notes === "string" ? data.notes : null,
        };

        setRows((current) => [inserted, ...current]);
      }

      setSuccess(`${prettyTrack(track)} profile saved.`);
      await triggerEmsAllocationRecalculation(memberId);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Unable to save ${prettyTrack(track)} profile.`);
    } finally {
      setSavingTrack(null);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="border-b border-neutral-800 pb-5">
        <h2 className="text-2xl font-semibold text-white">EMS Certification Tracks</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Track Iowa EMS and optional National Registry status for this member. Certification number and expiration are managed in Personnel Certifications and flow into EMS automatically.
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
          <h3 className="text-lg font-semibold text-white">Iowa EMS</h3>

          <div className="mt-4 grid gap-3">
            <label className="text-sm text-neutral-300">
              Level
              <select
                value={iowaForm.level}
                onChange={(event) => setIowaForm((current) => ({ ...current, level: event.target.value as EmsLevel }))}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              >
                <option value="emr">EMR</option>
                <option value="emt">EMT</option>
                <option value="aemt">AEMT</option>
                <option value="paramedic">Paramedic</option>
              </select>
            </label>

            <label className="text-sm text-neutral-300">
              Status
              <select
                value={iowaForm.status}
                onChange={(event) => setIowaForm((current) => ({ ...current, status: event.target.value as TrackStatus }))}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
                <option value="needs_review">Needs Review</option>
              </select>
            </label>

            <label className="text-sm text-neutral-300">
              <span className="block rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-400">
                Certification number and expiration are managed in Personnel Certifications.
              </span>
            </label>

            <label className="text-sm text-neutral-300">
              Notes
              <textarea
                rows={3}
                value={iowaForm.notes}
                onChange={(event) => setIowaForm((current) => ({ ...current, notes: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void saveTrack("iowa", iowaForm, iowaRow)}
              disabled={savingTrack === "iowa"}
              className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
            >
              {savingTrack === "iowa" ? "Saving..." : "Save Iowa"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
          <h3 className="text-lg font-semibold text-white">National Registry (Optional)</h3>

          <label className="mt-3 flex items-center gap-3 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={nremtForm.maintainTrack}
              onChange={(event) =>
                setNremtForm((current) => ({
                  ...current,
                  maintainTrack: event.target.checked,
                  status: event.target.checked ? (current.status === "not_maintained" ? "active" : current.status) : "not_maintained",
                }))
              }
            />
            Actively maintain National Registry
          </label>

          <div className="mt-4 grid gap-3">
            <label className="text-sm text-neutral-300">
              Level
              <select
                value={nremtForm.level}
                onChange={(event) => setNremtForm((current) => ({ ...current, level: event.target.value as EmsLevel }))}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              >
                <option value="emr">EMR</option>
                <option value="emt">EMT</option>
                <option value="aemt">AEMT</option>
                <option value="paramedic">Paramedic</option>
              </select>
            </label>

            <label className="text-sm text-neutral-300">
              Status
              <select
                value={nremtForm.status}
                onChange={(event) => setNremtForm((current) => ({ ...current, status: event.target.value as TrackStatus }))}
                disabled={!nremtForm.maintainTrack}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white disabled:opacity-60"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
                <option value="not_maintained">Not Maintained</option>
                <option value="needs_review">Needs Review</option>
              </select>
            </label>

            <label className="text-sm text-neutral-300">
              <span className="block rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-400">
                Registry number and expiration are managed in Personnel Certifications.
              </span>
            </label>

            <label className="text-sm text-neutral-300">
              Notes
              <textarea
                rows={3}
                value={nremtForm.notes}
                onChange={(event) => setNremtForm((current) => ({ ...current, notes: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void saveTrack("nremt", nremtForm, nremtRow)}
              disabled={savingTrack === "nremt"}
              className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
            >
              {savingTrack === "nremt" ? "Saving..." : "Save NREMT"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
