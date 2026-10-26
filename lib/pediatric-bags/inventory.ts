/**
 * Canonical Pediatric ALS Kit inventory — the single source of truth.
 *
 * Transcribed verbatim from docs/Pediatric A.docx (Red Oak Fire Department,
 * "#A Pediatric ALS Kit Inventory"). Bags A, B, C, and D share identical
 * contents, so this is one shared template per department.
 *
 * Each entry: [section, itemLabel, requiredQuantity, sourceQuantityText]
 *   - requiredQuantity is null when the source quantity is unconfirmed ("***").
 *   - sourceQuantityText preserves the exact source notation ("1 each", "2 pak",
 *     "***", "1ea", etc.).
 *
 * Imported by:
 *   - the migration fidelity test (lib/readiness/pediatric-bag-migration.test.ts)
 *   - the read-only preview (lib/pediatric-bags/preview.ts)
 * Do not edit item wording, order, or quantities without updating the migration
 * and its tests in lockstep.
 */

export type PediatricInventoryEntry = [
  section: string,
  itemLabel: string,
  requiredQuantity: number | null,
  sourceQuantityText: string,
];

export const PEDIATRIC_INVENTORY: readonly PediatricInventoryEntry[] = [
  ["Top-Misc", "6.0 ETT", 1, "1"],
  ["Top-Misc", "5.0 ETT", 1, "1"],
  ["Top-Misc", "4.0 ETT", 1, "1"],
  ["Top-Misc", "3.0 ETT", 1, "1"],
  ["Top-Misc", "14 Fr Stylette", 1, "1"],
  ["Top-Misc", "6 Fr Stylette", 1, "1"],
  ["Top-Misc", "ECG Electrodes", 2, "2 pak"],
  ["Top-Misc", "Ped Nasal", 1, "1"],
  ["Top-Misc", "Infant Nasal", 1, "1"],
  ["Top-Misc", "Bulb Syringe", 1, "1"],
  ["Top-Misc", "Magill Forceps", 1, "1"],
  ["Top-Misc", "ETT Tube Holder", 1, "1"],
  ["Top-Misc", "Laryngoscope Handle", 1, "1"],
  ["Back", "Infant & Ped B/P", 1, "1 each"],
  ["Back", "Stethoscope", 1, "1"],
  ["Back", "Cheat Sheet", 1, "1"],
  ["Back", "Pulse Ox", 1, "1"],
  ["Left", "Infant BVM", 1, "1"],
  ["Right", "Ped BVM", 1, "1"],
  ["Front-IV Kits", "Arm Boards", 2, "2"],
  ["Out — IV Kit #1", "24 GA, 22 GA IV cath", 1, "1 each"],
  ["Out — IV Kit #1", "20 GA, 24 X .56 GA IV cath", 1, "1 each"],
  ["Out — IV Kit #1", "Alcohol Preps", 10, "10"],
  ["Inside — IV Kit #1", "Roll tape", 1, "1"],
  ["Inside — IV Kit #1", "500ml Normal Saline", 1, "1"],
  ["Inside — IV Kit #1", "IV Prep kit", 1, "1"],
  ["Inside — IV Kit #1", "60gtt Drip Set", 1, "1"],
  ["Inside — IV Kit #1", "3-way Stopcock, max", 1, "1"],
  ["Inside — IV Kit #1", "60ml Syringe", 1, "1"],
  ["Inside — IV Kit #1", "STAT lock start kit", 1, "1"],
  ["Inside — IV Kit #1", "IV Extension", 1, "1"],
  ["Out — IV Kit #2", "24 GA, 22GA IV cath", 1, "1 each"],
  ["Out — IV Kit #2", "20 GA, 24 X .56 GA IV cath", 1, "1 each"],
  ["Out — IV Kit #2", "Alcohol Preps", 10, "10"],
  ["Inside — IV Kit #2", "Roll tape", 1, "1"],
  ["Inside — IV Kit #2", "500ml Normal Saline", 1, "1"],
  ["Inside — IV Kit #2", "IV Prep kit", 1, "1"],
  ["Inside — IV Kit #2", "15 gtt Drip Set", 1, "1"],
  ["Inside — IV Kit #2", "3-way Stopcock, max", 1, "1"],
  ["Inside — IV Kit #2", "60ml Syringe", 1, "1"],
  ["Inside — IV Kit #2", "STAT lock start kit", 1, "1"],
  ["Inside — IV Kit #2", "IV Extension", 1, "1"],
  ["Inside", "King 2.0 & 2.5", 1, "1 each"],
  ["Inside", "Pedi Kits", 7, "7"],
  ["Inside", "Pedi Wheel", 1, "1"],
  ["Inside", "Sharps container", 1, "1"],
  ["Neonate Kit", "30mm & 40mm Oral", 1, "1 each"],
  ["Neonate Kit", "BVM Mask", 1, "1"],
  ["Neonate Kit", "2.5 ETT", 1, "1"],
  ["Neonate Kit", "3.0 ETT", 1, "1"],
  ["4–7 kg Kit", "40mm & 60mm Oral", 1, "1 each"],
  ["4–7 kg Kit", "Infant O2 Mask", 1, "1"],
  ["4–7 kg Kit", "6-fr suction cath", 1, "1"],
  ["4–7 kg Kit", "3.5 ETT", 1, "1"],
  ["4–7 kg Kit", "#0 & #1 Miller Blade", 1, "1 each"],
  ["8–11 kg Kit", "60mm Oral", 1, "1"],
  ["8–11 kg Kit", "Ped NRB mask", 1, "1"],
  ["8–11 kg Kit", "8&10-fr suction cath", 1, "1 each"],
  ["8–11 kg Kit", "4.0 ETT", 1, "1"],
  ["8–11 kg Kit", "10mL syringe", 1, "1"],
  ["8–11 kg Kit", "#1 Miller Blade", 1, "1"],
  ["12–14 kg Kit", "60mm Oral", 1, "1"],
  ["12–14 kg Kit", "Ped NRB mask", 1, "1"],
  ["12–14 kg Kit", "8&10-fr suction cath", 1, "1 each"],
  ["12–14 kg Kit", "4.5 ETT", 1, "1"],
  ["12–14 kg Kit", "10mL syringe", 1, "1"],
  ["12–14 kg Kit", "#1 Miller, #2 Mac", 1, "1 each"],
  ["14–17 kg Kit", "60mm Oral", 1, "1"],
  ["14–17 kg Kit", "Ped NRB mask", 1, "1"],
  ["14–17 kg Kit", "10-fr suction cath", 1, "1"],
  ["14–17 kg Kit", "5.0 ETT", 1, "1"],
  ["14–17 kg Kit", "10 mL syringe", 1, "1"],
  ["14–17 kg Kit", "#2 Miller, #2 Mac", 1, "1 each"],
  ["18–22 kg Kit", "60mm & 80mm Oral", 1, "1 each"],
  ["18–22 kg Kit", "Ped NRB mask", 1, "1"],
  ["18–22 kg Kit", "10-fr suction cath", 1, "1"],
  ["18–22 kg Kit", "5.5 ETT", 1, "1"],
  ["18–22 kg Kit", "Stylet, 14-fr", 1, "1"],
  ["18–22 kg Kit", "10mL syringe", 1, "1"],
  ["18–22 kg Kit", "#2 Miller, #2 Mac", 1, "1ea"],
  ["24–30 kg Kit", "80mm Oral", 1, "1"],
  ["24–30 kg Kit", "Ped NRB mask", 1, "1"],
  ["24–30 kg Kit", "10-fr suction cath", 1, "1"],
  ["24–30 kg Kit", "6.0 ETT", 1, "1"],
  ["24–30 kg Kit", "Stylet, 14-fr", 1, "1"],
  ["24–30 kg Kit", "10mL Syringe", 1, "1"],
  ["24–30 kg Kit", "#3 Miller, #2-3 Mac", 1, "1ea"],
];

/** The 17 physical sections in source order. */
export const PEDIATRIC_SECTION_ORDER: readonly string[] = [
  "Top-Misc",
  "Back",
  "Left",
  "Right",
  "Front-IV Kits",
  "Out — IV Kit #1",
  "Inside — IV Kit #1",
  "Out — IV Kit #2",
  "Inside — IV Kit #2",
  "Inside",
  "Neonate Kit",
  "4–7 kg Kit",
  "8–11 kg Kit",
  "12–14 kg Kit",
  "14–17 kg Kit",
  "18–22 kg Kit",
  "24–30 kg Kit",
];

/** The four bags (A/B/C/D) share this identical inventory. */
export const PEDIATRIC_BAG_LABELS = ["A", "B", "C", "D"] as const;
