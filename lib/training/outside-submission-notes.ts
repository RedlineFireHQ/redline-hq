// Shared convention for the free-text `notes` column on
// training_outside_submissions. Both the desktop Submit Training modal and the
// mobile training form store the method, instructor, and location as
// line-oriented "Key: value" text. This module is the single writer/reader for
// that convention so display surfaces (Department Training, reports) can
// recover the structured details for every historical and future record in
// every department without a data migration.

export type OutsideSubmissionDetails = {
  trainingMethod: string | null;
  instructorName: string | null;
  location: string | null;
};

export function buildOutsideSubmissionNotes(input: {
  trainingMethod: string;
  instructorName: string;
  location: string;
}): string | null {
  const lines: string[] = [];

  if (input.trainingMethod.trim()) {
    lines.push(`Method: ${input.trainingMethod.trim()}`);
  }

  if (input.instructorName.trim()) {
    lines.push(`Instructor: ${input.instructorName.trim()}`);
  }

  if (input.location.trim()) {
    lines.push(`Location: ${input.location.trim()}`);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

export function parseOutsideSubmissionNotes(notes: string | null | undefined): OutsideSubmissionDetails {
  const details: OutsideSubmissionDetails = {
    trainingMethod: null,
    instructorName: null,
    location: null,
  };

  if (typeof notes !== "string" || notes.trim().length === 0) {
    return details;
  }

  for (const rawLine of notes.split("\n")) {
    const line = rawLine.trim();
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!value) {
      continue;
    }

    if (key === "method" && details.trainingMethod === null) {
      details.trainingMethod = value;
    } else if (key === "instructor" && details.instructorName === null) {
      details.instructorName = value;
    } else if (key === "location" && details.location === null) {
      details.location = value;
    }
  }

  return details;
}
