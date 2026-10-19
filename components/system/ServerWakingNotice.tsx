import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useServerWait } from "@/lib/serverWait";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import { fonts, fontSize, px, radius, space, useColors } from "@/lib/theme";
import { TOPBAR_HEIGHT } from "@/components/system/shellMetrics";

/** Says why nothing is happening while the backend wakes from a quiet spell
 *  (see lib/serverWait) - on the login screen, behind the first spinner, on
 *  any list - instead of a spinner that might as well be a hang. It goes
 *  once the server answers. */
export function ServerWakingNotice() {
  const wait = useServerWait();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: insets.top + TOPBAR_HEIGHT + 8,
        zIndex: 60,
        alignItems: "center",
        paddingHorizontal: space(4),
      }}
    >
      {wait !== "none" && (
        <Animated.View
          testID="server-waking"
          entering={reducedMotion ? undefined : FadeIn.duration(300)}
          style={{
            maxWidth: px(384),
            flexDirection: "row",
            alignItems: "center",
            gap: space(2.5),
            borderRadius: radius["2xl"],
            borderWidth: 1,
            borderColor: c.hairlineStrong,
            backgroundColor: c.surfaceRaised,
            paddingHorizontal: space(4),
            paddingVertical: space(2.5),
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          <PulseDot color={c.brand} still={reducedMotion} />
          <Text accessibilityRole="alert" style={{ flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.ink }}>
            {wait === "waking"
              ? "Waking the server up - this can take up to a minute after a quiet spell."
              : "Still waking up - nearly there. Nothing you've done is lost."}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

/** Tailwind's animate-pulse: opacity 1 -> 0.5 and back over 2s. */
function PulseDot({ color, still }: { color: string; still: boolean }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (still) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.5, { duration: 1000 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [still, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />;
}
