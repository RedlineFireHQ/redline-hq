export async function triggerEmsAllocationRecalculation(memberId: string) {
  if (!memberId) {
    return;
  }

  try {
    await fetch("/api/ems/allocations/recalculate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ memberId }),
    });
  } catch {
    // Best-effort persistence refresh; do not block training workflows.
  }
}

export async function triggerEmsAllocationRecalculationForMembers(memberIds: string[]) {
  const uniqueIds = Array.from(new Set(memberIds.filter((memberId) => memberId.trim().length > 0)));
  if (uniqueIds.length === 0) {
    return;
  }

  await Promise.all(uniqueIds.map((memberId) => triggerEmsAllocationRecalculation(memberId)));
}
