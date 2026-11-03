import { timingSafeEqual } from "node:crypto";
import { processEmailDeliveries } from "./delivery-processor";

export type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type AssignmentEmailPayload = {
  departmentName: string;
  description: string;
  category: string;
  priority: string;
  href: string;
};

export type EmailDelivery = {
  id: string;
  leaseToken: string;
  recipientEmail: string;
  payload: AssignmentEmailPayload;
  message: EmailMessage | null;
};

export type DeliveryResult =
  | { id: string; error?: never; retryable?: never }
  | { id?: never; error: string; retryable: boolean };

export type EmailQueue = {
  claim(): Promise<EmailDelivery | null>;
  prepare(delivery: EmailDelivery, message: EmailMessage): Promise<EmailMessage | null>;
  finish(delivery: EmailDelivery, result: DeliveryResult): Promise<void>;
};

export function isAuthorizedCron(authorization: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export function buildAssignmentEmail(
  recipientEmail: string, sender: string, payload: AssignmentEmailPayload,
): EmailMessage {
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(recipientEmail) || recipientEmail.length > 254) {
    throw new Error("Invalid assignment email recipient");
  }
  if (!/^\/operations\/deficiencies\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.href)) {
    throw new Error("Invalid deficiency email link");
  }
  const url = `https://redlinefirehq.com${payload.href}`;
  const text = [
    "Redline HQ - Deficiency Assigned to You",
    `Department: ${payload.departmentName}`,
    `Category: ${payload.category}`,
    `Priority: ${payload.priority}`,
    "", "Description:", payload.description, "",
    `Open deficiency: ${url}`, "",
    "You received this email because this deficiency was assigned to you.",
  ].join("\n");
  return {
    from: sender,
    to: recipientEmail,
    subject: "Redline HQ - Deficiency Assigned to You",
    text,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#202020">
<h1 style="font-size:24px">Redline HQ</h1><h2 style="font-size:20px">Deficiency Assigned to You</h2>
<p><strong>Department:</strong> ${escapeHtml(payload.departmentName)}</p>
<p><strong>Category:</strong> ${escapeHtml(payload.category)}<br><strong>Priority:</strong> ${escapeHtml(payload.priority)}</p>
<p><strong>Description:</strong><br>${escapeHtml(payload.description).replace(/\r?\n/g, "<br>")}</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#b91c1c;color:white;padding:12px 18px;text-decoration:none;border-radius:6px">Open deficiency in Redline HQ</a></p>
<p style="font-size:12px;color:#666">You received this email because this deficiency was assigned to you.</p></div>`,
  };
}

export async function processNotificationEmails(options: {
  queue: EmailQueue;
  sender: string;
  send(message: EmailMessage, idempotencyKey: string, signal: AbortSignal): Promise<DeliveryResult>;
  now?: () => number;
  maxDeliveries?: number;
}) {
  return processEmailDeliveries({
    ...options, keyPrefix: "notification-email",
    build: (delivery) => buildAssignmentEmail(delivery.recipientEmail, options.sender, delivery.payload),
  });
}
