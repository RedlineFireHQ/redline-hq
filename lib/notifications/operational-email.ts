import type { EmailMessage } from "./assignment-email";

export type OperationalEventType = "certification_expiration" | "ems_supply_withdrawal";
export type OperationalPayload =
  | {
      eventType: "certification_expiration";
      departmentName: string;
      certificationName: string;
      expirationDate: string;
      milestone: 60 | 30 | 14 | 7;
      memberId: string;
    }
  | {
      eventType: "ems_supply_withdrawal";
      departmentName: string;
      itemName: string;
      quantityAfter: number;
      reorderThreshold: number;
      withdrawalQuantity: number;
      unit: string;
      supplyItemId: string;
      transactionItemId: string;
    };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function html(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export function buildOperationalEmail(recipient: string, sender: string, payload: OperationalPayload): EmailMessage {
  if (recipient.length > 254 || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(recipient)) {
    throw new Error("Invalid operational email recipient");
  }
  let subject: string;
  let details: string[];
  let href: string;
  if (payload.eventType === "certification_expiration") {
    if (!isCalendarDate(payload.expirationDate) || ![60, 30, 14, 7].includes(payload.milestone) || !uuid.test(payload.memberId)) {
      throw new Error("Invalid certification reminder payload");
    }
    subject = `Redline HQ - Certification expires in ${payload.milestone} days`;
    details = [
      `Department: ${payload.departmentName}`, `Certification: ${payload.certificationName}`,
      `Expiration date: ${payload.expirationDate}`, `Reminder: ${payload.milestone} days before expiration`,
      "This reminder is sent only to the certification holder.",
    ];
    href = `/personnel/${payload.memberId}`;
  } else {
    if (!uuid.test(payload.supplyItemId) || !uuid.test(payload.transactionItemId)
      || ![payload.quantityAfter, payload.reorderThreshold, payload.withdrawalQuantity].every(Number.isFinite)
      || payload.quantityAfter < 0 || payload.reorderThreshold < 0 || payload.withdrawalQuantity <= 0
      || payload.quantityAfter > payload.reorderThreshold) {
      throw new Error("Invalid supply withdrawal payload");
    }
    subject = "Redline HQ - EMS supply reorder needed";
    details = [
      `Department: ${payload.departmentName}`, `Supply: ${payload.itemName}`,
      `Withdrawal: ${payload.withdrawalQuantity} ${payload.unit}`,
      `Quantity after withdrawal: ${payload.quantityAfter} ${payload.unit}`,
      `Reorder threshold at withdrawal: ${payload.reorderThreshold} ${payload.unit}`,
      "Each qualifying checkout produces its own reorder email.",
    ];
    href = "/inventory/ems-supplies";
  }
  const url = `https://redlinefirehq.com${href}`;
  return {
    from: sender, to: recipient, subject,
    text: [...details, "", `Open Redline HQ: ${url}`].join("\n"),
    html: `<h1>${html(subject)}</h1>${details.map((line) => `<p>${html(line)}</p>`).join("")}<p><a href="${html(url)}">Open Redline HQ</a></p>`,
  };
}
