export type GroundLadderInspectionResult = "ready" | "out-of-service";
export type GroundLadderInspectionChecklistStatus = "pass" | "fail" | "not_applicable";

export const GROUND_LADDER_INSPECTION_ITEMS: Array<{
  key: string;
  label: string;
  allowNotApplicable?: boolean;
}> = [
  { key: "beams-and-rails", label: "Beams & Rails" },
  { key: "rungs", label: "Rungs" },
  { key: "pawls-dogs", label: "Pawls / Dogs" },
  { key: "halyard-pulley", label: "Halyard & Pulley" },
  { key: "heat-sensors", label: "Heat Sensors" },
  { key: "butt-spurs-feet", label: "Butt Spurs & Feet" },
  { key: "guides-stops", label: "Guides & Stops" },
  { key: "roof-hooks", label: "Roof Hooks / Folding Hooks", allowNotApplicable: true },
  { key: "cleanliness", label: "Cleanliness" },
];

export function buildGroundLadderInspectionNotes({
  existingNotes,
  helperSummary,
  checklistSummary,
  inspectionNotes,
  result,
  timestamp = new Date(),
}: {
  existingNotes?: string | null;
  helperSummary?: string | null;
  checklistSummary?: string | null;
  inspectionNotes?: string | null;
  result: GroundLadderInspectionResult;
  timestamp?: Date;
}) {
  const summarySections = [existingNotes?.trim(), helperSummary?.trim(), checklistSummary?.trim()].filter(Boolean);
  const inspectionLabel = result === "ready" ? "Ready for Duty" : "Out of Service";
  const inspectionStamp = `Inspection (${timestamp.toLocaleString("en-US")}): ${inspectionLabel}.`;
  const inspectionBody = inspectionNotes?.trim() ? `${inspectionStamp} ${inspectionNotes.trim()}` : inspectionStamp;

  return [...summarySections, inspectionBody].filter(Boolean).join("\n\n");
}

export function getGroundLadderInspectionDateFromNotes(notes: string | null | undefined) {
  if (!notes) {
    return null;
  }

  const inspectionMatch = notes.match(/Inspection\s*\(([^)]+)\)/i);
  if (!inspectionMatch?.[1]) {
    return null;
  }

  const parsed = new Date(inspectionMatch[1].trim());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function parseGroundLadderInspectionHistory(notes: string | null | undefined) {
  if (!notes) {
    return [] as Array<{ date: string; result: string; details: string | null }>;
  }

  const entries = notes.matchAll(/Inspection\s*\(([^)]+)\):\s*(Ready for Duty|Out of Service)\.?\s*(.*)?/gi);
  const history = [] as Array<{ date: string; result: string; details: string | null }>;

  for (const match of entries) {
    const rawDate = match[1]?.trim();
    const result = match[2]?.trim() || "Inspection";
    const details = (match[3] ?? "").trim() || null;
    if (!rawDate) {
      continue;
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    history.push({
      date: parsed.toISOString().slice(0, 10),
      result,
      details,
    });
  }

  return history.sort((left, right) => right.date.localeCompare(left.date));
}
