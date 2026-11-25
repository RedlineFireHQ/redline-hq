"use client";

import { ISO_TRAINING_CLASSIFICATIONS, facilityQualifiesForIso, type IsoTrainingClassification } from "@/lib/training/iso-training";

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
  disabled?: boolean;
}

const fieldClass = "w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none";

export default function IsoTrainingFields({
  classifications,
  onClassificationsChange,
  facilityId,
  onFacilityChange,
  facilities,
  prePlanId,
  onPrePlanChange,
  prePlans,
  driverOperatorTrainingType,
  onDriverOperatorTrainingTypeChange,
  disabled = false,
}: Props) {
  const selectedFacility = facilities.find((facility) => facility.id === facilityId) ?? null;
  const selectedPrePlan = prePlans.find((plan) => plan.id === prePlanId) ?? null;
  const has = (code: IsoTrainingClassification) => classifications.includes(code);

  function toggle(code: IsoTrainingClassification, checked: boolean) {
    onClassificationsChange(checked
      ? Array.from(new Set([...classifications, code]))
      : classifications.filter((item) => item !== code));
  }

  return (
    <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4 md:p-5">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">ISO Training Documentation</div>
        <h3 className="text-lg font-semibold text-white">How does this training qualify?</h3>
        <p className="text-sm text-neutral-400">Choose every applicable ISO training category. This is separate from the training subject category above, so one event can be Fire Suppression training and also qualify for Company Training or Training Facilities.</p>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {ISO_TRAINING_CLASSIFICATIONS.map((item) => (
          <label key={item.code} className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-white/[0.04]">
            <input type="checkbox" disabled={disabled} checked={has(item.code)} onChange={(event) => toggle(item.code, event.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">{item.label}<span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold text-sky-200">{item.weight}%</span></span>
              <span className="mt-1 block text-xs leading-relaxed text-neutral-400">{item.target}</span>
            </span>
          </label>
        ))}
      </div>

      {has("training_facilities") ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
          <div className="text-sm font-semibold text-white">Qualifying Training Facility *</div>
          <p className="mt-1 text-xs text-neutral-400">The 18-hour annual target only counts at a qualifying drill facility. Regular station drills do not count toward this bucket.</p>
          <select disabled={disabled} value={facilityId} onChange={(event) => onFacilityChange(event.target.value)} className={`${fieldClass} mt-3`}>
            <option value="">Select a saved qualifying facility</option>
            {facilities.filter((facility) => facility.active).map((facility) => (
              <option key={facility.id} value={facility.id}>{facility.name} — {facility.facility_type.replaceAll("_", " ")}</option>
            ))}
          </select>
          {selectedFacility ? (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-sm font-semibold text-white">{selectedFacility.name}</div>
              <div className="mt-1 text-xs text-neutral-400">{[selectedFacility.address, selectedFacility.city, selectedFacility.state, selectedFacility.zip].filter(Boolean).join(", ") || "Location not recorded"}</div>
              <div className={`mt-2 text-xs font-semibold ${facilityQualifiesForIso(selectedFacility) ? "text-green-300" : "text-amber-200"}`}>{facilityQualifiesForIso(selectedFacility) ? "Qualifying facility — eligible for ISO facility-hour tracking" : "This facility does not currently meet the qualifying rules"}</div>
              {selectedFacility.ownership_type !== "department_owned" ? <div className="mt-1 text-xs text-neutral-400">Formal agreement: {selectedFacility.formal_agreement ? selectedFacility.agreement_reference || "Recorded" : "Not recorded"}</div> : null}
            </div>
          ) : null}
          {facilities.filter((facility) => facility.active && facilityQualifiesForIso(facility)).length === 0 ? <p className="mt-2 text-xs text-amber-200">No qualifying facilities are configured yet. Add one under Settings → ISO Training Facilities.</p> : null}
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

      {has("building_familiarization") ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-white">Building / Pre-Plan visited *</span>
            <span className="mb-2 block text-xs text-neutral-400">Link this training record to the actual property visit. High-hazard or large buildings should be visited twice per year.</span>
            <select disabled={disabled} value={prePlanId} onChange={(event) => onPrePlanChange(event.target.value)} className={fieldClass}>
              <option value="">Select a saved pre-plan</option>
              {prePlans.filter((plan) => plan.lifecycle_status === "active").map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.business_name} — {plan.city}{plan.iso_high_hazard ? " (High Hazard: 2 visits/year)" : ""}</option>
              ))}
            </select>
          </label>
          {selectedPrePlan ? <p className="mt-2 text-xs text-sky-200">{selectedPrePlan.address}, {selectedPrePlan.city}, {selectedPrePlan.state}{selectedPrePlan.iso_high_hazard ? " · High-hazard / large building" : ""}</p> : null}
          {prePlans.filter((plan) => plan.lifecycle_status === "active").length === 0 ? <p className="mt-2 text-xs text-amber-200">No active pre-plans are available. Add the property in Pre-Plans before recording this visit.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
