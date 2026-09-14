import { Resend } from "resend";

type DemoRequest = {
  name?: unknown;
  departmentName?: unknown;
  email?: unknown;
  phone?: unknown;
  memberCount?: unknown;
  message?: unknown;
};

const recentRequests = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

export async function POST(request: Request) {
  const requestIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const previousRequest = recentRequests.get(requestIp);

  if (previousRequest && now - previousRequest < RATE_LIMIT_WINDOW_MS) {
    return jsonResponse({ error: "Please wait a few minutes before submitting another request." }, 429);
  }

  let payload: DemoRequest;
  try {
    payload = (await request.json()) as DemoRequest;
  } catch {
    return jsonResponse({ error: "Please submit the form again." }, 400);
  }

  const name = asText(payload.name);
  const departmentName = asText(payload.departmentName);
  const email = asText(payload.email).toLowerCase();
  const phone = asText(payload.phone);
  const memberCount = asText(payload.memberCount);
  const message = asText(payload.message);

  if (!name || !departmentName || !email) {
    return jsonResponse({ error: "Name, fire department name, and email are required." }, 400);
  }

  if (name.length > 120 || departmentName.length > 160 || email.length > 254 || phone.length > 60 || memberCount.length > 30 || message.length > 4000) {
    return jsonResponse({ error: "One or more fields are too long." }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }

  if (memberCount && (!/^\d+$/.test(memberCount) || Number(memberCount) > 1000000)) {
    return jsonResponse({ error: "Enter a valid number of members." }, 400);
  }

  const recipient = process.env.DEMO_REQUEST_RECIPIENT;
  const sender = process.env.DEMO_REQUEST_SENDER;
  const apiKey = process.env.RESEND_API_KEY;

  if (!recipient || !sender || !apiKey) {
    return jsonResponse({ error: "Demo requests are not configured yet. Please try again later." }, 503);
  }

  const submittedAt = new Date().toISOString();
  const resend = new Resend(apiKey);
  let deliveryError: unknown = null;
  try {
    ({ error: deliveryError } = await resend.emails.send({
      from: sender,
      to: recipient,
      replyTo: email,
      subject: `Redline HQ demo request from ${name}`,
      text: [
        "New Redline HQ demo request",
        `Name: ${name}`,
        `Fire Department Name: ${departmentName}`,
        `Email: ${email}`,
        `Phone: ${phone || "Not provided"}`,
        `Number of Members: ${memberCount || "Not provided"}`,
        `Message: ${message || "Not provided"}`,
        `Submission timestamp: ${submittedAt}`,
      ].join("\n"),
      html: `<h2>New Redline HQ demo request</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Fire Department Name:</strong> ${escapeHtml(departmentName)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Phone:</strong> ${escapeHtml(phone || "Not provided")}</p><p><strong>Number of Members:</strong> ${escapeHtml(memberCount || "Not provided")}</p><p><strong>Message:</strong><br />${escapeHtml(message || "Not provided").replace(/\n/g, "<br />")}</p><p><strong>Submission timestamp:</strong> ${escapeHtml(submittedAt)}</p>`,
    }));
  } catch {
    deliveryError = true;
  }

  if (deliveryError) {
    return jsonResponse({ error: "We could not send your request. Please try again." }, 502);
  }

  recentRequests.set(requestIp, now);
  return jsonResponse({ ok: true });
}