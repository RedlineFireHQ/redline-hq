"use client";

import { useEffect } from "react";
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

function suggestIsoClassifications(categoryName: string, title: string): IsoTrainingClassification[] {
  const value = (categoryName + " " + title).toLowerCase();
  if (/building familiarization|pre.?plan|property visit|building walk.?through|occupancy familiarization/.test(value)) return ["building_familiarization"];
  if (/driver|operator|apparatus driving|pump operations|vehicle operations/.test(value)) return ["driver_operator"];
  if (/haz.?mat|hazardous material/.test(value)) return ["hazmat"];
  if (/recruit|firefighter academy|firefighter i|basic training/.test(value)) return ["recruit"];
  if (/officer|leadership|command training/.test(value)) return ["officer_training"];
  if (/fire suppression|fire training|company training|ladder|hose|engine company|fire attack|ventilation/.test(value)) return ["company_training"];
  return [];
}

const labels: Record<IsoTrainingClassification, string> = {
  training_facilities: "Training Facilities",
  company_training: "Company Training",
  officer_training: "Officer Training",
  driver_operator: "Driver / Operator",
  hazmat: "Hazardous Materials",
  recruit: "Recruit Training",
  building_familiarization: "Building Familiarization / Pre-Planning",
};

export default function IsoTrainingFields(props: Props) {
  const {
    classifications, onClassificationsChange, facilityId, onFacilityChange, facilities,
    prePlanId, onPrePlanChange, prePlans, driverOperatorTrainingType,
    onDriverOperatorTrainingTypeChange, eventDate, categoryName = "", trainingTitle = "", disabled = false,
  } = props;
  const suggested = suggestIsoClassifications(categoryName, trainingTitle);
  const selectedFacility = facilities.find((item) => item.id === facilityId) ?? null;
  const selectedPrePlan = prePlans.find((item) => item.id === prePlanId) ?? null;
  const has = (code: IsoTrainingClassification) => classifications.includes(code);
  function toggle(code: IsoTrainingClassification, checked: boolean) {
    onClassificationsChange(checked ? Array.from(new Set([...classifications, code])) : classifications.filter((item) => item !== code));
  }

  useEffect(() => {
    if (classifications.length === 0 && suggested.length > 0) onClassificationsChange(suggested);
  }, [categoryName, trainingTitle]);

  return (
    <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4 md:p-5">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">ISO Training Documentation</div>
        <h3 className="text-lg font-semibold text-white">ISO qualification</h3>
        <p className="text-sm text-neutral-400">Redline suggests the applicable ISO classification from the training subject and title. Confirm the details for this event.</p>
      </div>
      {classifications.length > 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">ISO classification for this training</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {classifications.map((code) => <span key={code} className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-100">{labels[code as IsoTrainingClassification] ?? code}</span>)}
          </div>
        </div>
      ) : <p className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-neutral-400">No specific ISO classification was identified from this subject. You can still document a qualifying training facility below.</p>}

      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" disabled={disabled} checked={has("training_facilities")} onChange={(event) => toggle("training_facilities", event.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
          <span>
            <span className="block text-sm font-semibold text-white">This training took place at a qualifying training facility</span>
            <span className="mt-1 block text-xs text-neutral-400">Select this for a qualifying drill tower, live-fire training building, training yard, or approved regional facility.</span>
          </span>
        </label>
        {has("training_facilities") ? (
          <div className="mt-3">
            <div className="text-sm font-semibold text-white">Where did this training take place? *</div>
            <select disabled={disabled} value={facilityId} onChange={(event) => onFacilityChange(event.target.value)} className={fieldClass + " mt-2"}>
              <option value="">Select the training facility</option>
              {facilities.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} — {item.facility_type.replaceAll("_", " ")}</option>)}
            </select>
            {selectedFacility ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="text-sm font-semibold text-white">{selectedFacility.name}</div>
                <div className="mt-1 text-xs text-neutral-400">{[selectedFacility.address, selectedFacility.city, selectedFacility.state, selectedFacility.zip].filter(Boolean).join(", ") || "Location not recorded"}</div>
                <div className={"mt-2 text-xs font-semibold " + (getFacilityIsoCreditLevel(selectedFacility, eventDate) !== "none" ? "text-green-300" : "text-amber-200")}>{getFacilityIsoCreditLevel(selectedFacility, eventDate) === "full" ? "Qualifies for full ISO facility credit" : getFacilityIsoCreditLevel(selectedFacility, eventDate) === "partial" ? "Qualifies for partial ISO facility credit (2-story tower)" : "Does not currently meet ISO qualifying-facility requirements"}</div>
                <div className="mt-1 text-xs text-neutral-400">Facility type: {selectedFacility.facility_type.replaceAll("_", " ")} · Ownership: {selectedFacility.ownership_type.replaceAll("_", " ")}</div>
                {selectedFacility.ownership_type !== "department_owned" ? <div className="mt-1 text-xs text-neutral-400">Formal agreement: {selectedFacility.formal_agreement ? selectedFacility.agreement_reference || "Recorded" : "Not recorded"}</div> : null}
              </div>
            ) : null}
            {facilities.filter((item) => item.active).length === 0 ? <p className="mt-2 text-xs text-amber-200">No training facilities are configured yet. Add one under Settings → ISO Training Facilities.</p> : null}
          </div>
        ) : null}
      </div>

      {has("building_familiarization") ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-white">Which building / pre-plan was visited? *</span>
            <span className="mb-2 block text-xs text-neutral-400">Link this record to the property. High-hazard or large buildings require two documented visits per year.</span>
            <select disabled={disabled} value={prePlanId} onChange={(event) => onPrePlanChange(event.target.value)} className={fieldClass}>
              <option value="">Select the building / pre-plan</option>
              {prePlans.filter((item) => item.lifecycle_status === "active").map((item) => <option key={item.id} value={item.id}>{item.business_name} — {item.city}{item.iso_high_hazard ? " (High Hazard: 2 visits/year)" : ""}</option>)}
            </select>
          </label>
          {selectedPrePlan ? <p className="mt-2 text-xs text-sky-200">{selectedPrePlan.address}, {selectedPrePlan.city}, {selectedPrePlan.state}{selectedPrePlan.iso_high_hazard ? " · High-hazard / large building" : ""}</p> : null}
        </div>
      ) : null}

      {has("driver_operator") ? (
        <label className="mt-4 block rounded-xl border border-white/10 bg-black/20 p-4">
          <span className="mb-1 block text-sm font-semibold text-white">Driver / Operator training type *</span>
          <span className="mb-2 block text-xs text-neutral-400">Identify initial qualification training or annual refresher training.</span>
          <select disabled={disabled} value={driverOperatorTrainingType} onChange={(event) => onDriverOperatorTrainingTypeChange(event.target.value)} className={fieldClass}>
            <option value="">Select training type</option>
            <option value="initial">Initial operator training (60-hour benchmark)</option>
            <option value="refresher">Annual refresher (12-hour benchmark)</option>
          </select>
        </label>
      ) : null}
    </section>
  );
}
