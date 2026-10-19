import { useEffect, useRef } from "react";
import { Dimensions } from "react-native";
import { usePathname } from "expo-router";
import { identify, resetIdentity, routePattern, track, trackPageView } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { useConsent } from "@/lib/consent";

/** Mounted once, under the providers. Sends the session-level events - the
 *  app opening, who is signed in (by account id; never an email), and which
 *  screen is on - and nothing at all when no analytics key is configured. */
export function Analytics() {
  const pathname = usePathname();
  const { user } = useAuth();
  // Consent usually arrives after the app has opened - somebody reads the
  // banner and taps Allow - so every effect here keys on it and runs from
  // that moment. Without this the first session after agreeing would be
  // missing its opening events.
  const consent = useConsent();
  const opened = useRef(false);
  const identified = useRef<string | null>(null);

  useEffect(() => {
    if (consent !== "granted" || opened.current) return;
    opened.current = true;
    const width = Dimensions.get("window").width;
    track("app_opened", {
      // Enough to tell a phone from a tablet, which is the one split that
      // changes what the screens have to do. Not a fingerprint.
      viewport: width < 640 ? "phone" : width < 1024 ? "tablet" : "desktop",
      // The web asked whether it was running as an installed PWA; a native
      // app always is.
      installed: true,
    });
  }, [consent]);

  useEffect(() => {
    trackPageView(routePattern(pathname));
  }, [pathname, consent]);

  useEffect(() => {
    if (consent !== "granted") {
      // Withdrawn, or never given: drop any identity the SDK is holding.
      if (identified.current) {
        identified.current = null;
        resetIdentity();
      }
      return;
    }
    if (user && identified.current !== user.id) {
      identified.current = user.id;
      identify(user.id);
      track("signed_in");
    } else if (!user && identified.current) {
      identified.current = null;
      resetIdentity();
    }
  }, [user, consent]);

  return null;
}
