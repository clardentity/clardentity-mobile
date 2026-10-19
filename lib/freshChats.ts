/* Chats this tab has just created and not yet opened.
 *
 * Opening a chat loads its history first, and until that answers the page
 * can't know whether the chat is empty - so it laid out for a thread, with
 * the composer on the floor, and then snapped it up to the centre when the
 * history came back empty. A chat we created a moment ago is known to be
 * empty, so the page can lay it out as a new chat from the first frame.
 *
 * Module state rather than a URL flag: it is a hint for the next render of
 * this tab, not something a shared or reloaded link should carry. */

const fresh = new Set<string>();

/** Call just before navigating to a chat this tab has just created. */
export function markFreshChat(id: string): void {
  fresh.add(id);
}

/** Whether `id` was created by this tab and hasn't been opened yet. */
export function isFreshChat(id: string): boolean {
  return fresh.has(id);
}

/** Once the history has loaded, the chat is no longer a guess. */
export function forgetFreshChat(id: string): void {
  fresh.delete(id);
}
