import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  DeviceEventEmitter,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { usePathname } from "expo-router";
import { layoutViewport } from "@/lib/uiScale";
import { useTour } from "@/lib/tour";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import { useTouchKeyboard } from "@/lib/useTouchKeyboard";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

type Rect = { top: number; left: number; width: number; height: number };
type Pos = { top: number; left: number };

/* ----------------------------------------------------------- targets -- */

/* On the web a step names its target by a `data-tour` attribute and the
 * overlay finds it with querySelectorAll. A native view tree can't be
 * queried, so targets register themselves here instead: wrap the element in
 * <TourTarget id="..."> (or spread useTourTarget(id) onto a View) and the
 * overlay measures it in window coordinates each frame.
 *
 * Several views may register under one name - the same shape as the web's
 * duplicated sidebar - and the first one that measures as visible wins. A
 * step whose target never registers falls back to an anchorless, centred
 * callout after the grace period, as on the web. */

type TargetRef = { current: ViewInstance | null };
const targets = new Map<string, Set<TargetRef>>();

function register(id: string, ref: TargetRef) {
  let set = targets.get(id);
  if (!set) {
    set = new Set();
    targets.set(id, set);
  }
  set.add(ref);
  return () => {
    set.delete(ref);
    if (set.size === 0) targets.delete(id);
  };
}

function measure(ref: TargetRef): Promise<Rect | null> {
  return new Promise((resolve) => {
    const view = ref.current;
    if (!view) return resolve(null);
    try {
      view.measureInWindow((x, y, width, height) => resolve({ top: y, left: x, width, height }));
    } catch {
      resolve(null);
    }
  });
}

/** The first registered view for `target` that is actually on screen. A
 *  drawer parked off the left edge keeps its size, so "horizontally off
 *  screen" counts as not here; vertically off screen is left alone. */
async function resolveVisibleTarget(target: string): Promise<Rect | null> {
  const set = targets.get(target);
  if (!set) return null;
  const view = layoutViewport();
  for (const ref of set) {
    const rect = await measure(ref);
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    if (rect.left + rect.width <= 0 || rect.left >= view.width) continue;
    return rect;
  }
  return null;
}

/** Marks a View as a coachmark target - the native `data-tour`. Spread the
 *  result onto the View: `<View {...useTourTarget("new-chat")}>`. Passing no
 *  id registers nothing, so a component can take an optional `tourId`. */
export function useTourTarget(id?: string | null): { ref: TargetRef; collapsable: false } {
  const ref = useRef<ViewInstance | null>(null);
  useEffect(() => (id ? register(id, ref) : undefined), [id]);
  return { ref, collapsable: false };
}

/** The same, as a callback ref, for a view that is not its own component:
 *  `<Pressable ref={tourRef("new-chat")} collapsable={false}>`. React 19 runs
 *  the returned cleanup when the view unmounts. Pass null to mark nothing. */
export function tourRef(id: string | null | undefined) {
  return (view: ViewInstance | null) => {
    if (!id || !view) return;
    return register(id, { current: view });
  };
}

/** A View that is a coachmark target. `id` is the web's `data-tour` value. */
export function TourTarget({
  id,
  style,
  children,
  ...rest
}: Omit<ViewProps, "style"> & { id?: string | null; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const target = useTourTarget(id);
  return (
    <View {...rest} {...target} style={style}>
      {children}
    </View>
  );
}

/* ----------------------------------------------------------- overlay -- */

const GRACE_MS = 500;
const MARGIN = 12;
const CALLOUT_WIDTH = px(288);

/** Where a tour has anything to point at. The overlay lives in the root
 *  layout, so without this a tour left half-finished drew its coachmark over
 *  the marketing page and the login card - which is what a new account sees
 *  if it signs up, starts the tour and then taps the wordmark. Suspended,
 *  not cancelled: coming back to the app picks it up where it was. */
const APP_ROUTES = /^\/(chat|workspace|profile|admin)(\/|$)/;

/* Not a Modal, deliberately. The web's spotlight is a box-shadow, which never
 * takes part in hit-testing, so the page under it stays fully usable - "cancel
 * at any time", and tapping the real New chat button through the tour, come
 * for free. A Modal would block the page (and sit under the phone drawer's
 * own layer order rules). Instead this is a full-window layer mounted after
 * the navigator in the root layout, with pointerEvents="box-none": the dim
 * is four rects around the target that pass touches through, and only the
 * callout itself takes them. */
export function TourOverlay() {
  const { tour, active, step, stepIndex, total, isLast, advance, skip } = useTour();
  const inApp = APP_ROUTES.test(usePathname() ?? "");
  const reducedMotion = usePrefersReducedMotion();
  const touchKeyboard = useTouchKeyboard();
  const c = useColors();
  const s = useThemedStyles(styles);
  const panelRef = useRef<ViewInstance>(null);
  const panelSize = useRef<{ width: number; height: number } | null>(null);
  // Per-step one-shots, keyed on the step so they fire once per step and
  // again for the next one: focus and the drawer request.
  const stepKey = `${tour ?? ""}:${stepIndex}`;
  // Measurements are stamped with the step they belong to and read back
  // only for the current one, so a new step starts with no ring and a
  // hidden callout rather than inheriting the previous step's for however
  // long its own first measurement takes (a stale ring around the wrong
  // thing is worse than a blank frame).
  const [ringState, setRingState] = useState<{ key: string; rect: Rect } | null>(null);
  const [calloutState, setCalloutState] = useState<{ key: string; pos: Pos } | null>(null);
  const ringRect = ringState && ringState.key === stepKey ? ringState.rect : null;
  const calloutPos = calloutState && calloutState.key === stepKey ? calloutState.pos : null;
  const focusedStepRef = useRef<string | null>(null);
  const drawerAskedRef = useRef<string | null>(null);
  const opacity = useSharedValue(0);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  /* Re-resolves every frame rather than once: a target can be swapped for a
   * structurally different view (the mode picker does exactly that when a
   * mode is chosen), and right after a route change the next step's target
   * may not have mounted for a frame or two. Polling absorbs both, and
   * doubles as rotation/keyboard/scroll handling. */
  useEffect(() => {
    if (!active || !step || !inApp) return;

    let raf = 0;
    let cancelled = false;
    const startedAt = Date.now();

    // A step whose target is on the page itself must not be read through
    // the phone's nav drawer, which an earlier sidebar step may have opened.
    // No-op wherever the drawer isn't open (AppShell listens).
    if (!step.sidebar) DeviceEventEmitter.emit("clardentity:close-nav");

    function placeCallout(top: number, left: number) {
      setCalloutState((prev) =>
        prev && prev.key === stepKey && prev.pos.top === top && prev.pos.left === left
          ? prev
          : { key: stepKey, pos: { top, left } },
      );
    }

    async function tick() {
      if (cancelled) return;
      const panel = panelSize.current;
      const rect = await resolveVisibleTarget(step!.target);
      if (cancelled) return;

      if (panel) {
        const view = layoutViewport();

        if (rect) {
          setRingState((prev) =>
            prev &&
            prev.key === stepKey &&
            prev.rect.top === rect.top &&
            prev.rect.left === rect.left &&
            prev.rect.width === rect.width &&
            prev.rect.height === rect.height
              ? prev
              : { key: stepKey, rect },
          );

          let left = rect.left;
          left = Math.min(left, view.width - panel.width - MARGIN);
          left = Math.max(left, MARGIN);

          const bottom = rect.top + rect.height;
          let top = bottom + MARGIN;
          if (top + panel.height + MARGIN > view.height) {
            top = rect.top - panel.height - MARGIN;
          }
          top = Math.min(top, view.height - panel.height - MARGIN);
          top = Math.max(top, MARGIN);

          placeCallout(top, left);
        } else if (step!.sidebar && drawerAskedRef.current !== stepKey) {
          // A sidebar target that can't be found is the closed drawer. Ask
          // the shell to open it; the next frames then find the real view.
          // Once per step, so someone who deliberately closes it isn't fought.
          drawerAskedRef.current = stepKey;
          DeviceEventEmitter.emit("clardentity:open-nav");
        } else if (Date.now() - startedAt > GRACE_MS) {
          // Anchorless fallback: the target isn't reachable right now (not
          // registered, or the user wandered elsewhere). Stay dismissable and
          // legible rather than disappearing or waiting indefinitely.
          setRingState((prev) => (prev && prev.key === stepKey ? null : prev));
          placeCallout((view.height - panel.height) / 2, (view.width - panel.width) / 2);
        }
        // Within the grace period and not yet found: leave state as-is so
        // nothing flashes at a wrong position for one frame.
      }

      raf = requestAnimationFrame(() => void tick());
    }

    raf = requestAnimationFrame(() => void tick());
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, step, stepKey, inApp]);

  // Fade in once per step, at the first moment it has a real position, and
  // move screen-reader focus to it - what makes a step change perceivable
  // to someone using VoiceOver or TalkBack.
  const visible = calloutPos !== null;
  useEffect(() => {
    if (!active) return;
    if (!visible) {
      opacity.value = 0;
      return;
    }
    opacity.value = reducedMotion ? 1 : withTiming(1, { duration: 350 });
    if (focusedStepRef.current === stepKey) return;
    focusedStepRef.current = stepKey;
    if (panelRef.current) AccessibilityInfo.sendAccessibilityEvent(panelRef.current, "focus");
  }, [active, visible, stepKey, reducedMotion, opacity]);

  // Android's Back ends the tour, as Escape did on the web - scoped to
  // exactly while it's active. A drawer opened later registers after this
  // and so is closed first.
  useEffect(() => {
    if (!active || !inApp) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      skip();
      return true;
    });
    return () => sub.remove();
  }, [active, inApp, skip]);

  if (!active || !step || !inApp) return null;

  const view = layoutViewport();
  const ring = ringRect
    ? { top: ringRect.top - 4, left: ringRect.left - 4, width: ringRect.width + 8, height: ringRect.height + 8 }
    : null;

  function onPanelLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    panelSize.current = { width, height };
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {ring && (
        // The dim, as four rects around the cut-out, and the ring itself. None
        // of them take touches - the page stays usable throughout. No
        // transition, deliberately: the loop re-measures every frame and a
        // page can settle across several measurements right after mounting;
        // an animated ring visibly lagged behind its target.
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[s.dim, { top: 0, left: 0, right: 0, height: Math.max(0, ring.top) }]} />
          <View style={[s.dim, { top: ring.top + ring.height, left: 0, right: 0, bottom: 0 }]} />
          <View style={[s.dim, { top: ring.top, left: 0, width: Math.max(0, ring.left), height: ring.height }]} />
          <View style={[s.dim, { top: ring.top, left: ring.left + ring.width, right: 0, height: ring.height }]} />
          <View
            style={{
              position: "absolute",
              top: ring.top,
              left: ring.left,
              width: ring.width,
              height: ring.height,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: c.brand,
            }}
          />
        </View>
      )}
      <Animated.View
        ref={panelRef}
        onLayout={onPanelLayout}
        pointerEvents={visible ? "auto" : "none"}
        style={[
          s.panel,
          {
            top: calloutPos ? calloutPos.top : 0,
            left: calloutPos ? calloutPos.left : 0,
            maxWidth: view.width - MARGIN * 2,
          },
          fade,
        ]}
      >
        <Text style={s.kicker}>
          {tour === "chat" ? "Chat tour" : "Workspace tour"} · {stepIndex + 1} of {total}
        </Text>
        <Text accessibilityRole="header" style={s.title}>
          {step.title}
        </Text>
        <Text style={s.body}>{touchKeyboard && step.touchBody ? step.touchBody : step.body}</Text>
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={skip}
            hitSlop={8}
            style={({ pressed }) => [s.skip, pressed && { backgroundColor: c.surfaceHover }]}
          >
            <Text style={s.skipText}>Skip tour</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={advance}
            hitSlop={8}
            style={({ pressed }) => [s.next, { backgroundColor: pressed ? c.brandDark : c.brand }]}
          >
            <Svg
              viewBox="0 0 24 24"
              width={px(14)}
              height={px(14)}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M5 12.5l4.5 4.5L19 7" />
            </Svg>
            <Text style={s.nextText}>{isLast ? "Finish" : "Next"}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    dim: { position: "absolute", backgroundColor: "rgba(0,0,0,0.6)" },
    panel: {
      position: "absolute",
      width: CALLOUT_WIDTH,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surfaceRaised,
      padding: space(4),
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
    kicker: {
      fontFamily: fonts.semibold,
      fontSize: fontSize.xs,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.brand,
    },
    title: { marginTop: space(1), fontFamily: fonts.semibold, fontSize: fontSize.sm, color: c.ink },
    body: {
      marginTop: space(1),
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      lineHeight: fontSize.sm * 1.625,
      color: c.inkSecondary,
    },
    actions: { marginTop: space(3), flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(3) },
    skip: { borderRadius: radius.full, paddingHorizontal: space(2.5), paddingVertical: space(1.5) },
    skipText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.inkMuted },
    next: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(1.5),
      borderRadius: radius.full,
      paddingHorizontal: space(3.5),
      paddingVertical: space(1.5),
    },
    nextText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: "#ffffff" },
  });
