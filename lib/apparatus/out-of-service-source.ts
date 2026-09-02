export type ApparatusOutOfServiceSource = "deficiency" | "manual" | null;

export type ApparatusInspectionStatus = "ready" | "needs_attention" | "out_of_service";

export function getOutOfServiceSourceForInspectionStatus(
  status: ApparatusInspectionStatus,
): ApparatusOutOfServiceSource {
  return status === "out_of_service" ? "deficiency" : null;
}

export function getApparatusStateAfterDeficiencyResolution(input: {
  apparatusStatus: string | null;
  outOfServiceSource: ApparatusOutOfServiceSource;
  remainingActiveDeficiencyCount: number;
}) {
  const normalizedRemainingCount = Math.max(0, Math.trunc(input.remainingActiveDeficiencyCount));

  if (input.apparatusStatus !== "out_of_service") {
    return {
      statusChanged: false,
      nextStatus: input.apparatusStatus,
      nextOutOfServiceSource: input.outOfServiceSource,
    };
  }

  if (input.outOfServiceSource !== "deficiency") {
    return {
      statusChanged: false,
      nextStatus: input.apparatusStatus,
      nextOutOfServiceSource: input.outOfServiceSource,
    };
  }

  if (normalizedRemainingCount > 0) {
    return {
      statusChanged: false,
      nextStatus: "out_of_service",
      nextOutOfServiceSource: "deficiency" as const,
    };
  }

  return {
    statusChanged: true,
    nextStatus: "ready",
    nextOutOfServiceSource: null,
  };
}