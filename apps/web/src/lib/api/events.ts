// Event bus: dispatches verdict events to matching webhooks. Fire-and-
// forget — never blocks the caller's response.

import { listAllWebhooks } from "./webhook-store";
import {
  dispatchToWebhook,
  type EventPayload,
} from "./webhook-dispatcher";

export function emit(payload: EventPayload): void {
  const targets = listAllWebhooks().filter((w) =>
    w.events.includes(payload.event),
  );
  if (targets.length === 0) return;
  // Run dispatch detached. Errors are recorded in the delivery log,
  // never thrown out to the caller.
  for (const w of targets) {
    void dispatchToWebhook(w, payload).catch(() => undefined);
  }
}
