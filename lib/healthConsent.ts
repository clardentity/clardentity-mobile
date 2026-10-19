import { sessionStorage } from "@/lib/storage";
import { apiFetch } from "@/lib/apiClient";
import type { HealthConsentState } from "@/lib/sse";

/* Healthcare's consent, client side.
 *
 * Signed in, it lives on the account (backend api/healthcare): read it when
 * Healthcare is picked, give it from the card, withdraw it in Settings. A
 * visitor in the landing demo has no account, so their agreement is kept for
 * this browser session only and sent with each Healthcare question - the
 * demo stores nothing, and a new session asks again. */

const SESSION_KEY = "clardentity-health-consent";

export function sessionHealthConsent(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function rememberSessionHealthConsent(version: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, version);
  } catch {
    // Storage refused: the card simply asks again next time.
  }
}

export function fetchHealthConsent(): Promise<HealthConsentState> {
  return apiFetch<HealthConsentState>("/healthcare/consent", { fresh: true });
}

/** Give consent to the version on the card, in the language it was read in
 *  (recorded with the consent). */
export function giveHealthConsent(version: string, language = "en"): Promise<HealthConsentState> {
  return apiFetch<HealthConsentState>("/healthcare/consent", {
    method: "POST",
    body: { version, age_confirmed: true, language },
  });
}

/** Withdraw consent - which also deletes every chat with a Healthcare
 *  message in it (see backend api/healthcare.py). */
export function withdrawHealthConsent(): Promise<HealthConsentState & { deleted_conversations: number }> {
  return apiFetch("/healthcare/consent/withdraw", { method: "POST", body: {} });
}
