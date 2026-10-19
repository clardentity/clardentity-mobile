import { useCallback } from "react";
import { Easing, FadeInUp } from "react-native-reanimated";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

/** The web's `.phone-rise` (globals.css): list rows fade up into place one
 *  after another, 120ms apart, the stagger capped at the tenth row. Returns
 *  the `entering` animation for row `i`, or nothing when the OS asks for
 *  less motion. */
export function useRise() {
  const reduced = usePrefersReducedMotion();
  return useCallback(
    (i: number) =>
      reduced
        ? undefined
        : FadeInUp.duration(850)
            .delay(Math.min(i, 10) * 120)
            .easing(Easing.bezier(0.22, 1, 0.36, 1)),
    [reduced],
  );
}
