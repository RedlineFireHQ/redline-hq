"use client";

import { getEmsCertificationLevels, isEmsCertificationLevel } from "@/lib/ems/requirements";
import type { EmsCertificationSelection } from "@/lib/ems/certification-selection";

export default function EmsCertificationFields({
  value,
  onChange,
}: {
  value: EmsCertificationSelection;
  onChange: (selection: EmsCertificationSelection) => void;
}) {
  return (
    <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
      <label className="block text-sm text-neutral-300">
        Authority
        <select
          aria-label="Authority"
          value={value.emsAuthority}
          onChange={(event) => {
            const authority = event.target.value;
            if (authority === "" || authority === "iowa" || authority === "nremt") {
              onChange({
                emsAuthority: authority,
                emsLevel: !authority ? "" : authority === "nremt" && value.emsLevel === "ccp" ? "" : value.emsLevel || "emt",
              });
            }
          }}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
        >
          <option value="">Not an EMS certification</option>
          <option value="iowa">Iowa EMS</option>
          <option value="nremt">National Registry</option>
        </select>
      </label>
      {value.emsAuthority ? (
        <label className="block text-sm text-neutral-300">
          Certification Level
          <select
            aria-label="Certification Level"
            value={value.emsLevel}
            required
            onChange={(event) => {
              if (isEmsCertificationLevel(event.target.value) && (value.emsAuthority === "iowa" || event.target.value !== "ccp")) {
                onChange({ ...value, emsLevel: event.target.value });
              }
            }}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
          >
            <option value="">Select certification level</option>
            {getEmsCertificationLevels(value.emsAuthority).map((level) => <option key={level.code} value={level.code}>{level.label}</option>)}
          </select>
        </label>
      ) : null}
      {value.emsAuthority ? <p className="text-xs text-neutral-400 md:col-span-2">The selected authority and level determine EMS continuing education requirements, independently of the certification name.</p> : null}
    </div>
  );
}
