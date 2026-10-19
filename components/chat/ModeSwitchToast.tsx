import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { fonts, fontSize, px, radius, space, useThemedStyles, type Colors } from "@/lib/theme";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

/* Smart switching told you after the fact, in a banner. This tells you as
 * it happens: "Switched to Decision-making" over the composer while the new
 * answer is being written, with a ring counting four seconds down and one
 * button to stop that answer and have the question answered in the mode you
 * had chosen instead ("Stay in Finder", the client's wording). When the
 * ring runs out the card goes; the way back for the *next* question stays
 * in the banner. Four seconds, not ten: the switch has already happened,
 * and a long countdown made it feel like it was still happening - it is a
 * moment to say no, not a wait. */

const SECONDS = 4;
const R = 9;
const CIRCUMFERENCE = 2 * Math.PI * R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ModeSwitchToast({
  from,
  to,
  onRevert,
  onDismiss,
}: {
  from: string;
  to: string;
  onRevert: () => void;
  onDismiss: () => void;
}) {
  const s = useThemedStyles(styles);
  const reducedMotion = usePrefersReducedMotion();
  const [left, setLeft] = useState(SECONDS);
  const offset = useSharedValue(0);
  const [mountedAt] = useState(() => Date.now());

  // One countdown per mount. `onDismiss` is a dependency, so the parent
  // passes a stable callback (a setState setter) rather than an inline
  // closure, or the timer would restart on every render.
  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      const remaining = Math.max(0, SECONDS - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
    }, 250);
    const done = setTimeout(onDismiss, SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [onDismiss]);

  // The ring empties over the four seconds. Under reduced motion it steps
  // once a second with the number instead of sweeping.
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(offset);
      offset.value = CIRCUMFERENCE * (1 - left / SECONDS);
    }
  }, [reducedMotion, left, offset]);
  useEffect(() => {
    if (reducedMotion) return;
    // The motion setting is read asynchronously, so the sweep may start a
    // beat late: it starts from where the ring should be by now.
    const elapsed = Math.min(SECONDS * 1000, Date.now() - mountedAt);
    offset.value = CIRCUMFERENCE * (elapsed / (SECONDS * 1000));
    offset.value = withTiming(CIRCUMFERENCE, { duration: SECONDS * 1000 - elapsed, easing: Easing.linear });
    return () => cancelAnimation(offset);
  }, [reducedMotion, offset, mountedAt]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <Animated.View entering={FadeIn.duration(250)} style={s.card} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={s.ring} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg viewBox="0 0 24 24" width={px(24)} height={px(24)} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx="12" cy="12" r={R} fill="none" stroke={s.colors.brandBorder} strokeWidth="2" />
          <AnimatedCircle
            cx="12"
            cy="12"
            r={R}
            fill="none"
            stroke={s.colors.brand}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE}`}
            animatedProps={ringProps}
          />
        </Svg>
        <Text style={s.count}>{left}</Text>
      </View>
      <Text style={s.message}>
        <Text style={s.strong}>Switched to {to}</Text>
        <Text style={s.secondary}> - it suits this question better.</Text>
      </Text>
      <Pressable
        onPress={onRevert}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [s.button, pressed && { backgroundColor: s.colors.surfaceHover }]}
      >
        <Text style={s.buttonText}>Stay in {from}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = (c: Colors) => ({
  colors: c,
  ...StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(3),
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.brandBorder,
      backgroundColor: c.brandSoft,
      paddingHorizontal: space(3),
      paddingVertical: space(2),
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    ring: { width: px(24), height: px(24), alignItems: "center", justifyContent: "center" },
    count: {
      position: "absolute",
      fontFamily: fonts.semibold,
      fontSize: fontSize.xs,
      color: c.brand,
      fontVariant: ["tabular-nums"],
    },
    message: { flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.ink },
    strong: { fontFamily: fonts.medium },
    secondary: { color: c.inkSecondary },
    button: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.brandBorder,
      backgroundColor: c.surface,
      paddingHorizontal: space(2.5),
      paddingVertical: space(1),
    },
    buttonText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.brand },
  }),
});
