import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/* The web app reads localStorage and sessionStorage synchronously all over
 * lib/ - the theme, the last workspace, the tour, the consent choice. React
 * Native has no synchronous store, so this keeps one in memory, fills it once
 * from disk before the first screen renders (hydrateStorage, called by the
 * root layout), and writes every change back in the background.
 *
 * The session tokens are the exception: they go to the Keychain / Keystore
 * through expo-secure-store rather than AsyncStorage, which is a plain file.
 * Which keys count as secret is decided here, so lib/auth.tsx keeps calling
 * the same getItem/setItem it always did.
 *
 * sessionStorage is memory only - the closest thing a native app has to "this
 * tab": it lasts until the process is killed. */

const PREFIX = "clardentity:";
const SECURE_KEYS = new Set(["clardentity_access_token", "clardentity_refresh_token"]);

type Listener = (key: string) => void;

class SyncStorage {
  private values = new Map<string, string>();
  private listeners = new Set<Listener>();

  constructor(private readonly persist: boolean) {}

  getItem(key: string): string | null {
    return this.values.has(key) ? (this.values.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
    if (this.persist) void write(key, String(value));
    this.emit(key);
  }

  removeItem(key: string): void {
    this.values.delete(key);
    if (this.persist) void remove(key);
    this.emit(key);
  }

  /** Filled from disk at startup; not a write, so nothing is persisted. */
  seed(key: string, value: string) {
    this.values.set(key, value);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(key: string) {
    this.listeners.forEach((l) => l(key));
  }
}

function secureKey(key: string): string {
  // SecureStore keys allow only [A-Za-z0-9._-].
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

async function write(key: string, value: string) {
  try {
    if (SECURE_KEYS.has(key)) await SecureStore.setItemAsync(secureKey(key), value);
    else await AsyncStorage.setItem(PREFIX + key, value);
  } catch {
    // A failed write costs the value on the next launch, nothing more.
  }
}

async function remove(key: string) {
  try {
    if (SECURE_KEYS.has(key)) await SecureStore.deleteItemAsync(secureKey(key));
    else await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export const localStorage = new SyncStorage(true);
export const sessionStorage = new SyncStorage(false);

let hydrated: Promise<void> | null = null;

/** Load everything from disk into memory. Safe to call more than once. */
export function hydrateStorage(): Promise<void> {
  if (!hydrated) {
    hydrated = (async () => {
      try {
        const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
        const pairs = await AsyncStorage.multiGet(keys);
        for (const [k, v] of pairs) if (v !== null) localStorage.seed(k.slice(PREFIX.length), v);
      } catch {
        // Nothing stored, or storage unavailable: start clean.
      }
      for (const key of SECURE_KEYS) {
        try {
          const v = await SecureStore.getItemAsync(secureKey(key));
          if (v !== null) localStorage.seed(key, v);
        } catch {
          // ignore
        }
      }
    })();
  }
  return hydrated;
}
