/**
 * Red Oak Fire Department — EMS Drug Inventory Log (revised 08/28/2025)
 *
 * Canonical source of truth: docs/RO EMS Drug Inventory List - 08.28.25.doc
 *
 * This is an inventory PRESENCE check only — not a medication administration or
 * controlled-substance waste log. The patient/waste/signature/clinic fields on
 * the paper form are intentionally excluded (see feature requirements).
 *
 * Grouping and order follow the paper form: four horizontal item bands
 * (Section 1–3 plus the labeled EZ-IO block), each read left column then right
 * column. Items printed without a quantity are presence-only and held at
 * quantity 1 per the confirmed source review.
 */

export type DrugInventoryEntry = [
  section: string,
  itemLabel: string,
  requiredQuantity: number,
  sourceQuantityText: string,
];

export const DRUG_BOX_INVENTORY: readonly DrugInventoryEntry[] = [
  // --- Section 1 (first band) — left column then right column ----------------
  ["Section 1", "Epi 1:10,000 1mg prefilled", 6, "6"],
  ["Section 1", "Lidocaine 100mg prefilled", 3, "3"],
  ["Section 1", "Dextrose 50% 25gm prefill", 2, "2"],
  ["Section 1", "Glucagon 1mg Vial", 1, "1"],
  ["Section 1", "Insta Glucose 24gm tube", 1, "1"],
  ["Section 1", "Sodium Bicarb 50mEq prefill", 1, "1"],
  ["Section 1", "20cc syringe", 2, "2"],
  ["Section 1", "10cc syringe", 2, "2"],
  ["Section 1", "5cc syringe", 2, "2"],
  ["Section 1", "Narcan 2mg prefilled", 2, "2"],
  ["Section 1", "Mag Sulfate 2gm Premix Bag", 2, "2"],
  ["Section 1", "Atropine 1mg prefilled", 4, "4"],
  ["Section 1", "Fentanyl (max of 400mcg)", 1, "max of 400mcg"],
  ["Section 1", "Morphine Sulfate 10mg (max of 20mg)", 2, "2 (max of 20mg)"],
  ["Section 1", "Versed 10mg vial", 2, "2"],
  ["Section 1", "Ketamine 500mg vial", 2, "2"],
  ["Section 1", "Nebulizer setups", 2, "2"],
  ["Section 1", "Minidrip Sets", 2, "2"],
  ["Section 1", "Prefilled Saline flush & veni loop", 1, "1"],
  ["Section 1", "Lidocaine 2gm/500ml premix", 1, "1"],
  ["Section 1", "Dopamine 400mg/250ml Premix IV", 1, "1"],
  ["Section 1", "D10W 250mL", 2, "2"],
  ["Section 1", "D5W 250 ml", 1, "1"],

  // --- Section 2 (second band) ----------------------------------------------
  ["Section 2", "Carpujet", 1, "1"],
  ["Section 2", "Thiamine 200mg vial", 1, "1"],
  ["Section 2", "Diphenhydramine 50mg vial", 1, "1"],
  ["Section 2", "Romazicon .5mg vial", 2, "2"],
  ["Section 2", "Zofran 4mg vial", 2, "2"],
  ["Section 2", "Tranexamic Acid 1,000mg vial", 1, "1"],
  ["Section 2", "18G x 1 ½\" filtered needle", 2, "2"],
  ["Section 2", "Epi 1:1,000 1mg ampule", 2, "2"],
  ["Section 2", "Cordarone 150mg vial", 3, "3"],
  ["Section 2", "Adenosine 6mg vial", 3, "3"],
  ["Section 2", "Nitro Spray .4mg spray", 1, "1"],
  ["Section 2", "ASA 81mg chewable", 1, "1 bottle"],
  ["Section 2", "100mL Normal Saline 0.9%", 1, "1"],

  // --- Section 3 (third band) -----------------------------------------------
  ["Section 3", "Albuterol 2.5mg/3.0ml", 2, "2"],
  ["Section 3", "Racemic Epi 2.25%/3ml", 1, "1"],
  ["Section 3", "1cc syringe", 2, "2"],
  ["Section 3", "3cc syringe", 2, "2"],
  ["Section 3", "Mad Device", 2, "2"],
  ["Section 3", "25 x 5/8 needle", 2, "2"],
  ["Section 3", "18 x 1 ½ needle", 4, "4"],
  ["Section 3", "23 x 1 needle", 3, "3"],
  ["Section 3", "Solu-Medrol 125 mg vial", 1, "1"],
  ["Section 3", "Etomidate 40 mg vial", 1, "1"],
  ["Section 3", "Rocuronium 50mg vial", 3, "3"],
  ["Section 3", "Lopressor 5mg vial", 2, "2"],
  ["Section 3", "Labetalol 100mg vial", 1, "1"],
  ["Section 3", "Catheter setups 16-18-20", 3, "3"],
  ["Section 3", "Catheter setups 2-22, 2-24", 1, "1"],
  ["Section 3", "2 x10cc 1x20cc syringes 3x18G Needles", 1, "1"],

  // --- EZ-IO (labeled block) --------------------------------------------------
  ["EZ-IO", "Pressure Infuser", 1, "1"],
  ["EZ-IO", "3cc syringes", 2, "2"],
  ["EZ-IO", "Xylocaine-MPF 2% 100mg vial", 2, "2"],
  ["EZ-IO", "15g x 15mm pedi needle (pink)", 2, "2"],
  ["EZ-IO", "15g x 25mm adult needle (blue)", 2, "2"],
  ["EZ-IO", "10cc prefilled saline flush", 1, "1"],
  ["EZ-IO", "10cc Syringes", 2, "2"],
  ["EZ-IO", "18g x 1 ½\" needle", 2, "2"],
  ["EZ-IO", "Drill driver", 1, "1"],
  ["EZ-IO", "15gx45mm (obese) needle", 1, "1"],
  ["EZ-IO", "alcohol wipes & IO start tags", 1, "1"],
];

/** The form's sections in source order. */
export const DRUG_BOX_SECTION_ORDER: readonly string[] = [
  "Section 1",
  "Section 2",
  "Section 3",
  "EZ-IO",
];

/** Red Oak drug boxes are identified by squad/unit number, not letters. */
export const DRUG_BOX_SQUAD_NUMBERS: readonly string[] = ["114", "115", "116", "117"];

export function drugBoxDisplayName(squadNumber: string): string {
  return `Drug Box — Squad ${squadNumber}`;
}
