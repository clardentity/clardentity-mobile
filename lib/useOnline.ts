import NetInfo from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";

/* Whether the phone thinks it has a network. As on the web, "online" is only
 * half a promise - a captive portal or a dead cell link still reports it -
 * but "offline" is reliable, and offline is the case worth telling someone
 * about: what they do next won't be saved. A sleeping backend is a different
 * thing (online, just slow), and the requests themselves report that. */

let online = true;
const listeners = new Set<() => void>();

NetInfo.addEventListener((state) => {
  const next = state.isConnected !== false;
  if (next !== online) {
    online = next;
    listeners.forEach((l) => l());
  }
});

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => online, () => true);
}
