/* An on-screen keyboard, rather than a real one.
 *
 * On the web, Enter sends on a laptop and makes a new line on a phone. In the
 * app the keyboard is always the on-screen kind (a hardware keyboard on an
 * iPad still goes through the same TextInput), so Return is the new line and
 * the send button is the only way to send. Kept as a hook so the composer
 * ported from the web asks the same question. */
export function useTouchKeyboard(): boolean {
  return true;
}
