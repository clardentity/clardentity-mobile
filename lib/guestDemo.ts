import { fetch } from "expo/fetch";
import { localStorage } from "@/lib/storage";
import { sessionHealthConsent } from "@/lib/healthConsent";
import { API_BASE_URL, clientTimezoneHeader } from "@/lib/apiClient";
import { consumeChatStream, type ChatStreamHandlers } from "@/lib/sse";

/* The landing page's try-it-here conversation.
 *
 * Its own request rather than the app's - there is no token to attach, no
 * conversation id to address, and nothing to persist; the history lives in
 * the component and is posted back each turn - but the app's stream reader
 * and the app's events, so what comes back is the app's answer.
 */

export type GuestTurn = { role: "user" | "assistant"; content: string };

const SESSION_KEY = "clardentity.guest.session";

/** The id this visitor's allowance is counted against.
 *
 *  Kept in localStorage so a reload continues the same allowance rather than
 *  granting a fresh one. Clearing storage does grant a fresh one, which is
 *  accepted: this is a demo, and the cost ceiling that actually matters is
 *  the server's.
 *
 *  Never called during render - `crypto.randomUUID()` would differ between
 *  the server and the client and take hydration with it.
 */
export function guestSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Private window, blocked storage: a per-tab id still works for one
    // conversation, it just will not survive a reload.
    return crypto.randomUUID();
  }
}

export type GuestSendBody = {
  sessionId: string;
  mode: string;
  message: string;
  history: GuestTurn[];
  smartSwitching?: boolean;
  /** The same re-send flags the app's composer sends after a pre-answer
   *  question - see SendMessageBody in lib/sse. */
  modeConfirmed?: boolean;
  refinedConfirmed?: boolean;
  clarifyingConfirmed?: boolean;
  contextAcknowledged?: boolean;
  contextRounds?: number;
  /** Another answer to a question already asked: no gate asks again. */
  regenerate?: boolean;
  /** The last picture this demo drew, so a follow-up can edit it. */
  lastImageId?: string | null;
};

/** Ask one question. Resolves when the stream is finished.
 *
 *  The events and the handlers are the app's own (`ChatStreamHandlers`),
 *  read by the app's own reader - so a demo answer arrives with its gist,
 *  verdict box, claims and score through exactly the code a signed-in one
 *  does, plus the demo's two extras: `onSwitched` and `onBudget`. */
export async function streamGuestMessage(
  body: GuestSendBody,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/guest/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...clientTimezoneHeader() },
      body: JSON.stringify({
        session_id: body.sessionId,
        mode: body.mode,
        message: body.message,
        history: body.history,
        smart_switching: body.smartSwitching ?? true,
        mode_confirmed: body.modeConfirmed ?? false,
        refined_confirmed: body.refinedConfirmed ?? false,
        clarifying_confirmed: body.clarifyingConfirmed ?? false,
        context_acknowledged: body.contextAcknowledged ?? false,
        context_rounds: body.contextRounds ?? 0,
        regenerate: body.regenerate ?? false,
        last_image_id: body.lastImageId ?? null,
        // Healthcare's consent, agreed to in this browser session (or not).
        health_consent: sessionHealthConsent(),
      }),
      signal,
    });
  } catch (err) {
    // An abort is the visitor stopping or closing the demo, not a failure.
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) return;
    handlers.onError("Couldn't reach Clardentity. Check your connection and try again.");
    return;
  }

  if (!response.ok || !response.body) {
    // 503 is the demo's own daily ceiling, and is not a sign-up prompt: the
    // visitor has done nothing wrong and signing up would not help them in
    // the next minute.
    handlers.onError(
      response.status === 503
        ? "The demo is resting for today. Signing up gets you the full thing."
        : response.status === 429
          ? "That's a lot of questions at once - give it a moment."
          : "That didn't come through. Try again?",
    );
    return;
  }

  await consumeChatStream(response.body, handlers);
}
