import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailMessage } from "./assignment-email";
import type { DeliveryQueue } from "./delivery-processor";
import type { OperationalEventType, OperationalPayload } from "./operational-email";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid operational queue object");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid operational queue string");
  return value;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid operational queue number");
  return value;
}
function message(value: unknown): EmailMessage {
  const row = object(value);
  if (Object.keys(row).length !== 5) throw new Error("Invalid frozen email shape");
  return { from: text(row.from), to: text(row.to), subject: text(row.subject), text: text(row.text), html: text(row.html) };
}
export function parseOperationalPayload(eventType: OperationalEventType, value: unknown): OperationalPayload {
  const row = object(value);
  const departmentName = text(row.departmentName);
  if (eventType === "certification_expiration") {
    const milestone = number(row.milestone);
    if (milestone !== 60 && milestone !== 30 && milestone !== 14 && milestone !== 7) {
      throw new Error("Invalid certification milestone");
    }
    return {
      eventType, departmentName, milestone, certificationName: text(row.certificationName),
      expirationDate: text(row.expirationDate), memberId: text(row.memberId),
    };
  }
  return {
    eventType, departmentName, itemName: text(row.itemName), quantityAfter: number(row.quantityAfter),
    reorderThreshold: number(row.reorderThreshold), withdrawalQuantity: number(row.withdrawalQuantity),
    unit: text(row.unit), supplyItemId: text(row.supplyItemId), transactionItemId: text(row.transactionItemId),
  };
}

export async function scanCertificationEmails(client: SupabaseClient) {
  const { data, error } = await client.rpc("scan_operational_certification_emails", { p_limit: 200 })
    .abortSignal(AbortSignal.timeout(5_000));
  if (error) throw new Error(`Certification email scan failed: ${error.message}`);
  return number(data);
}

export function createOperationalEmailQueue(
  client: SupabaseClient, eventType: OperationalEventType,
): DeliveryQueue<OperationalPayload> {
  return {
    async claim() {
      const { data, error } = await client.rpc("claim_operational_email", { p_type: eventType })
        .abortSignal(AbortSignal.timeout(5_000));
      if (error) throw new Error(`Operational email claim failed: ${error.message}`);
      if (!Array.isArray(data) || data.length > 1) throw new Error("Invalid operational claim result");
      if (!data.length) return null;
      const row = object(data[0]);
      if (row.event_type !== eventType) throw new Error("Operational queue event mismatch");
      return {
        id: text(row.id), leaseToken: text(row.lease_token), recipientEmail: text(row.recipient_email),
        payload: parseOperationalPayload(eventType, row.payload),
        message: row.email_message === null ? null : message(row.email_message),
      };
    },
    async prepare(delivery, outgoing) {
      const { data, error } = await client.rpc("prepare_operational_email", {
        p_id: delivery.id, p_lease_token: delivery.leaseToken, p_message: outgoing,
      }).abortSignal(AbortSignal.timeout(5_000));
      if (error) throw new Error(`Operational email preparation failed: ${error.message}`);
      if (data === null) return null;
      const frozen = message(data);
      if (frozen.to !== delivery.recipientEmail) throw new Error("Operational recipient mismatch");
      return frozen;
    },
    async finish(delivery, result) {
      const { error } = await client.rpc("finish_operational_email", {
        p_id: delivery.id, p_lease_token: delivery.leaseToken, p_provider_id: result.id ?? null,
        p_error: result.error ?? null, p_retryable: result.retryable ?? false,
      }).abortSignal(AbortSignal.timeout(5_000));
      if (error) throw new Error(`Operational email completion failed: ${error.message}`);
    },
  };
}
