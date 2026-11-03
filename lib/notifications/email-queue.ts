import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentEmailPayload, EmailDelivery, EmailMessage, EmailQueue } from "./assignment-email";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid email queue response");
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid email queue field");
  return value;
}

function parseMessage(value: unknown): EmailMessage {
  const row = object(value);
  return {
    from: text(row.from), to: text(row.to), subject: text(row.subject),
    text: text(row.text), html: text(row.html),
  };
}

function parsePayload(value: unknown): AssignmentEmailPayload {
  const row = object(value);
  return {
    departmentName: text(row.departmentName), description: text(row.description),
    category: text(row.category), priority: text(row.priority), href: text(row.href),
  };
}

export function createEmailQueue(client: SupabaseClient): EmailQueue {
  return {
    async claim() {
      const { data, error } = await client.rpc("claim_notification_email").abortSignal(AbortSignal.timeout(5_000));
      if (error) throw new Error(`Email queue claim failed: ${error.message}`);
      if (!Array.isArray(data)) throw new Error("Invalid email queue claim response");
      if (!data.length) return null;
      const row = object(data[0]);
      if (row.event_type !== "deficiency_assigned") throw new Error("Unsupported notification email event");
      const delivery: EmailDelivery = {
        id: text(row.id), leaseToken: text(row.lease_token), recipientEmail: text(row.recipient_email),
        payload: parsePayload(row.payload), message: row.email_message === null ? null : parseMessage(row.email_message),
      };
      return delivery;
    },
    async prepare(delivery, message) {
      const { data, error } = await client.rpc("prepare_notification_email", {
        p_id: delivery.id, p_lease_token: delivery.leaseToken, p_message: message,
      }).abortSignal(AbortSignal.timeout(5_000));
      if (error) throw new Error(`Email queue preparation failed: ${error.message}`);
      if (data === null) return null;
      const stored = parseMessage(data);
      if (stored.to !== delivery.recipientEmail) throw new Error("Email queue recipient mismatch");
      return stored;
    },
    async finish(delivery, result) {
      const { error } = await client.rpc("finish_notification_email", {
        p_id: delivery.id, p_lease_token: delivery.leaseToken,
        p_provider_id: result.id ?? null, p_error: result.error ?? null, p_retryable: result.retryable ?? false,
      }).abortSignal(AbortSignal.timeout(5_000));
      if (error) throw new Error(`Email queue completion failed: ${error.message}`);
    },
  };
}
