import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAuthorizedCron, processNotificationEmails } from "@/lib/notifications/assignment-email";
import { createEmailQueue } from "@/lib/notifications/email-queue";
import { processEmailDeliveries, processFairEmailQueues, type EmailSender } from "@/lib/notifications/delivery-processor";
import { buildOperationalEmail, type OperationalEventType } from "@/lib/notifications/operational-email";
import { createOperationalEmailQueue, scanCertificationEmails } from "@/lib/notifications/operational-email-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    console.error("Notification email worker CRON_SECRET is not configured");
    return Response.json({ error: "Email worker is not configured." }, { status: 503 });
  }
  if (!isAuthorizedCron(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const sender = process.env.DEMO_REQUEST_SENDER;
  const apiKey = process.env.RESEND_API_KEY;
  if (!sender || !apiKey) {
    console.error("Notification email worker sender or Resend key is not configured");
    return Response.json({ error: "Email delivery is not configured." }, { status: 503 });
  }
  try {
    const resend = new Resend(apiKey);
    const client = createSupabaseAdminClient();
    const send: EmailSender = async (message, idempotencyKey, signal) => {
        const requestOptions = { idempotencyKey, signal };
        const { data, error } = await resend.emails.send(message, requestOptions);
        if (error) {
          return {
            error: `resend_${error.name}`,
            retryable: !["validation_error", "missing_required_field", "invalid_api_key", "restricted_api_key"].includes(error.name),
          };
        }
        if (!data?.id) return { error: "resend_missing_message_id", retryable: true };
        return { id: data.id };
    };
    let scanFailed = false;
    try {
      await scanCertificationEmails(client);
    } catch (error) {
      scanFailed = true;
      console.error("Certification email scan failed", error instanceof Error ? error.message : "Unknown error");
    }
    const operationalTypes: OperationalEventType[] = ["certification_expiration", "ems_supply_withdrawal"];
    const queues = await processFairEmailQueues([
      {
        name: "deficiency_assigned",
        processOne: () => processNotificationEmails({
          queue: createEmailQueue(client), sender, send, maxDeliveries: 1,
        }),
      },
      ...operationalTypes.map((eventType) => ({
        name: eventType,
        processOne: () => processEmailDeliveries({
          queue: createOperationalEmailQueue(client, eventType), send, maxDeliveries: 1,
          keyPrefix: "operational-email",
          build: (delivery) => buildOperationalEmail(delivery.recipientEmail, sender, delivery.payload),
        }),
      })),
    ]);
    const result = Object.values(queues.counts).reduce((sum, counts) => ({
      processed: sum.processed + counts.processed, accepted: sum.accepted + counts.accepted,
      failed: sum.failed + counts.failed,
    }), { processed: 0, accepted: 0, failed: 0 });
    if (scanFailed || queues.errors.length) {
      return Response.json({
        ...result, error: "Some notification queues failed; retained delivery state requires review.",
      }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(result, {
      status: result.failed ? 502 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Notification email worker failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Email worker failed; delivery state is retained for retry." }, { status: 500 });
  }
}
