"use client";

import { getFacilityIsoCreditLevel, type IsoTrainingClassification } from "@/lib/training/iso-training";

export type IsoTrainingFacilityOption = {
  id: string; name: string; facility_type: string; ownership_type: string;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  tower_stories: number | null; yard_acres: number | null; purpose_built_live_fire: boolean;
  formal_agreement: boolean; agreement_reference: string | null;
  agreement_start_date: string | null; agreement_end_date: string | null; active: boolean;
};
export type IsoPrePlanOption = {
  id: string; business_name: string; address: string; city: string; state: string;
  iso_high_hazard: boolean; lifecycle_status: string;
};
interface Props {
  classifications: string[];
  onClassificationsChange: (next: string[]) => void;
  facilityId: string; onFacilityChange: (next: string) => void;
  facilities: IsoTrainingFacilityOption[];
  prePlanId: string; onPrePlanChange: (next: string) => void;
  prePlans: IsoPrePlanOption[];
  driverOperatorTrainingType: string;
  onDriverOperatorTrainingTypeChange: (next: string) => void;
  eventDate?: string; categoryName?: string; trainingTitle?: string; disabled?: boolean;
}

const fieldClass = "w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none";
const isoOptions: Array<{ code: IsoTrainingClassification; label: string; match: RegExp }> = [
  { code: "company_training", label: "Company Training", match: /fire|suppression|company|hose|ladder|search|rescue|ventilation|forcible entry/ },
  { code: "officer_training", label: "Officer Training", match: /officer|leadership|command|ics|size.?up/ },
  { code: "driver_operator", label: "Driver / Operator", match: /driver|operator|apparatus|pump|hydraulic|water supply/ },
  { code: "hazmat", label: "Hazardous Materials", match: /hazmat|hazardous material|erg|decontamination/ },
  { code: "recruit", label: "Recruit Training", match: /recruit|academy|firefighter i|basic training/ },
  { code: "building_familiarization", label: "Building Familiarization / Pre-Planning", match: /building familiarization|pre.?plan|property visit|building walk.?through|occupancy familiarization/ },
];

export default function TrainingEventIsoFields({
  classifications, onClassificationsChange, facilityId, onFacilityChange, facilities,
  prePlanId, onPrePlanChange, prePlans, driverOperatorTrainingType,
  onDriverOperatorTrainingTypeChange, eventDate, categoryName = "", trainingTitle = "", disabled = false,
}: Props) {
  const selectedClassification = classifications.find((item) => item !== "training_facilities") as IsoTrainingClassification | undefined;
  const isFacilityCreditSelected = classifications.includes("training_facilities");
  const normalizedInput = (categoryName + " " + trainingTitle).toLowerCase();
  const suggested = isoOptions.find((item) => item.match.test(normalizedInput))?.code
    ?? (categoryName.trim().toLowerCase() === "fire training" ? "company_training" : undefined);
  const selectedFacility = facilities.find((item) => item.id === facilityId) ?? null;
  const selectedPrePlan = prePlans.find((item) => item.id === prePlanId) ?? null;
  const facilityCredit = selectedFacility ? getFacilityIsoCreditLevel(selectedFacility, eventDate) : "none";
  const showFacilityOption = categoryName.trim().toLowerCase() === "fire training"
    || ["company_training", "officer_training", "recruit", "hazmat"].includes(selectedClassification ?? suggested ?? "");

  function setClassification(value: string) {
    const next = classifications.filter((item) => item === "training_facilities");
    if (value) next.unshift(value);
    onClassificationsChange(next);
  }
  function setFacilityCredit(checked: boolean) {
    const next = classifications.filter((item) => item !== "training_facilities" && item !== selectedClassification);
    if (selectedClassification) next.unshift(selectedClassification);
    if (checked) next.push("training_facilities");
    onClassificationsChange(next);
  }

  return (
    <section className="rounded-xl border border-white/10 bg-[#151515] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">ISO / PPC Documentation</p>
          <p className="mt-1 text-sm text-neutral-400">Classify this training for the department's ISO/PPC records. This does not create a second training event or duplicate hours.</p>
        </div>
        {suggested ? <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-200">Suggested: {isoOptions.find((item) => item.code === suggested)?.label}</span> : null}
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-semibold text-neutral-200">ISO Classification</span>
        <select disabled={disabled} value={selectedClassification ?? suggested ?? ""} onChange={(event) => setClassification(event.target.value)} className={fieldClass}>
          <option value="">No ISO classification</option>
          {isoOptions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </select>
      </label>

      {showFacilityOption ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" disabled={disabled} checked={isFacilityCreditSelected} onChange={(event) => setFacilityCredit(event.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
            <span>
              <span className="block text-sm font-semibold text-white">This training also qualifies for ISO Training Facilities credit</span>
              <span className="mt-1 block text-xs text-neutral-400">Check this only when the event took place at a qualifying drill tower, live-fire training building, training yard, or approved regional facility. A regular station drill does not qualify.</span>
            </span>
          </label>
          {isFacilityCreditSelected ? (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-neutral-200">Training facility used *</label>
              <select disabled={disabled} value={facilityId} onChange={(event) => onFacilityChange(event.target.value)} className={fieldClass + " mt-1.5"}>
                <option value="">Select the facility used</option>
                {facilities.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} — {item.facility_type.replaceAll("_", " ")}</option>)}
              </select>
              {selectedFacility ? (
                <div className="mt-2 text-xs text-neutral-400">
                  {[selectedFacility.address, selectedFacility.city, selectedFacility.state, selectedFacility.zip].filter(Boolean).join(", ") || "Location not recorded"}
                  <span className={"ml-2 font-semibold " + (facilityCredit !== "none" ? "text-green-300" : "text-amber-200")}>{facilityCredit === "full" ? "Full facility credit criteria met" : facilityCredit === "partial" ? "Partial facility credit criteria met" : "Facility does not currently meet qualifying criteria"}</span>
                  {selectedFacility.ownership_type !== "department_owned" ? <span className="block mt-1">Formal agreement: {selectedFacility.formal_agreement ? selectedFacility.agreement_reference || "Recorded" : "Not recorded"}</span> : null}
                </div>
              ) : null}
              {facilities.filter((item) => item.active && getFacilityIsoCreditLevel(item, eventDate) !== "none").length === 0 ? <p className="mt-2 text-xs text-amber-200">No qualifying facilities are configured yet. Add one under Settings → ISO Training Facilities.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedClassification === "driver_operator" ? (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-200">Driver / Operator training type *</span>
          <select disabled={disabled} value={driverOperatorTrainingType} onChange={(event) => onDriverOperatorTrainingTypeChange(event.target.value)} className={fieldClass}>
            <option value="">Select training type</option>
            <option value="initial">Initial operator training (60-hour benchmark)</option>
            <option value="refresher">Annual refresher (12-hour benchmark)</option>
          </select>
        </label>
      ) : null}

      {selectedClassification === "building_familiarization" ? (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-200">Building / Pre-Plan visited *</span>
          <select disabled={disabled} value={prePlanId} onChange={(event) => onPrePlanChange(event.target.value)} className={fieldClass + " mt-1.5"}>
            <option value="">Select the building / pre-plan</option>
            {prePlans.filter((item) => item.lifecycle_status === "active").map((item) => <option key={item.id} value={item.id}>{item.business_name} — {item.city}{item.iso_high_hazard ? " (High Hazard: 2 visits/year)" : ""}</option>)}
          </select>
          {selectedPrePlan ? <p className="mt-1.5 text-xs text-neutral-400">{selectedPrePlan.address}, {selectedPrePlan.city}, {selectedPrePlan.state}{selectedPrePlan.iso_high_hazard ? " · High-hazard / large building" : ""}</p> : null}
        </label>
      ) : null}
    </section>
  );
}
