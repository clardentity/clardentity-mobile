import { sessionStorage } from "@/lib/storage";
import { apiFetch } from "@/lib/apiClient";

/* The temporary chat this tab has open, if any - and the rule that leaving it
 * deletes it.
 *
 * Per tab, in sessionStorage, rather than a ref in the shell: the shell is
 * mounted per page (RequireAuth wraps each page in its own AppShell), so a
 * ref is gone by the time the next page could ask whether the chat it
 * replaced was temporary - which is how the first version of this missed
 * every departure. Module state fixed links but not a typed address or a
 * bookmark, which load a fresh page; sessionStorage survives those and dies
 * with the tab.
 *
 * So: another chat, another page or another address in this tab deletes it;
 * a reload of the chat itself keeps it (the held id is the one in view); a
 * closed tab never gets to say anything, which is what the server's sweep
 * is for (backend app/services/temporary_chats.py). */

const KEY = "clardentity-temporary-chat";

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(KEY, id);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage refused (private mode, blocked site data): leaving then only
    // deletes within this page, and the sweep covers the rest.
  }
}

// Mirrors the stored value, so a blocked sessionStorage still works within
// one page load.
let held: string | null = null;

/** Note that `id`, now on screen or about to be, is a temporary chat. */
export function holdTemporaryChat(id: string): void {
  held = id;
  write(id);
}

/** The chat in view is now `current` (null off the chat pages): delete the
 *  held temporary chat if this is not it. Idempotent, so StrictMode running
 *  the calling effect twice deletes once. */
export function leaveTemporaryChatUnless(current: string | null): void {
  const open = held ?? read();
  if (!open || open === current) return;
  held = null;
  write(null);
  // Nothing to say if it fails: the chat is in no list either way, and the
  // server sweeps what is left.
  apiFetch(`/chat/conversations/${encodeURIComponent(open)}`, { method: "DELETE" }).catch(() => {});
}
