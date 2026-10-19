import { localStorage } from "@/lib/storage";
import { apiFetch } from "@/lib/apiClient";

/* The models a user may choose by name, in Co-Creative - the one mode where
 * the choice is theirs. (Learning had it too until 2026-10-10.)
 *
 * The list comes from the server rather than being written here, for one
 * reason that matters: a model is only offered if that deployment has the
 * provider's API key. Hard-coding the list in the client would mean offering
 * Gemini on a deployment that cannot reach Google, and finding out at the
 * moment somebody picks it.
 *
 * The choice is remembered per mode. Picking Opus for Co-Creative says
 * nothing about what you want when you open Learning, and the server keeps
 * no record of it - this is a preference about how to work, not something
 * about the person.
 */

export type PickableModel = {
  id: string;
  label: string;
  vendor: string;
  blurb: string;
  /** False outside the modes where picking is allowed (the server's rule;
   *  PICKABLE_MODES below mirrors it). */
  selectable?: boolean;
};

/** Modes where a named model can be chosen. Elsewhere the picker is shown
 *  locked (Auto only). The server owns the rule - it flags each model's
 *  `selectable` and ignores a model sent from any other mode. */
export const PICKABLE_MODES = new Set(["creative"]);

const CHOICE_KEY = "clardentity.model.choice";

let models: PickableModel[] | null = null;
let inFlight: Promise<void> | null = null;
let choices: Record<string, string> = {};
let loadedChoices = false;
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

function readChoices(): Record<string, string> {
  if (loadedChoices) return choices;
  loadedChoices = true;
  try {
    choices = JSON.parse(localStorage.getItem(CHOICE_KEY) || "{}");
  } catch {
    choices = {};
  }
  return choices;
}

export function getModels(): PickableModel[] | null {
  return models;
}

/** Null means "let Clardentity choose", which is the default and a real
 *  option in the list rather than an absence. */
export function getChoice(mode: string): string | null {
  return readChoices()[mode] ?? null;
}

export function getServerSnapshot(): null {
  return null;
}

export function setChoice(mode: string, id: string | null) {
  const next = { ...readChoices() };
  if (id) next[mode] = id;
  else delete next[mode];
  choices = next;
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(next));
  } catch {
    // A private window still gets the choice for this session.
  }
  emit();
}

/** Fetch the list once. Safe to call on every mount. */
export function loadModels(mode: string): Promise<void> {
  if (models !== null) return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = apiFetch<{ models: PickableModel[] }>(
    `/chat/models?mode=${encodeURIComponent(mode)}`,
  )
    .then((data) => {
      models = data.models ?? [];
    })
    .catch(() => {
      // No list is not an error worth showing: the composer simply falls
      // back to Clardentity choosing, which is what it did before.
      models = [];
    })
    .finally(() => {
      inFlight = null;
      emit();
    });
  return inFlight;
}

/** A snapshot both the picker and the send path can read. */
export function snapshot(mode: string): { models: PickableModel[]; choice: string | null } {
  return { models: models ?? [], choice: getChoice(mode) };
}
