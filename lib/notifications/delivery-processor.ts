import type { DeliveryResult, EmailMessage } from "./assignment-email";

export type QueuedEmail<Payload> = {
  id: string;
  leaseToken: string;
  recipientEmail: string;
  payload: Payload;
  message: EmailMessage | null;
};

export type DeliveryQueue<Payload> = {
  claim(): Promise<QueuedEmail<Payload> | null>;
  prepare(delivery: QueuedEmail<Payload>, message: EmailMessage): Promise<EmailMessage | null>;
  finish(delivery: QueuedEmail<Payload>, result: DeliveryResult): Promise<void>;
};

export type DeliveryCounts = { processed: number; accepted: number; failed: number };
export type EmailSender = (
  message: EmailMessage, idempotencyKey: string, signal: AbortSignal,
) => Promise<DeliveryResult>;

export async function processEmailDeliveries<Payload>(options: {
  queue: DeliveryQueue<Payload>;
  build(delivery: QueuedEmail<Payload>): EmailMessage;
  keyPrefix: string;
  send: EmailSender;
  now?: () => number;
  maxDeliveries?: number;
}) {
  const now = options.now ?? Date.now;
  const deadline = now() + 40_000;
  const counts: DeliveryCounts = { processed: 0, accepted: 0, failed: 0 };
  while (counts.processed < (options.maxDeliveries ?? 10) && now() < deadline) {
    const delivery = await options.queue.claim();
    if (!delivery) break;
    const message = await options.queue.prepare(delivery, delivery.message ?? options.build(delivery));
    counts.processed++;
    if (!message) continue;
    let result: DeliveryResult;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      result = await Promise.race([
        options.send(message, `${options.keyPrefix}/${delivery.id}`, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("Email provider timeout"));
          }, 10_000);
        }),
      ]);
    } catch {
      result = { error: "provider_transport_error_or_timeout", retryable: true };
    } finally {
      clearTimeout(timer);
    }
    await options.queue.finish(delivery, result);
    if (result.id) counts.accepted++;
    else {
      counts.failed++;
      console.error("Notification email delivery failed", { deliveryId: delivery.id, code: result.error });
    }
  }
  return counts;
}

export async function processFairEmailQueues(
  sources: Array<{ name: string; processOne(): Promise<DeliveryCounts> }>,
  now: () => number = Date.now,
) {
  const deadline = now() + 25_000;
  const counts: Record<string, DeliveryCounts> = {};
  const errors: string[] = [];
  let processed = 0;
  const empty = new Set<string>();
  while (processed < 10 && now() < deadline && empty.size < sources.length) {
    for (const source of sources) {
      if (processed >= 10 || now() >= deadline) break;
      if (empty.has(source.name)) continue;
      let result: DeliveryCounts;
      try {
        result = await source.processOne();
      } catch (error) {
        errors.push(source.name);
        empty.add(source.name);
        console.error("Notification queue processing failed", {
          queue: source.name, error: error instanceof Error ? error.message : "Unknown error",
        });
        continue;
      }
      const total = counts[source.name] ?? { processed: 0, accepted: 0, failed: 0 };
      total.processed += result.processed;
      total.accepted += result.accepted;
      total.failed += result.failed;
      counts[source.name] = total;
      processed += result.processed;
      if (!result.processed) empty.add(source.name);
    }
  }
  return { counts, errors };
}
