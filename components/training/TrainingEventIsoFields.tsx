"use client";

import { getFacilityIsoCreditLevel, type IsoTrainingClassification } from "@/lib/training/iso-training";

export type IsoTrainingFacilityOption = {
  id: string;
  name: string;
  facility_type: string;
  ownership_type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  tower_stories: number | null;
  yard_acres: number | null;
  purpose_built_live_fire: boolean;
  formal_agreement: boolean;
  agreement_reference: string | null;
  agreement_start_date: string | null;
  agreement_end_date: string | null;
  active: boolean;
};

export type IsoPrePlanOption = {
  id: string;
  business_name: string;
  address: string;
  city: string;
  state: string;
  iso_high_hazard: boolean;
  lifecycle_status: string;
};

interface Props {
  classifications: string[];
  onClassificationsChange: (next: string[]) => void;
  facilityId: string;
  onFacilityChange: (next: string) => void;
  facilities: IsoTrainingFacilityOption[];
  prePlanId: string;
  onPrePlanChange: (next: string) => void;
  prePlans: IsoPrePlanOption[];
  driverOperatorTrainingType: string;
  onDriverOperatorTrainingTypeChange: (next: string) => void;
  eventDate?: string;
  categoryName?: string;
  trainingTitle?: string;
  disabled?: boolean;
}

const fieldClass = "w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none";

const classifications: Array<{ code: Exclude<IsoTrainingClassification, "training_facilities">; label: string; detail: string; match: RegExp }> = [
  { code: "company_training", label: "Company Training", detail: "Company-level skills and routine fire-service drills.", match: /fire|hose|ladder|search|rescue|ventilation|forcible entry|company/ },
  { code: "officer_training", label: "Officer Training", detail: "Leadership, incident command, tactics, and fireground management.", match: /officer|leadership|command|ics|size.?up/ },
  { code: "driver_operator", label: "Driver / Operator", detail: "Apparatus driving, pump operations, hydraulics, and water supply.", match: /driver|operator|apparatus|pump|hydraulic|water supply/ },
  { code: "hazmat", label: "Hazardous Materials", detail: "HazMat awareness, operations, and annual refresher topics.", match: /hazmat|hazardous material|erg|decontamination/ },
  { code: "recruit", label: "Recruit Training", detail: "Structured initial training for qualifying new recruits.", match: /recruit|academy|firefighter i|basic training/ },
  { code: "building_familiarization", label: "Building Familiarization / Pre-Planning", detail: "On-site building visits and pre-incident planning.", match: /building familiarization|pre.?plan|property visit|building walk.?through|occupancy familiarization/ },
];

export default function TrainingEventIsoFields({
  classifications: selectedClassifications,
  onClassificationsChange,
  facilityId,
  onFacilityChange,
  facilities,
  prePlanId,
  onPrePlanChange,
  prePlans,
  driverOperatorTrainingType,
  onDriverOperatorTrainingTypeChange,
  eventDate,
  categoryName = "",
  trainingTitle = "",
  disabled = false,
}: Props) {
  const normalizedCategory = categoryName.trim().toLowerCase();
  const isFireTraining = normalizedCategory === "fire training";
  const selectedFacility = facilities.find((item) => item.id === facilityId) ?? null;
  const selectedPrePlan = prePlans.find((item) => item.id === prePlanId) ?? null;
  const facilitySelected = selectedClassifications.includes("training_facilities");
  const suggested = classifications.filter((item) => item.match.test(categoryName + " " + trainingTitle)).map((item) => item.code);

  function toggleClassification(code: IsoTrainingClassification, checked: boolean) {
    const next = selectedClassifications.filter((item) => item !== code);
    if (checked) next.push(code);
    onClassificationsChange(next);
  }

  const facilityCredit = selectedFacility ? getFacilityIsoCreditLevel(selectedFacility, eventDate) : "none";

  return (
    <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4 md:p-5">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">ISO Documentation</div>
        <h3 className="mt-1 text-lg font-semibold text-white">ISO / PPC qualifications for this training</h3>
        <p className="mt-1 text-sm text-neutral-400">Select every ISO classification this one training event qualifies for. These are separate from the regular training category and do not create duplicate records or hours.</p>
      </div>

      {suggested.length > 0 ? (
        <p className="mt-3 text-xs text-sky-200">Possible match based on the title or category: {classifications.filter((item) => suggested.includes(item.code)).map((item) => item.label).join(", ")}. Confirm the classifications that actually apply.</p>
      ) : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {classifications.map((item) => (
          <label key={item.code} className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-white/[0.04]">
            <input type="checkbox" disabled={disabled} checked={selectedClassifications.includes(item.code)} onChange={(event) => toggleClassification(item.code, event.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">{item.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-neutral-400">{item.detail}</span>
            </span>
          </label>
        ))}
      </div>

      {isFireTraining ? (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" disabled={disabled} checked={facilitySelected} onChange={(event) => toggleClassification("training_facilities", event.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
            <span>
              <span className="block text-sm font-semibold text-white">This Fire Training event also took place at an ISO-qualifying training facility</span>
              <span className="mt-1 block text-xs leading-relaxed text-neutral-400">Facility credit is additional to Company Training. Routine station drills do not qualify. The facility must meet the documented ISO criteria for the event date.</span>
            </span>
          </label>
          {facilitySelected ? (
            <div className="mt-3">
              <label className="block text-sm font-semibold text-white">Qualifying training facility *</label>
              <select disabled={disabled} value={facilityId} onChange={(event) => onFacilityChange(event.target.value)} className={fieldClass + " mt-2"}>
                <option value="">Select the facility used</option>
                {facilities.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} — {item.facility_type.replaceAll("_", " ")}</option>)}
              </select>
              {selectedFacility ? (
                <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-semibold text-white">{selectedFacility.name}</div>
                  <div className="mt-1 text-xs text-neutral-400">{[selectedFacility.address, selectedFacility.city, selectedFacility.state, selectedFacility.zip].filter(Boolean).join(", ") || "Location not recorded"}</div>
                  <div className={"mt-2 text-xs font-semibold " + (facilityCredit !== "none" ? "text-green-300" : "text-amber-200")}>{facilityCredit === "full" ? "Meets the full-credit facility criteria" : facilityCredit === "partial" ? "Meets the partial-credit criteria (2-story tower)" : "Does not currently meet the qualifying facility requirements for this date"}</div>
                  {selectedFacility.ownership_type !== "department_owned" ? <div className="mt-1 text-xs text-neutral-400">Formal agreement: {selectedFacility.formal_agreement ? selectedFacility.agreement_reference || "Recorded" : "Not recorded"}</div> : null}
                </div>
              ) : null}
              {facilities.filter((item) => item.active && getFacilityIsoCreditLevel(item, eventDate) !== "none").length === 0 ? <p className="mt-2 text-xs text-amber-200">No qualifying facilities are configured. Add a facility under Settings → ISO Training Facilities.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedClassifications.includes("driver_operator") ? (
        <label className="mt-3 block rounded-xl border border-white/10 bg-black/20 p-4">
          <span className="mb-1 block text-sm font-semibold text-white">Driver / Operator training type *</span>
          <span className="mb-2 block text-xs text-neutral-400">Identify initial qualification training or annual refresher training.</span>
          <select disabled={disabled} value={driverOperatorTrainingType} onChange={(event) => onDriverOperatorTrainingTypeChange(event.target.value)} className={fieldClass}>
            <option value="">Select training type</option>
            <option value="initial">Initial operator training (60-hour benchmark)</option>
            <option value="refresher">Annual refresher (12-hour benchmark)</option>
          </select>
        </label>
      ) : null}

      {selectedClassifications.includes("building_familiarization") ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <label className="block text-sm font-semibold text-white">Building / Pre-Plan visited *</label>
          <p className="mt-1 text-xs text-neutral-400">Link this training record to the actual property visit. High-hazard or large buildings require two documented visits per year.</p>
          <select disabled={disabled} value={prePlanId} onChange={(event) => onPrePlanChange(event.target.value)} className={fieldClass + " mt-3"}>
            <option value="">Select the building / pre-plan</option>
            {prePlans.filter((item) => item.lifecycle_status === "active").map((item) => <option key={item.id} value={item.id}>{item.business_name} — {item.city}{item.iso_high_hazard ? " (High Hazard: 2 visits/year)" : ""}</option>)}
          </select>
          {selectedPrePlan ? <p className="mt-2 text-xs text-sky-200">{selectedPrePlan.address}, {selectedPrePlan.city}, {selectedPrePlan.state}{selectedPrePlan.iso_high_hazard ? " · High-hazard / large building" : ""}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
