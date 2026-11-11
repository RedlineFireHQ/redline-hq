"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { triggerEmsAllocationRecalculation } from "@/lib/ems/recalculate-client";
import { supabase } from "@/lib/supabase";
import { getEmsCertificationLevels } from "@/lib/ems/requirements";

type EmsTrack = "iowa" | "nremt";
type EmsLevel = "emr" | "emt" | "aemt" | "paramedic" | "ccp";
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
  certificationNumber: string;
  issueDate: string;
  expirationDate: string;
  notes: string;
};

type RenewFormState = {
  certificationNumber: string;
  issueDate: string;
  expirationDate: string;
};

interface PersonnelEmsTracksSectionProps {
  departmentId: string | null;
  memberId: string;
  editorMemberId: string;
  trackRows: EmsTrackRow[];
  canManage: boolean;
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
      certificationNumber: "",
      issueDate: "",
      expirationDate: "",
      notes: "",
    };
  }

  return {
    level: row.certification_level,
    status: row.track_status,
    maintainTrack: row.maintain_track,
    certificationNumber: row.certification_number ?? "",
    issueDate: row.effective_start_date ?? "",
    expirationDate: row.expiration_date ?? "",
    notes: row.notes ?? "",
  };
}

function prettyTrack(track: EmsTrack) {
  return track === "iowa" ? "Iowa EMS" : "National Registry";
}

function formatDateOnly(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isTrackConfigured(row: EmsTrackRow | null) {
  return row !== null && Boolean(row.expiration_date) && Boolean(row.effective_start_date);
}

const TRACK_SELECT_COLUMNS =
  "id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date, notes";

function mapTrackRow(data: Record<string, unknown>, fallbackTrack: EmsTrack): EmsTrackRow {
  return {
    id: String(data.id),
    track: data.track === "nremt" ? "nremt" : data.track === "iowa" ? "iowa" : fallbackTrack,
    certification_level: (typeof data.certification_level === "string" ? data.certification_level : "emt") as EmsLevel,
    track_status: (typeof data.track_status === "string" ? data.track_status : "needs_review") as TrackStatus,
    maintain_track: data.maintain_track === true,
    certification_number: typeof data.certification_number === "string" ? data.certification_number : null,
    expiration_date: typeof data.expiration_date === "string" ? data.expiration_date : null,
    effective_start_date: typeof data.effective_start_date === "string" ? data.effective_start_date : todayDateKey(),
    effective_end_date: typeof data.effective_end_date === "string" ? data.effective_end_date : null,
    notes: typeof data.notes === "string" ? data.notes : null,
  };
}

export default function PersonnelEmsTracksSection({
  departmentId,
  memberId,
  editorMemberId,
  trackRows,
  canManage,
}: PersonnelEmsTracksSectionProps) {
  const router = useRouter();
  const [rows, setRows] = useState(trackRows);
  const [savingTrack, setSavingTrack] = useState<EmsTrack | null>(null);
  const [renewingTrack, setRenewingTrack] = useState<EmsTrack | null>(null);
  const [openRenewForm, setOpenRenewForm] = useState<EmsTrack | null>(null);
  const [renewForm, setRenewForm] = useState<RenewFormState>({ certificationNumber: "", issueDate: "", expirationDate: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const iowaRow = useMemo(
    () => rows.find((row) => row.track === "iowa" && row.effective_end_date === null) ?? null,
    [rows],
  );

  const nremtRow = useMemo(
    () => rows.find((row) => row.track === "nremt" && row.effective_end_date === null) ?? null,
    [rows],
  );

  const historyRows = useMemo(
    () =>
      rows
        .filter((row) => row.effective_end_date !== null)
        .sort((left, right) => (right.effective_start_date ?? "").localeCompare(left.effective_start_date ?? "")),
    [rows],
  );

  const [iowaForm, setIowaForm] = useState<TrackFormState>(initialTrackForm("iowa", iowaRow));
  const [nremtForm, setNremtForm] = useState<TrackFormState>(initialTrackForm("nremt", nremtRow));

  function validateForm(track: EmsTrack, form: TrackFormState): string | null {
    if (track === "nremt" && form.level === "ccp") {
      return "Critical Care Paramedic is an Iowa EMS level only and cannot be saved to the National Registry tracker.";
    }

    const activating = track === "nremt" ? form.maintainTrack && form.status === "active" : form.status === "active";
    if (activating && (!form.issueDate || !form.expirationDate)) {
      return `${prettyTrack(track)}: an issue/renewal date and expiration date are required before the tracker can be active.`;
    }

    if (form.issueDate && form.expirationDate && form.expirationDate <= form.issueDate) {
      return `${prettyTrack(track)}: the expiration date must be after the issue/renewal date.`;
    }

    return null;
  }

  async function saveTrack(track: EmsTrack, form: TrackFormState, existingRow: EmsTrackRow | null) {
    if (!departmentId) {
      setError("Department context is unavailable.");
      return;
    }

    const validationError = validateForm(track, form);
    if (validationError) {
      setError(validationError);
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
        certification_number: form.certificationNumber.trim() || null,
        effective_start_date: form.issueDate || todayDateKey(),
        expiration_date: form.expirationDate || null,
        notes: form.notes.trim() || null,
        updated_by: editorMemberId,
      };

      if (existingRow) {
        const { data, error: updateError } = await supabase
          .from("ems_member_track_profiles")
          .update(payload)
          .eq("id", existingRow.id)
          .eq("department_id", departmentId)
          .select(TRACK_SELECT_COLUMNS)
          .single();

        if (updateError || !data) {
          setError(updateError?.message || `Unable to update ${prettyTrack(track)} profile.`);
          setSavingTrack(null);
          return;
        }

        const updated = mapTrackRow(data as Record<string, unknown>, track);
        setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      } else {
        const { data, error: insertError } = await supabase
          .from("ems_member_track_profiles")
          .insert({ ...payload, created_by: editorMemberId })
          .select(TRACK_SELECT_COLUMNS)
          .single();

        if (insertError || !data) {
          setError(insertError?.message || `Unable to create ${prettyTrack(track)} profile.`);
          setSavingTrack(null);
          return;
        }

        setRows((current) => [...current, mapTrackRow(data as Record<string, unknown>, track)]);
      }

      setSuccess(`${prettyTrack(track)} tracker saved.`);
      await triggerEmsAllocationRecalculation(memberId);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Unable to save ${prettyTrack(track)} profile.`);
    } finally {
      setSavingTrack(null);
    }
  }

  // Renewal closes the current cycle and starts a fresh one. The previous
  // cycle row is preserved (effective_end_date set) so its history remains
  // reviewable, and current-cycle hours restart from the new issue date.
  async function renewTrack(track: EmsTrack, existingRow: EmsTrackRow | null) {
    if (!departmentId) {
      setError("Department context is unavailable.");
      return;
    }

    if (!existingRow) {
      setError(`${prettyTrack(track)}: set up the tracker before recording a renewal.`);
      return;
    }

    if (!renewForm.issueDate || !renewForm.expirationDate) {
      setError(`${prettyTrack(track)}: a renewal requires the new issue/renewal date and new expiration date.`);
      return;
    }

    if (renewForm.expirationDate <= renewForm.issueDate) {
      setError(`${prettyTrack(track)}: the new expiration date must be after the new issue/renewal date.`);
      return;
    }

    setRenewingTrack(track);
    setError(null);
    setSuccess(null);

    try {
      const { error: closeError } = await supabase
        .from("ems_member_track_profiles")
        .update({ effective_end_date: renewForm.issueDate, updated_by: editorMemberId })
        .eq("id", existingRow.id)
        .eq("department_id", departmentId)
        .is("effective_end_date", null);

      if (closeError) {
        setError(closeError.message || `Unable to close the current ${prettyTrack(track)} cycle.`);
        setRenewingTrack(null);
        return;
      }

      const { data, error: insertError } = await supabase
        .from("ems_member_track_profiles")
        .insert({
          department_id: departmentId,
          member_id: memberId,
          track,
          certification_level: existingRow.certification_level,
          track_status: "active",
          maintain_track: track === "iowa" ? true : existingRow.maintain_track,
          certification_number: renewForm.certificationNumber.trim() || existingRow.certification_number,
          effective_start_date: renewForm.issueDate,
          expiration_date: renewForm.expirationDate,
          notes: existingRow.notes,
          created_by: editorMemberId,
          updated_by: editorMemberId,
        })
        .select(TRACK_SELECT_COLUMNS)
        .single();

      if (insertError || !data) {
        setError(insertError?.message || `Unable to start the new ${prettyTrack(track)} cycle.`);
        setRenewingTrack(null);
        return;
      }

      const inserted = mapTrackRow(data as Record<string, unknown>, track);
      setRows((current) => [
        ...current.map((row) => (row.id === existingRow.id ? { ...row, effective_end_date: renewForm.issueDate } : row)),
        inserted,
      ]);

      const updatedForm = initialTrackForm(track, inserted);
      if (track === "iowa") {
        setIowaForm(updatedForm);
      } else {
        setNremtForm(updatedForm);
      }

      setOpenRenewForm(null);
      setRenewForm({ certificationNumber: "", issueDate: "", expirationDate: "" });
      setSuccess(`${prettyTrack(track)} certification renewed. A new cycle has started.`);
      await triggerEmsAllocationRecalculation(memberId);
      router.refresh();
    } catch (renewError) {
      setError(renewError instanceof Error ? renewError.message : `Unable to renew ${prettyTrack(track)}.`);
    } finally {
      setRenewingTrack(null);
    }
  }

  function renderSummary(track: EmsTrack, row: EmsTrackRow | null) {
    if (!isTrackConfigured(row)) {
      return (
        <div className="mt-3 rounded-lg border border-dashed border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-neutral-400">
          Not Set Up{row ? " — missing issue/renewal or expiration date." : "."}
          {canManage ? " Enter the certification details below to start cycle tracking." : " An authorized member can set up this tracker."}
        </div>
      );
    }

    return (
      <div className="mt-3 grid gap-1 rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-neutral-300">
        <p>Number: {row?.certification_number || "-"}</p>
        <p>Cycle: {formatDateOnly(row?.effective_start_date ?? null)} → {formatDateOnly(row?.expiration_date ?? null)}</p>
      </div>
    );
  }

  function renderRenewControls(track: EmsTrack, row: EmsTrackRow | null) {
    if (!canManage || !row) {
      return null;
    }

    if (openRenewForm !== track) {
      return (
        <button
          type="button"
          onClick={() => {
            setOpenRenewForm(track);
            setRenewForm({ certificationNumber: row.certification_number ?? "", issueDate: "", expirationDate: "" });
          }}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
        >
          Renew Certification
        </button>
      );
    }

    return (
      <div className="mt-3 w-full rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
        <p className="text-sm font-semibold text-emerald-100">Renew {prettyTrack(track)} certification</p>
        <p className="mt-1 text-xs text-neutral-400">
          This closes the current cycle on the new issue date and starts a fresh cycle. Previous-cycle hours do not carry forward.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-neutral-300">
            New certification number
            <input
              value={renewForm.certificationNumber}
              onChange={(event) => setRenewForm((current) => ({ ...current, certificationNumber: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            />
          </label>
          <label className="text-xs text-neutral-300">
            New issue/renewal date
            <input
              type="date"
              value={renewForm.issueDate}
              onChange={(event) => setRenewForm((current) => ({ ...current, issueDate: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            />
          </label>
          <label className="text-xs text-neutral-300">
            New expiration date
            <input
              type="date"
              value={renewForm.expirationDate}
              onChange={(event) => setRenewForm((current) => ({ ...current, expirationDate: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpenRenewForm(null)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-neutral-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void renewTrack(track, row)}
            disabled={renewingTrack === track}
            className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
          >
            {renewingTrack === track ? "Renewing..." : "Start New Cycle"}
          </button>
        </div>
      </div>
    );
  }

  function renderTrackFields(
    track: EmsTrack,
    form: TrackFormState,
    setForm: React.Dispatch<React.SetStateAction<TrackFormState>>,
  ) {
    return (
      <div className="mt-4 grid gap-3">
        <label className="text-sm text-neutral-300">
          Level
          <select
            value={form.level}
            onChange={(event) => setForm((current) => ({ ...current, level: event.target.value as EmsLevel }))}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
          >
            {getEmsCertificationLevels(track).map((level) => <option key={level.code} value={level.code}>{level.label}</option>)}
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Status
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TrackStatus }))}
            disabled={track === "nremt" && !form.maintainTrack}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white disabled:opacity-60"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expired">Expired</option>
            {track === "nremt" ? <option value="not_maintained">Not Maintained</option> : null}
            <option value="needs_review">Needs Review</option>
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Certification number
          <input
            value={form.certificationNumber}
            onChange={(event) => setForm((current) => ({ ...current, certificationNumber: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-neutral-300">
            Issue/renewal date
            <input
              type="date"
              value={form.issueDate}
              onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-neutral-300">
            Expiration date
            <input
              type="date"
              value={form.expirationDate}
              onChange={(event) => setForm((current) => ({ ...current, expirationDate: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            />
          </label>
        </div>

        <label className="text-sm text-neutral-300">
          Notes
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
          />
        </label>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="border-b border-neutral-800 pb-5">
        <h2 className="text-2xl font-semibold text-white">EMS Certification Tracks</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Iowa EMS and National Registry are tracked separately with their own certification numbers, issue/renewal dates, expirations, and CE cycles. Trackers are configured manually by authorized personnel; they do not pull from the general Personnel Certifications list.
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
          {renderSummary("iowa", iowaRow)}

          {canManage ? (
            <>
              {renderTrackFields("iowa", iowaForm, setIowaForm)}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                {renderRenewControls("iowa", iowaRow)}
                <button
                  type="button"
                  onClick={() => void saveTrack("iowa", iowaForm, iowaRow)}
                  disabled={savingTrack === "iowa"}
                  className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                >
                  {savingTrack === "iowa" ? "Saving..." : "Save Iowa"}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
          <h3 className="text-lg font-semibold text-white">National Registry (Optional)</h3>
          {renderSummary("nremt", nremtRow)}

          {canManage ? (
            <>
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

              {renderTrackFields("nremt", nremtForm, setNremtForm)}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                {renderRenewControls("nremt", nremtRow)}
                <button
                  type="button"
                  onClick={() => void saveTrack("nremt", nremtForm, nremtRow)}
                  disabled={savingTrack === "nremt"}
                  className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                >
                  {savingTrack === "nremt" ? "Saving..." : "Save NREMT"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {historyRows.length > 0 ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-[#111111] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">Previous Certification Cycles</h3>
          <div className="mt-3 space-y-2">
            {historyRows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
                <span className="font-semibold text-white">{prettyTrack(row.track)}</span>
                <span>{row.certification_level.toUpperCase()}</span>
                <span>Number: {row.certification_number || "-"}</span>
                <span>
                  {formatDateOnly(row.effective_start_date)} → {formatDateOnly(row.effective_end_date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
