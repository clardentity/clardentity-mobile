import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Whether the user has asked for less motion (iOS Reduce Motion, Android
 *  "Remove animations"). Starts at `true` - assume reduced motion until the
 *  OS says otherwise - for the same reason the web's server snapshot did:
 *  animating something and then taking it away is the jolt the setting
 *  exists to prevent. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduced(v));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
