import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type StyleProp, type ViewInstance, type ViewStyle } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { px } from "@/lib/theme";

/* Scroll-in reveal, the way a marketing page does it: a thing is nowhere,
 * then it is there, and you never catch it arriving.
 *
 * The web gave each element its own IntersectionObserver. React Native has
 * none, so the page's ScrollView reports where it is (RevealScope, below) and
 * each piece checks itself against that: where it sits on the window when
 * laid out, plus how far the page has scrolled, is where it sits in the page.
 *
 * Once revealed, it stays revealed. Re-hiding on scroll-up is a thing pages
 * do and nobody likes: scrolling back should show you what you just read,
 * not replay it.
 */

type Listener = (scrollY: number, viewport: number) => void;

type Scope = {
  subscribe: (listener: Listener) => () => void;
  current: () => { scrollY: number; viewport: number };
};

const RevealContext = createContext<Scope | null>(null);

/** The page side: one per ScrollView. Call `report` from onScroll and from
 *  the ScrollView's onLayout. */
export function useRevealScope(): { scope: Scope; report: (scrollY: number, viewport?: number) => void } {
  const state = useRef({ scrollY: 0, viewport: 0 });
  const listeners = useRef(new Set<Listener>());
  const scope = useMemo<Scope>(
    () => ({
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
      current: () => state.current,
    }),
    [],
  );
  const report = useCallback((scrollY: number, viewport?: number) => {
    state.current = { scrollY, viewport: viewport ?? state.current.viewport };
    listeners.current.forEach((l) => l(state.current.scrollY, state.current.viewport));
  }, []);
  return { scope, report };
}

export function RevealScope({ scope, children }: { scope: Scope; children: ReactNode }) {
  return <RevealContext.Provider value={scope}>{children}</RevealContext.Provider>;
}

// The phone timing from globals.css: slower and longer, so the motion is
// seen rather than finished before the eye arrives - further to rise, and a
// beat more between siblings.
const RISE = px(36);
const DURATION = 1600;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export function Reveal({
  children,
  delay = 0,
  style,
  nativeID,
}: {
  children: ReactNode;
  /** Milliseconds behind the element's own entrance, for staggering a row. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  nativeID?: string;
}) {
  const scope = useContext(RevealContext);
  const ref = useRef<ViewInstance>(null);
  const top = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);

  const opacity = useSharedValue(0);
  const rise = useSharedValue(RISE);

  // No scope above this one: show it. The failure mode of this component
  // must be a page you can read.
  useEffect(() => {
    if (!scope) setVisible(true);
  }, [scope]);

  // Fires a fifth of the way up the screen, as the phone layout did, so it
  // plays where it's being looked at instead of at the very edge.
  const check = useCallback(
    (scrollY: number, viewport: number) => {
      if (top.current === null || viewport === 0) return;
      if (top.current < scrollY + viewport * 0.8) setVisible(true);
    },
    [],
  );

  useEffect(() => {
    if (!scope || visible) return;
    return scope.subscribe(check);
  }, [scope, visible, check]);

  const onLayout = useCallback(() => {
    if (!scope || visible) return;
    ref.current?.measureInWindow((_x, y) => {
      const { scrollY, viewport } = scope.current();
      top.current = y + scrollY;
      check(scrollY, viewport);
    });
  }, [scope, visible, check]);

  useEffect(() => {
    if (!visible) return;
    // Off under Reduce Motion: ReduceMotion.System jumps each timing to its
    // end. Read by Reanimated synchronously, rather than through
    // usePrefersReducedMotion - that hook starts at "reduced" and answers a
    // moment after mount, and the first sections are revealed before it has,
    // so they would never animate for anyone.
    const timing = { duration: DURATION, easing: EASE, reduceMotion: ReduceMotion.System };
    const wait = delay * 2.4 + 120;
    opacity.value = withDelay(wait, withTiming(1, timing));
    rise.value = withDelay(wait, withTiming(0, timing));
  }, [visible, delay, opacity, rise]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: rise.value }] }));

  return (
    <Animated.View ref={ref} nativeID={nativeID} onLayout={onLayout} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}
