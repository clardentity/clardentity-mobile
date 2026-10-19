import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import { fonts, fontSize, px, space, useColors } from "@/lib/theme";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

/* A rabbit in a pocket, and one word. Nothing about *what* is being done -
 * no phases, no rotating verbs, no reasoning lens - is shown while an answer
 * is being written; the work happens under the hood and the gist arrives
 * when it's ready. The mascot exists so a few seconds of waiting have
 * something alive to look at rather than a spinner.
 *
 * `label` is for the two moments that aren't generation ("Opening the
 * chat"); left out, it says Thinking. */

/* The web animated the SVG's own groups from CSS (globals.css, .rabbit-*):
 * the head bobs 1.2 units, each ear swings ±7° about its root, the right ear
 * half a cycle behind the left, 1.8s a cycle. Animating transforms on SVG
 * groups is unreliable natively, so the drawing is split into layers - one
 * Svg per moving part, stacked in the same box - and each layer is a View
 * that reanimated can turn. Same drawing, same motion. */

const VIEWBOX = 32;
const HALF_CYCLE_MS = 900;

function Rabbit({ size }: { size: number }) {
  const c = useColors();
  const reducedMotion = usePrefersReducedMotion();
  // 0 at rest, 1 at the far end of the swing; ping-pongs with ease-in-out,
  // which is what the 0% / 50% / 100% keyframes drew.
  const swing = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(swing);
      swing.value = 0;
      return;
    }
    swing.value = withRepeat(
      withTiming(1, { duration: HALF_CYCLE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(swing);
  }, [reducedMotion, swing]);

  const unit = size / VIEWBOX;
  const head = useAnimatedStyle(() => ({ transform: [{ translateY: -1.2 * unit * swing.value }] }));
  const earL = useAnimatedStyle(() => ({ transform: [{ rotate: `${-7 + 14 * swing.value}deg` }] }));
  // animation-delay -0.9s: the right ear starts where the left is halfway.
  const earR = useAnimatedStyle(() => ({ transform: [{ rotate: `${7 - 14 * swing.value}deg` }] }));

  const box = { width: size, height: size };
  const layer = [StyleSheet.absoluteFill, box];
  const viewBox = `0 0 ${VIEWBOX} ${VIEWBOX}`;

  return (
    <View style={box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[layer, head]}>
        {/* Ears: outer in the avatar's skin tone, inner in a brand tint. */}
        <Animated.View style={[layer, { transformOrigin: [12.5 * unit, 13 * unit, 0] }, earL]}>
          <Svg width={size} height={size} viewBox={viewBox}>
            <Ellipse cx="12.5" cy="7.5" rx="2.4" ry="6" transform="rotate(-14 12.5 13)"
              fill={c.avatarSkin} stroke={c.avatarSkinShade} strokeWidth="0.8" />
            <Ellipse cx="12.5" cy="8" rx="1.1" ry="4" transform="rotate(-14 12.5 13)"
              fill={c.brand} opacity={0.35} />
          </Svg>
        </Animated.View>
        <Animated.View style={[layer, { transformOrigin: [19.5 * unit, 13 * unit, 0] }, earR]}>
          <Svg width={size} height={size} viewBox={viewBox}>
            <Ellipse cx="19.5" cy="7.5" rx="2.4" ry="6" transform="rotate(14 19.5 13)"
              fill={c.avatarSkin} stroke={c.avatarSkinShade} strokeWidth="0.8" />
            <Ellipse cx="19.5" cy="8" rx="1.1" ry="4" transform="rotate(14 19.5 13)"
              fill={c.brand} opacity={0.35} />
          </Svg>
        </Animated.View>
        <Svg width={size} height={size} viewBox={viewBox} style={StyleSheet.absoluteFill}>
          <G>
            <Circle cx="16" cy="17.5" r="6.6" fill={c.avatarSkin} stroke={c.avatarSkinShade} strokeWidth="0.8" />
            <Circle cx="13.6" cy="16.8" r="0.95" fill={c.ink} />
            <Circle cx="18.4" cy="16.8" r="0.95" fill={c.ink} />
            <Path d="M15 19.4h2l-1 1.1z" fill={c.brand} opacity={0.8} />
            {/* Whiskers */}
            <Path d="M9.5 18.2h2.6M9.6 19.8l2.5-.5M22.5 18.2h-2.6M22.4 19.8l-2.5-.5"
              stroke={c.avatarSkinShade} strokeWidth="0.6" strokeLinecap="round" />
          </G>
        </Svg>
      </Animated.View>
      {/* Pocket, drawn last so the rabbit sits inside it. */}
      <Svg width={size} height={size} viewBox={viewBox} style={StyleSheet.absoluteFill}>
        <Path d="M5 20.5h22v4.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"
          fill={c.brandSoft} stroke={c.brandBorder} strokeWidth="1" />
        <Path d="M7.5 22.8h17" stroke={c.brandBorder} strokeWidth="0.8"
          strokeDasharray="1.6 1.4" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** The trailing ellipsis, breathing - Tailwind's animate-pulse (opacity
 *  1 → 0.5 → 1 over two seconds). Still under reduced motion. */
function PulsingEllipsis({ style }: { style: object }) {
  const reducedMotion = usePrefersReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.5, { duration: 1000, easing: Easing.bezier(0.4, 0, 0.6, 1) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reducedMotion, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.Text style={[style, animated]}>…</Animated.Text>;
}

export function ThinkingIndicator({
  label,
  compact = false,
}: {
  label?: string | null;
  /** Inside an answer bubble under the gist, rather than standing alone. */
  compact?: boolean;
}) {
  const c = useColors();
  const text = label ?? "Thinking";
  const textStyle = {
    fontFamily: fonts.regular,
    fontSize: compact ? fontSize.xs : fontSize.sm,
    color: c.inkMuted,
  };
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: compact ? space(1.5) : space(2) }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
    >
      <Rabbit size={compact ? px(20) : px(28)} />
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <Text style={textStyle}>{text}</Text>
        <PulsingEllipsis style={textStyle} />
      </View>
    </View>
  );
}
