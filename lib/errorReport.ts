import { routePattern } from "@/lib/analytics";

/* Crash reports from the error screens' "Report" link.
 *
 * Sent through PostHog, the analytics the app already has, as one
 * `error_reported` event. Analytics normally waits for consent; tapping
 * "Send report" is that consent for this one event, and nothing else - a
 * separate, memory-only client is created for it if analytics isn't running,
 * and nothing is tracked after it.
 *
 * What goes: the reference shown to the person, which part of the app
 * failed, the error's type, the first frame of its stack, and the route
 * pattern (never the path - a chat path carries its conversation id). What
 * never goes: the error message, which can quote whatever was on screen. */

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

/* The current route, set by the root layout on every navigation - the
   native stand-in for window.location.pathname. */
let currentPath = "/";
export function setErrorReportRoute(path: string) {
  currentPath = path;
}

/** A short reference to quote to support: "7F3A-C21D". */
export function makeErrorRef(): string {
  const hex = Array.from({ length: 4 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** Sends the report; resolves to whether it actually left the phone. A
 *  build without an analytics key has nowhere to send it, and the screen
 *  says so rather than claiming it was sent. */
export async function sendErrorReport(ref: string, where: string, error: Error): Promise<boolean> {
  if (!KEY) return false;
  try {
    const { PostHog } = await import("posthog-react-native");
    const client = new PostHog(KEY, {
      host: HOST,
      persistence: "memory",
      captureAppLifecycleEvents: false,
      personProfiles: "identified_only",
      flushAt: 1,
    });
    const frame = (error.stack ?? "").split("\n")[1] ?? "";
    client.capture("error_reported", {
      ref,
      where,
      error_type: error.name || "Error",
      frame: frame.trim().slice(0, 160),
      route: routePattern(currentPath),
    });
    await client.flush();
    return true;
  } catch {
    return false;
  }
}
