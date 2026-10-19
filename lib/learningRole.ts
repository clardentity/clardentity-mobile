import { apiFetch } from "@/lib/apiClient";

/* Who this user is when they are learning, held once for the whole session.
 *
 * A module-level value with subscribers rather than component state, for two
 * reasons. It is asked in one place and will be editable in another, and both
 * have to agree immediately. And Learning mode can be selected and deselected
 * any number of times in a session - a card that re-fetched the profile on
 * every mount would ask the server a question it has already answered.
 *
 * Read with `useSyncExternalStore`, which is also how this project keeps the
 * consent banner and the appearance settings in step: React's own escape
 * hatch for state that lives outside it, and the one that does not trip the
 * "no setState in an effect" rule a plain `useEffect` + `useState` pair would.
 */

export type LearningRole = "student" | "teacher" | "visiting";

/** `undefined` means we have not looked yet, which is different from `null` -
 *  looked, and they have not been asked. Only `null` shows the card. */
type Known = LearningRole | null | undefined;

let state: Known;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLearningRole(): Known {
  return state;
}

/** Always "not looked yet" on the server, so the card never renders into the
 *  HTML and then disappears on hydration. */
export function getServerLearningRole(): Known {
  return undefined;
}

/** Fetch it once. Safe to call on every mount: the second call joins the
 *  first, and a resolved value is never re-fetched. */
export function loadLearningRole(): Promise<void> {
  if (state !== undefined) return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = apiFetch<{ learning_role: LearningRole | null }>("/profile")
    .then((profile) => {
      state = profile.learning_role ?? null;
    })
    .catch(() => {
      // A profile we cannot read is not a reason to stand in front of
      // Learning mode. Treated as answered: the prompt then assumes nothing,
      // which is exactly what it did before this question existed.
      state = null;
    })
    .finally(() => {
      inFlight = null;
      emit();
    });
  return inFlight;
}

/** Record the answer. Optimistic - the one thing worse than storing a
 *  preference late is asking for it twice. */
export async function setLearningRole(role: LearningRole): Promise<void> {
  state = role;
  emit();
  try {
    // `body` is the object, not a string: apiFetch stringifies it. Passing
    // JSON.stringify's output sends a JSON *string* as the whole body, which
    // the endpoint rejects as 422 - and the catch below would have swallowed
    // it silently.
    await apiFetch("/profile/learning-role", { method: "PUT", body: { role } });
  } catch (error) {
    // Left answered on this device: re-opening the card after a failed write
    // would be the more annoying failure, and the next profile read settles
    // it either way. Logged rather than swallowed, though - an empty catch
    // here hid a double-encoded body that made every write a silent 422.
    console.warn("learning role not saved", error);
  }
}
