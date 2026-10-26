/**
 * Pediatric bag check — completion gating rules.
 *
 * Pure, testable mirror of the enforcement logic inside the
 * complete_pediatric_bag_check SQL RPC. Keeping the rule here lets us
 * behaviorally test every final-status scenario against realistic data without
 * executing SQL, while the RPC enforces the same rules atomically in the
 * database. If one changes, the other must change too (guarded by tests).
 *
 * Status model (PASS / EXPIRED):
 *   - Item status:  'checked' | 'expired'
 *     ('checked' = PASS = present & acceptable; 'expired' = EXPIRED = documented
 *     as expired. No expiration dates are captured.)
 *   - Final status: 'ready' | 'needs_attention' | 'out_of_service'
 *     ('ready' is presented as "Ready for Service"). An inspection with any
 *     EXPIRED item completes as 'needs_attention' and is shown as "Items Expired".
 */

export type PediatricItemStatus = "checked" | "expired";
export type PediatricFinalStatus = "ready" | "needs_attention" | "out_of_service";

export const PEDIATRIC_FINAL_STATUSES: readonly PediatricFinalStatus[] = [
  "ready",
  "needs_attention",
  "out_of_service",
];

export type PediatricTemplateItem = {
  /** null => quantity unconfirmed in the source (e.g. "***" Alcohol Preps). */
  requiredQuantity: number | null;
  isRequired: boolean;
  isActive: boolean;
};

export type PediatricProgressEntry = {
  item: PediatricTemplateItem;
  status: PediatricItemStatus | null;
};

export type PediatricCompletionDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/** A template row participates in the confirmed-quantity completion gate. */
export function isConfirmedRequiredItem(item: PediatricTemplateItem) {
  return item.isActive && item.isRequired && item.requiredQuantity !== null;
}

/** A template row whose quantity is unconfirmed ("needs review" item). */
export function isUnresolvedQuantityItem(item: PediatricTemplateItem) {
  return item.isActive && item.isRequired && item.requiredQuantity === null;
}

/** An item status counts as "addressed" (PASS or EXPIRED) for the completion gate. */
export function isCompletedItemStatus(status: PediatricItemStatus | null) {
  return status === "checked" || status === "expired";
}

export function countUnresolvedQuantityItems(items: PediatricTemplateItem[]) {
  return items.filter(isUnresolvedQuantityItem).length;
}

/** Count items marked EXPIRED. */
export function countExpiredItems(progress: PediatricProgressEntry[]) {
  return progress.filter((entry) => entry.item.isActive && entry.status === "expired").length;
}

export function isValidFinalStatus(status: string): status is PediatricFinalStatus {
  return (PEDIATRIC_FINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * Decide whether a pediatric bag check may complete with the requested final
 * status, given the active template and the member's recorded progress.
 *
 * Rules (mirrored in the SQL RPC):
 *   1. Final status must be one of the three supported values.
 *   2. There must be at least one active required item with a confirmed
 *      quantity, and every such item must be marked.
 *   3. 'ready' is refused while any required item has an unconfirmed quantity.
 *   4. 'ready' is refused while any item is marked as a deficiency.
 *   'needs_attention' ("Needs Review") and 'out_of_service' remain allowed once
 *   rule 2 holds, so unresolved items produce an honest non-ready outcome.
 */
export function evaluatePediatricCompletion(input: {
  finalStatus: string;
  templateItems: PediatricTemplateItem[];
  progress: PediatricProgressEntry[];
}): PediatricCompletionDecision {
  const { finalStatus, templateItems, progress } = input;

  if (!isValidFinalStatus(finalStatus)) {
    return { allowed: false, reason: `Invalid final inspection status: ${finalStatus}` };
  }

  const confirmedRequired = templateItems.filter(isConfirmedRequiredItem);
  if (confirmedRequired.length === 0) {
    return {
      allowed: false,
      reason: "No active required checklist items with confirmed quantities are configured.",
    };
  }

  // An inspection may be completed even when some checklist items remain
  // unchecked (e.g. an administrator finishing a test/partial check). Unchecked
  // items are not treated as satisfying 'ready'; completeness only affects the
  // honest outcome (callers complete such a check as 'needs_attention').

  if (finalStatus === "ready") {
    const completedConfirmed = progress.filter(
      (entry) => isConfirmedRequiredItem(entry.item) && isCompletedItemStatus(entry.status),
    ).length;

    if (completedConfirmed < confirmedRequired.length) {
      return {
        allowed: false,
        reason: "Complete all required checklist items before submitting this pediatric bag check as Ready for Service.",
      };
    }

    const unresolved = countUnresolvedQuantityItems(templateItems);
    if (unresolved > 0) {
      return {
        allowed: false,
        reason:
          `Cannot complete as Ready for Service: ${unresolved} required item(s) have an unconfirmed ` +
          'quantity pending review (e.g. Alcohol Preps "***"). Complete as Needs Review until the quantity is confirmed.',
      };
    }

    const expired = countExpiredItems(progress);
    if (expired > 0) {
      return {
        allowed: false,
        reason:
          `Cannot complete as Ready for Service: ${expired} checklist item(s) are marked as expired. ` +
          "Document them and complete as Items Expired instead.",
      };
    }
  }

  return { allowed: true };
}
