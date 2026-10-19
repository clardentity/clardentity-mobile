import { useEffect, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

/* The curtain catches the light - a slow wave travelling across its folds.
 *
 * The effect is built out of the asset's own measurements. A column-
 * brightness profile of the stage image, autocorrelated, has its strongest
 * repeat at 1.9906% of its width: that is one fold to the next, about fifty
 * pleats across the stage. The colour is the mean of every lit-fabric pixel
 * in the same band, #a72341, with #d74564 for the edge of a fold turned
 * toward the light. So the bands land on the real folds and wear the
 * curtain's own burgundy.
 *
 * Each pleat is its own view rather than one repeating gradient, because the
 * wave has to move each fold by a different amount. They are flat colour,
 * not copies of the photograph, laid on with mixBlendMode "screen" - light on
 * fabric, not paint over it.
 *
 * This is the web's phone behaviour, which is the only one a phone has: the
 * curtain moves on its own, and the light rides the wave's crests. What the
 * native version approximates rather than reproduces:
 *  - The web shaped the light with a CSS radial mask. There are no masks
 *    here, so the same field is split into its two directions - a falloff
 *    across, baked into each pleat's opacity, and a falloff down, drawn
 *    into each pleat's gradient. Close to the ellipse, not the ellipse.
 *  - No touch light and no gusts: a finger on the stage lit it, and a drag
 *    sent wind along it. The stage is also the button that opens the demo
 *    here, so a finger on it is a tap, not a gesture to answer.
 *  - The wave runs on the UI thread (Reanimated) whenever the stage is
 *    mounted, rather than only while it is on screen.
 *
 * Nothing here runs under Reduce Motion.
 */

const PLEAT = 1.9906; // % of the stage's width, one fold to the next
const LIT = 0.62; // how much of a pleat catches the light
const COUNT = Math.ceil(100 / PLEAT) + 1;

const BURGUNDY = "#a72341";
const BURGUNDY_LIT = "#d74564";

/* Where the curtain is lit at all, measured off the picture: a luminance
 * field of the slice the design shows puts the bright arch at 50% across and
 * 36% down, half-strength from 30% to 70% horizontally and fading to nothing
 * below two thirds of the height - the bottom of the frame is black fabric.
 * The web's mask was radial-gradient(34% 54% at 50% 36%, #000 0%,
 * rgba(0,0,0,0.78) 42%, rgba(0,0,0,0.3) 72%, transparent 100%). */
function fieldAcross(x: number): number {
  const d = Math.abs(x - 50) / 34; // 0 at the centre, 1 at the edge of the field
  if (d >= 1) return 0;
  if (d <= 0.42) return 1 - (d / 0.42) * 0.22;
  if (d <= 0.72) return 0.78 - ((d - 0.42) / 0.3) * 0.48;
  return 0.3 - ((d - 0.72) / 0.28) * 0.3;
}
// Down: the same stops, about 36% (54% of the height either side of it).
const DOWN_COLORS = [
  "rgba(215,69,100,0.3)",
  "rgba(215,69,100,0.78)",
  "rgba(215,69,100,1)",
  "rgba(167,35,65,0.78)",
  "rgba(167,35,65,0.3)",
  "rgba(167,35,65,0)",
] as const;
const DOWN_STOPS = [0, 0.13, 0.36, 0.59, 0.75, 0.9] as const;

const PHONE_LIT = 0.9; // the light stays on - there is no hover to wait for
const PHONE_WAVE_LENGTH = 34; // % of the width from one crest to the next
const PHONE_WAVE_SPEED = 0.0013; // radians per ms - one crest to the next in ~5s
const PHONE_WAVE_SWAY = 0.5; // how far a fold moves with the wave, % of the stage
const PERIOD = (Math.PI * 2) / PHONE_WAVE_SPEED;

function Pleat({
  index,
  width,
  phase,
  lit,
}: {
  index: number;
  width: number;
  phase: SharedValue<number>;
  lit: SharedValue<number>;
}) {
  const x = index * PLEAT; // this pleat's position across the curtain
  const across = fieldAcross(x);
  const style = useAnimatedStyle(() => {
    // Every fold swings with the wave, and the light is brightest on the
    // crests, so bands of light travel across - narrow bands with dark
    // between, or the eye reads it as a steady glow.
    const angle = (x / PHONE_WAVE_LENGTH) * Math.PI * 2 - phase.value;
    const swing = Math.sin(angle) * PHONE_WAVE_SWAY;
    const crest = 0.5 + 0.5 * Math.cos(angle);
    const glow = 0.08 + 0.92 * crest * crest;
    return {
      opacity: glow * lit.value * 0.8 * across,
      // translate moves the fold; scaleX narrows it as it turns edge-on,
      // which is what sells the billow.
      transform: [{ translateX: (swing / 100) * width }, { scaleX: 1 + swing * 0.12 }],
    };
  });
  if (across === 0) return null;
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${x}%`,
          width: `${PLEAT * LIT}%`,
          mixBlendMode: "screen",
        },
        style,
      ]}
    >
      <LinearGradient colors={DOWN_COLORS} locations={DOWN_STOPS} style={{ flex: 1 }} />
    </Animated.View>
  );
}

export function CurtainShimmer({ style }: { style: StyleProp<ViewStyle> }) {
  const reducedMotion = usePrefersReducedMotion();
  const [width, setWidth] = useState(0);
  const phase = useSharedValue(0);
  const lit = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    phase.value = 0;
    phase.value = withRepeat(withTiming(Math.PI * 2, { duration: PERIOD, easing: Easing.linear }), -1, false);
    // Eased in, so the light comes up rather than switching on.
    lit.value = withTiming(PHONE_LIT, { duration: 1200 });
    return () => {
      cancelAnimation(phase);
      cancelAnimation(lit);
    };
  }, [reducedMotion, phase, lit]);

  if (reducedMotion) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[{ position: "absolute", overflow: "hidden" }, style]}
    >
      {width > 0 &&
        Array.from({ length: COUNT }, (_, i) => <Pleat key={i} index={i} width={width} phase={phase} lit={lit} />)}
    </View>
  );
}
