import { localStorage } from "@/lib/storage";
import { apiFetch } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/auth";
import type { GuestTurn } from "@/lib/guestDemo";
import type { DecisionReviewData, GeneratedImage, SafetyCardData, ThinkingReviewData } from "@/lib/sse";

/* Carrying the demo conversation into a new account.
 *
 * The demo stores nothing on the server - that is the deal, and it is in
 * the guest API's docstring. So when the visitor runs out of allowance and
 * is offered an account to keep what they wrote, the transcript has to
 * travel with them, through the one place it exists: this browser.
 *
 * It waits in localStorage across the trip to /register and the welcome
 * questions, and is posted to /guest/import the first time the app loads
 * signed in. Then it is deleted, whether or not the import worked, with one
 * exception - a request that failed for a reason that might pass on a retry
 * keeps it for the next page load, because the alternative is losing the
 * thing we promised to keep.
 */

const KEY = "clardentity.guestTranscript";

/** Long enough to survive signing up, reading the terms, checking email and
 *  coming back tomorrow. Not so long that a transcript someone abandoned
 *  last month turns up in an account they made for something else. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** One demo turn as it is kept: the words, plus what the answer looked like
 *  - its companion (smart switching moves a demo conversation between
 *  them), its gist, its verdict box and any picture - so the copy in the
 *  account reads the way the demo did. The claim checking is not carried:
 *  a verification badge must never be something the browser can write. */
export type StashedTurn = GuestTurn & {
  mode?: string;
  crux_text?: string | null;
  decision_review?: DecisionReviewData | null;
  thinking_review?: ThinkingReviewData | null;
  generated_image?: GeneratedImage | null;
  /** The support card the demo showed - the server rebuilds its numbers. */
  safety?: SafetyCardData | null;
};

export type StashedTranscript = {
  mode: string;
  turns: StashedTurn[];
  /** Epoch ms. */
  savedAt: number;
};

export type ImportedConversation = {
  conversation_id: string;
  workspace_id: string;
  message_count: number;
};

/** Hold on to this conversation for whoever this visitor turns out to be. */
export function stashGuestTranscript(mode: string, turns: StashedTurn[]): void {
  if (turns.length === 0) return;
  try {
    const payload: StashedTranscript = { mode, turns, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private window, or storage full. The offer to save silently becomes an
    // offer to sign up, which is still true and still worth making.
  }
}

export function readStashedTranscript(): StashedTranscript | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StashedTranscript>;
    const turns = Array.isArray(parsed.turns) ? parsed.turns : [];
    const fresh = typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt < MAX_AGE_MS;
    if (!parsed.mode || turns.length === 0 || !fresh) {
      clearStashedTranscript();
      return null;
    }
    return { mode: parsed.mode, turns: turns as StashedTurn[], savedAt: parsed.savedAt as number };
  } catch {
    // Anything unreadable is not worth a second attempt.
    clearStashedTranscript();
    return null;
  }
}

export function clearStashedTranscript(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do, and nothing depends on it having worked: a stash that
    // cannot be removed is re-read, found to be stale within a day, and
    // dropped then.
  }
}

/* One import per page load, however many times it is asked for.
 *
 * The stash can only be cleared once the server has accepted it, so between
 * the request going out and the response coming back the stash is still
 * sitting there - and the caller is an effect, which React re-runs whenever
 * the user object changes identity and twice over in development. Four
 * copies of the same conversation appeared in the sidebar the first time
 * this was tested, which is a worse outcome than not importing at all.
 *
 * Sharing the in-flight promise collapses every concurrent caller onto one
 * request; `completed` stops a later remount starting a second one.
 */
let inFlight: Promise<ImportedConversation | null> | null = null;
let completed = false;

/* What was imported, held until somebody has actually told the user.
 *
 * The import finishes during the hop from /welcome to the first chat, so
 * the component that started it is unmounted before the promise resolves
 * and its replacement asks a module that has already marked itself done.
 * On the first production run that meant the conversation was imported
 * perfectly and nobody was told - the one outcome worse than a visible
 * failure, because the user has no reason to go looking.
 *
 * So the result outlives the component, and is handed to whichever mount
 * asks next. `announced` stops it being handed out twice.
 */
let lastResult: ImportedConversation | null = null;
let announced = false;

const listeners = new Set<() => void>();

/** Called by whoever puts the result on screen, so it is not shown again. */
export function markImportAnnounced(): void {
  announced = true;
  lastResult = null;
  emit();
}

function emit(): void {
  listeners.forEach((fn) => fn());
}

/* A store rather than a promise the caller awaits.
 *
 * Awaiting it inside an effect made whether the user was told depend on
 * where they happened to be standing when the request came back. On the
 * sign-up path - /welcome, then /start, then the first chat - the shell
 * mounts and unmounts around the redirects, and on production the import
 * landed in one of those gaps: imported perfectly, announced to nobody,
 * three accounts running. A store has no such window. Whoever is mounted
 * when the result arrives is told, and whoever mounts afterwards reads it.
 */
export function subscribeImported(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The import nobody has shown yet, or null. Stable reference, as
 *  useSyncExternalStore requires. */
export function importedSnapshot(): ImportedConversation | null {
  return announced ? null : lastResult;
}

/** Server render: there is no import on the server. */
export function importedServerSnapshot(): ImportedConversation | null {
  return null;
}

/** Write the waiting transcript into the signed-in account.
 *
 *  Returns what was created, or null when there was nothing to do. Never
 *  throws: this runs on a page the user asked for something else from, and
 *  a failed import must not be the reason their app does not load.
 */
export function importStashedTranscript(): Promise<ImportedConversation | null> {
  // Already done, but possibly not yet seen - see `lastResult`.
  if (completed) return Promise.resolve(announced ? null : lastResult);
  if (inFlight) return inFlight;
  inFlight = runImport().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runImport(): Promise<ImportedConversation | null> {
  if (!getAccessToken()) return null;
  const stashed = readStashedTranscript();
  if (!stashed) return null;

  try {
    const result = await apiFetch<ImportedConversation>("/guest/import", {
      method: "POST",
      body: { mode: stashed.mode, turns: stashed.turns },
    });
    completed = true;
    lastResult = result;
    clearStashedTranscript();
    emit();
    return result;
  } catch (error) {
    // A transcript the server will never accept - the wrong mode, too long,
    // malformed - would otherwise be retried on every page load forever.
    // Anything else (offline, a 500, a token mid-refresh) is worth another
    // go on the next load, which is why only the 4xx range clears it.
    if (isPermanentRefusal(error)) clearStashedTranscript();
    return null;
  }
}

function isPermanentRefusal(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  // 401 is excluded on purpose: it means the token was not ready, not that
  // the transcript is bad, and the next load will have one.
  return typeof status === "number" && status >= 400 && status < 500 && status !== 401;
}
