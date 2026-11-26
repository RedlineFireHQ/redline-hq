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
const classificationLabels: Record<IsoTrainingClassification, string> = {
  training_facilities: "Training Facilities",
  company_training: "Company Training",
  officer_training: "Officer Training",
  driver_operator: "Driver / Operator",
  hazmat: "Hazardous Materials",
  recruit: "Recruit Training",
  building_familiarization: "Building Familiarization / Pre-Planning",
};

function suggestClassification(categoryName: string, title: string): IsoTrainingClassification[] {
  const value = (categoryName + " " + title).toLowerCase();
  if (/building familiarization|pre.?plan|property visit|building walk.?through|occupancy familiarization/.test(value)) return ["building_familiarization"];
  if (/driver|operator|apparatus driving|pump operations|vehicle operations/.test(value)) return ["driver_operator"];
  if (/haz.?mat|hazardous material/.test(value)) return ["hazmat"];
  if (/recruit|firefighter academy|firefighter i|basic training/.test(value)) return ["recruit"];
  if (/officer|leadership|command training/.test(value)) return ["officer_training"];
  if (/fire|suppression|company training|ladder|hose|engine company|fire attack|ventilation/.test(value)) return ["company_training"];
  return [];
}

export default function IsoTrainingFields({
  classifications, onClassificationsChange, facilityId, onFacilityChange, facilities,
  prePlanId, onPrePlanChange, prePlans, driverOperatorTrainingType,
  onDriverOperatorTrainingTypeChange, eventDate, categoryName = "", trainingTitle = "", disabled = false,
}: Props) {
  const suggested = suggestClassification(categoryName, trainingTitle);
  const selectedFacility = facilities.find((item) => item.id === facilityId) ?? null;
  const selectedPrePlan = prePlans.find((item) => item.id === prePlanId) ?? null;
  const primary = classifications[0] as IsoTrainingClassification | undefined;
  const setPrimary = (value: string) => onClassificationsChange(value ? [value] : []);
  const has = (code: IsoTrainingClassification) => classifications.includes(code);
  const toggleFacilityCredit = (checked: boolean) => {
    const next = classifications.filter((item) => item !== "training_facilities");
    if (checked) next.push("training_facilities");
    onClassificationsChange(next);
  };

  return (
    <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4 md:p-5">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">ISO Documentation</div>
        <h3 className="text-lg font-semibold text-white">ISO qualification for this training</h3>
        <p className="text-sm text-neutral-400">Based on the training subject and title, Redline identifies the likely ISO category. Confirm or change it below. This does not create another training record or add hours a second time.</p>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <label className="block text-sm font-semibold text-white">Suggested ISO classification</label>
        {suggested.length > 0 ? <p className="mt-1 text-xs text-sky-200">Suggested from: {categoryName || "Training subject"}{trainingTitle ? " · " + trainingTitle : ""}</p> : <p className="mt-1 text-xs text-neutral-400">No automatic match was found. Choose a classification only if this event qualifies.</p>}
        <select disabled={disabled} value={primary ?? suggested[0] ?? ""} onChange={(event) => setPrimary(event.target.value)} className={fieldClass + " mt-2"}>
          <option value="">No ISO classification</option>
          {Object.entries(classificationLabels).filter(([code]) => code !== "training_facilities").map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </div>

      {primary === "building_familiarization" ? (
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

      {primary === "driver_operator" ? (
        <label className="mt-3 block rounded-xl border border-white/10 bg-black/20 p-4">
          <span className="mb-1 block text-sm font-semibold text-white">Driver / Operator training type *</span>
          <span className="mb-2 block text-xs text-neutral-400">Identify initial qualification training or annual refresher training.</span>
          <select disabled={disabled} value={driverOperatorTrainingType} onChange={(event) => onDriverOperatorTrainingTypeChange(event.target.value)} className={fieldClass}>
            <option value="">Select training type</option><option value="initial">Initial operator training (60-hour benchmark)</option><option value="refresher">Annual refresher (12-hour benchmark)</option>
          </select>
        </label>
      ) : null}

      {(primary === "company_training" || primary === "recruit" || primary === "officer_training" || primary === "hazmat") ? (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" disabled={disabled} checked={has("training_facilities")} onChange={(event) => toggleFacilityCredit(event.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
            <span><span className="block text-sm font-semibold text-white">This event also qualifies for ISO Training Facilities credit</span><span className="mt-1 block text-xs text-neutral-400">Use this only when the event took place at an eligible drill tower, live-fire training building, training yard, or approved regional facility.</span></span>
          </label>
          {has("training_facilities") ? (
            <div className="mt-3">
              <label className="block text-sm font-semibold text-white">Training facility *</label>
              <select disabled={disabled} value={facilityId} onChange={(event) => onFacilityChange(event.target.value)} className={fieldClass + " mt-2"}>
                <option value="">Select the training facility</option>
                {facilities.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} — {item.facility_type.replaceAll("_", " ")}</option>)}
              </select>
              {selectedFacility ? <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3"><div className="text-sm font-semibold text-white">{selectedFacility.name}</div><div className="mt-1 text-xs text-neutral-400">{[selectedFacility.address, selectedFacility.city, selectedFacility.state, selectedFacility.zip].filter(Boolean).join(", ") || "Location not recorded"}</div><div className={"mt-2 text-xs font-semibold " + (getFacilityIsoCreditLevel(selectedFacility, eventDate) !== "none" ? "text-green-300" : "text-amber-200")}>{getFacilityIsoCreditLevel(selectedFacility, eventDate) === "full" ? "Qualifies for full ISO facility credit" : getFacilityIsoCreditLevel(selectedFacility, eventDate) === "partial" ? "Qualifies for partial ISO facility credit (2-story tower)" : "Does not currently meet ISO qualifying-facility requirements"}</div>{selectedFacility.ownership_type !== "department_owned" ? <div className="mt-1 text-xs text-neutral-400">Formal agreement: {selectedFacility.formal_agreement ? selectedFacility.agreement_reference || "Recorded" : "Not recorded"}</div> : null}</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
