import { useEffect, useId, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { px, useColors } from "@/lib/theme";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import { TourTarget } from "@/components/tour/TourOverlay";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "reacting";
export type AvatarGesture =
  | "presenting"
  | "chin_stroke"
  | "weighing_scales"
  | "open_hand_explaining"
  | "wave"
  | "none";
export type AvatarExpression = "confident" | "thoughtful" | "cautious" | "concerned" | "neutral";

/* Rendered as gradient-shaded SVG rather than a real 3D scene. A GL
 * companion would mean shipping a renderer, a GPU context and an animation
 * loop for something that sits at 40px in the corner of a chat - so the depth
 * here comes from three-stop radial gradients, a specular highlight and a
 * contact shadow instead.
 *
 * Natively the moving parts can't be CSS animations on SVG groups, so the
 * figure is drawn as a stack of same-sized SVG layers (same 200 x 230 view
 * box, so every coordinate below is the web's) and each part that moves -
 * the tilt, the breathing, each arm, the eyes, the antenna, the talking
 * mouth - is its own layer, turned by Reanimated around the same origin the
 * stylesheet used. All of it stops under Reduce Motion.
 */

// Arm rotation in degrees, applied around each shoulder. 0 = hanging straight
// down at rest. Rotation is clockwise, so a *positive* angle swings the arm's
// tip toward screen LEFT - the opposite of what the sign reads like.
// Outward means positive on the left arm and negative on the right.
const ARM_ANGLES: Record<AvatarGesture, { left: number; right: number }> = {
  none: { left: 14, right: -14 },
  presenting: { left: 14, right: -105 },
  // Reaches up and across to the chin rather than out to the side.
  chin_stroke: { left: 14, right: 131 },
  weighing_scales: { left: 100, right: -100 },
  open_hand_explaining: { left: 128, right: -128 },
  wave: { left: 14, right: -145 },
};

/* An idle companion that holds one pose is indistinguishable from a broken
 * one, so when there is nothing specific to show it works through these
 * instead - opening on a wave, the way a chat app greets you, then settling
 * into small shifts of attention. Each pose transitions rather than snapping. */
const IDLE_CYCLE: Array<{ gesture: AvatarGesture; expression: AvatarExpression }> = [
  { gesture: "wave", expression: "confident" },
  { gesture: "none", expression: "neutral" },
  { gesture: "chin_stroke", expression: "thoughtful" },
  { gesture: "none", expression: "confident" },
  { gesture: "presenting", expression: "neutral" },
  { gesture: "none", expression: "neutral" },
  { gesture: "open_hand_explaining", expression: "confident" },
  { gesture: "none", expression: "thoughtful" },
];

const IDLE_POSE_MS = 3800;

const EXPRESSION_EYEBROW_ROTATION: Record<AvatarExpression, { left: number; right: number }> = {
  neutral: { left: 0, right: 0 },
  confident: { left: -8, right: 8 },
  thoughtful: { left: -4, right: 10 },
  cautious: { left: -16, right: 20 },
  concerned: { left: 18, right: -18 },
};

const MOUTH_PATHS: Record<AvatarExpression, string> = {
  neutral: "M89,92 Q100,99 111,92",
  confident: "M87,89 Q100,104 113,89",
  thoughtful: "M90,93 Q100,97 110,91",
  cautious: "M90,95 Q100,90 110,95",
  concerned: "M89,97 Q100,86 111,97",
};

const VIEW_W = 200;
const VIEW_H = 230;

/** One full-size layer of the figure: an SVG in the shared view box. */
function Layer({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={StyleSheet.absoluteFill}>
      {children}
    </Svg>
  );
}

/** A layer that turns or scales around a point given in view-box units. */
function Moving({
  k,
  origin,
  style,
  children,
}: {
  k: number;
  origin: [number, number];
  style: ReturnType<typeof useAnimatedStyle>;
  children: ReactNode;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { transformOrigin: [origin[0] * k, origin[1] * k, 0] }, style]}
    >
      {children}
    </Animated.View>
  );
}

/** Loops `value` between `from` and `to` (ease-in-out, there and back in
 *  `period` ms) while `on`; parks it at `rest` otherwise. */
function useOscillation(value: SharedValue<number>, on: boolean, from: number, to: number, period: number, rest: number) {
  useEffect(() => {
    cancelAnimation(value);
    if (!on) {
      value.value = rest;
      return;
    }
    value.value = from;
    value.value = withRepeat(withTiming(to, { duration: period / 2, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(value);
  }, [value, on, from, to, period, rest]);
}

function Arm({
  k,
  w,
  h,
  shoulderX,
  shoulderY,
  baseAngle,
  wobble,
  fill,
  handFill,
  rimFill,
  gradient,
  still,
}: {
  k: number;
  w: number;
  h: number;
  shoulderX: number;
  shoulderY: number;
  baseAngle: number;
  wobble: "left" | "right" | "wave" | null;
  fill: string;
  handFill: string;
  rimFill: string;
  gradient: ReactNode;
  still: boolean;
}) {
  // Two values, as the web's two nested groups: the base pose, transitioned
  // so the idle cycle reads as movement rather than a slideshow, and the
  // wobble, looped on top of it.
  const base = useSharedValue(baseAngle);
  const swing = useSharedValue(0);

  useEffect(() => {
    base.value = still
      ? baseAngle
      : withTiming(baseAngle, { duration: 700, easing: Easing.bezier(0.34, 1.2, 0.64, 1) });
  }, [base, baseAngle, still]);

  // Faster and wider for a wave than the weighing wobble - a wave is a
  // greeting, not a deliberation.
  const wave = wobble === "wave";
  useOscillation(swing, wobble !== null && !still, wave ? -16 : -6, wave ? 16 : 6, wave ? 500 : 1400, 0);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${base.value + swing.value}deg` }] }));

  return (
    <Moving k={k} origin={[shoulderX, shoulderY]} style={style}>
      <Layer w={w} h={h}>
        <Defs>{gradient}</Defs>
        <G transform={`translate(${shoulderX},${shoulderY})`}>
          <Rect x="-7" y="-7" width="14" height="46" rx="7" fill={fill} />
          <Circle cx="0" cy="43" r="9" fill={handFill} />
          {/* Rim light down the arm, the cheapest possible cue that it's round. */}
          <Rect x="-4" y="-2" width="2.5" height="34" rx="1.25" fill={rimFill} opacity={0.5} />
        </G>
      </Layer>
    </Moving>
  );
}

/** Live mouth shape, both 0-1. Supplied only during a call; everywhere else
 *  the mouth is the expression's own curve, or the generic talking loop. */
export type Viseme = { openness: number; width: number };

export function AvatarPanel({
  state,
  gesture,
  expression,
  size = px(40),
  style,
  viseme,
  tourId,
}: {
  state: AvatarState;
  gesture: AvatarGesture;
  expression: AvatarExpression;
  /** Replaces the web's className sizing (h-10 w-10): the square it fits in. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  viseme?: Viseme | null;
  /** Coachmark target name (`data-tour` on the web) - see lib/tour.tsx. */
  tourId?: string;
}) {
  const c = useColors();
  const still = usePrefersReducedMotion();
  // Gradient ids must be unique per instance or a second avatar on screen
  // can repaint the first one's fills.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `${name}-${uid}`;

  // Only take over when the caller has nothing of its own to show. A cue
  // carried over from the last answer is real information; overwriting it with
  // decoration would throw that away.
  const idling = state === "idle" && gesture === "none";
  const [idleStep, setIdleStep] = useState(0);

  useEffect(() => {
    if (!idling || still) return;
    const timer = setInterval(() => setIdleStep((step) => step + 1), IDLE_POSE_MS);
    return () => clearInterval(timer);
  }, [idling, still]);

  const idlePose = idling && !still ? IDLE_CYCLE[idleStep % IDLE_CYCLE.length] : null;
  const activeGesture = idlePose ? idlePose.gesture : gesture;
  const activeExpression = idlePose ? idlePose.expression : expression;

  const angles = ARM_ANGLES[activeGesture] ?? ARM_ANGLES.none;
  const eyebrows = EXPRESSION_EYEBROW_ROTATION[activeExpression] ?? EXPRESSION_EYEBROW_ROTATION.neutral;
  const mouthPath = MOUTH_PATHS[activeExpression] ?? MOUTH_PATHS.neutral;

  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";
  const isReacting = state === "reacting";
  const isWeighing = activeGesture === "weighing_scales" && (isThinking || isSpeaking);
  const isWaving = activeGesture === "wave";

  /* -------------------------------------------------------- motion -- */

  const tilt = useSharedValue(0);
  useEffect(() => {
    tilt.value = still ? (isListening ? -5 : 0) : withTiming(isListening ? -5 : 0, { duration: 400 });
  }, [tilt, isListening, still]);

  const breathe = useSharedValue(0);
  useOscillation(breathe, !still, 0, 1, 3200, 0);

  const react = useSharedValue(1);
  useEffect(() => {
    if (!isReacting || still) return;
    react.value = withSequence(
      withTiming(1.08, { duration: 280, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 420, easing: Easing.out(Easing.ease) }),
    );
  }, [react, isReacting, still]);

  // The antenna doubles as the thinking indicator: r 6 -> 8.5 and opacity
  // 0.45 -> 1, as a scale of the 6.5 resting dot.
  const pulse = useSharedValue(0);
  useOscillation(pulse, isThinking && !still, 0, 1, 1600, -1);

  const blink = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(blink);
    blink.value = 1;
    if (still) return;
    // Open for 92% of 4.5s, shut at 96%, open again by 100%.
    blink.value = withRepeat(
      withSequence(withDelay(4140, withTiming(0.1, { duration: 180 })), withTiming(1, { duration: 180 })),
      -1,
    );
    return () => cancelAnimation(blink);
  }, [blink, still]);

  const talk = useSharedValue(1);
  useOscillation(talk, isSpeaking && !viseme && !still, 0.5, 1.3, 320, 1);

  const tiltStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: (1 + 0.02 * breathe.value) * react.value },
      { scaleY: (1 + 0.03 * breathe.value) * react.value },
    ],
  }));
  const antennaStyle = useAnimatedStyle(() => {
    if (pulse.value < 0) return { opacity: 1, transform: [{ scale: 1 }] };
    const r = 6 + 2.5 * pulse.value;
    return { opacity: 0.45 + 0.55 * pulse.value, transform: [{ scale: r / 6.5 }] };
  });
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const talkStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: talk.value }] }));

  /* -------------------------------------------------------- layout -- */

  // The web's SVG fitted its 200 x 230 box into a square by height; the
  // stage is that fitted box, and k turns view-box units into points.
  const flat = StyleSheet.flatten(style) ?? {};
  const box = typeof flat.height === "number" ? flat.height : typeof flat.width === "number" ? flat.width : size;
  const h = box;
  const w = (box * VIEW_W) / VIEW_H;
  const k = h / VIEW_H;

  const armGradient = (
    <LinearGradient id={id("arm")} x1="0" y1="0" x2="1" y2="0">
      <Stop offset="0%" stopColor={c.avatarBodyLit} />
      <Stop offset="65%" stopColor={c.brand} />
      <Stop offset="100%" stopColor={c.brandDark} />
    </LinearGradient>
  );

  const figure = (
    <View
      style={[{ width: box, height: box, alignItems: "center", justifyContent: "center" }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <View style={{ width: w, height: h }}>
        {/* Contact shadow: soft and elliptical, so the figure sits on a
            surface instead of floating on the panel. */}
        <Layer w={w} h={h}>
          <Defs>
            <RadialGradient id={id("shadow")} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={c.avatarShadow} />
              <Stop offset="100%" stopColor={c.avatarShadow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="100" cy="214" rx="52" ry="11" fill={`url(#${id("shadow")})`} />
        </Layer>

        <Moving k={k} origin={[100, 150]} style={tiltStyle}>
          {/* Breathing (and the reaction pulse) nested separately from the
              listening tilt, so each turns around its own origin. */}
          <Moving k={k} origin={[100, 160]} style={bodyStyle}>
            {/* Body: a wide, short capsule reads as chubby and friendly, where
                the previous tall rectangle read as a torso in a suit. */}
            <Layer w={w} h={h}>
              <Defs>
                <RadialGradient id={id("body")} cx="32%" cy="18%" r="92%">
                  <Stop offset="0%" stopColor={c.avatarBodyLit} />
                  <Stop offset="55%" stopColor={c.brand} />
                  <Stop offset="100%" stopColor={c.brandDark} />
                </RadialGradient>
              </Defs>
              <Path
                d="M100,112 C132,112 148,132 148,158 C148,184 128,199 100,199 C72,199 52,184 52,158 C52,132 68,112 100,112 Z"
                fill={`url(#${id("body")})`}
              />
              {/* Specular streak on the body's upper left. */}
              <Ellipse cx="76" cy="136" rx="13" ry="19" fill={c.avatarSkinLit} opacity={0.22} transform="rotate(-22 76 136)" />
            </Layer>

            {/* Arms sit in front of the body and hang from outside its
                silhouette. Drawn behind it, every raised gesture - the whole
                point of them - disappeared into the torso. */}
            <Arm
              k={k}
              w={w}
              h={h}
              shoulderX={54}
              shoulderY={132}
              baseAngle={angles.left}
              wobble={isWeighing ? "left" : null}
              fill={`url(#${id("arm")})`}
              handFill={c.avatarSkin}
              rimFill={c.avatarBodyLit}
              gradient={armGradient}
              still={still}
            />
            <Arm
              k={k}
              w={w}
              h={h}
              shoulderX={146}
              shoulderY={132}
              baseAngle={angles.right}
              wobble={isWaving ? "wave" : isWeighing ? "right" : null}
              fill={`url(#${id("arm")})`}
              handFill={c.avatarSkin}
              rimFill={c.avatarBodyLit}
              gradient={armGradient}
              still={still}
            />

            <Layer w={w} h={h}>
              <Defs>
                {/* Light source sits up and to the left, consistently on every part. */}
                <RadialGradient id={id("head")} cx="34%" cy="26%" r="78%">
                  <Stop offset="0%" stopColor={c.avatarSkinLit} />
                  <Stop offset="52%" stopColor={c.avatarSkin} />
                  <Stop offset="100%" stopColor={c.avatarSkinShade} />
                </RadialGradient>
              </Defs>
              {/* Head: oversized relative to the body - the single biggest
                  lever on whether a character reads as cute. */}
              <Circle cx="100" cy="74" r="52" fill={`url(#${id("head")})`} />
              {/* Glossy highlight, the "3D" tell. */}
              <Ellipse cx="78" cy="48" rx="17" ry="12" fill="#ffffff" opacity={0.55} transform="rotate(-28 78 48)" />

              {/* Antenna - a small idle-life detail so the figure never looks
                  switched off; its dot is the layer above. */}
              <Path d="M100,26 L100,16" stroke={c.brandDark} strokeWidth={4} strokeLinecap="round" />

              <Path
                d="M72,58 Q81,52 90,56"
                stroke={c.avatarFace}
                strokeWidth={3.5}
                strokeLinecap="round"
                fill="none"
                transform={`rotate(${eyebrows.left} 81 55)`}
              />
              <Path
                d="M110,56 Q119,52 128,58"
                stroke={c.avatarFace}
                strokeWidth={3.5}
                strokeLinecap="round"
                fill="none"
                transform={`rotate(${eyebrows.right} 119 55)`}
              />

              <Ellipse cx="68" cy="88" rx="7" ry="4.5" fill={c.avatarBlush} opacity={0.5} />
              <Ellipse cx="132" cy="88" rx="7" ry="4.5" fill={c.avatarBlush} opacity={0.5} />

              {viseme ? (
                // Driven by the live audio rather than a loop: `openness` is
                // the envelope and `width` is roughly how bright the sound is,
                // which between them separate an "oo" (tall, narrow) from an
                // "ee" (short, wide) well enough to read as speech. No
                // easing - the analyser is already smoother than any would be.
                <Ellipse
                  cx="100"
                  cy="94"
                  rx={5.5 + viseme.width * 5.5}
                  ry={0.8 + viseme.openness * 8.5}
                  fill={c.avatarFace}
                />
              ) : isSpeaking ? null : (
                <Path d={mouthPath} stroke={c.avatarFace} strokeWidth={3.5} strokeLinecap="round" fill="none" />
              )}
            </Layer>

            <Moving k={k} origin={[100, 11]} style={antennaStyle}>
              <Layer w={w} h={h}>
                <Circle cx="100" cy="11" r="6.5" fill={c.brand} />
              </Layer>
            </Moving>

            {/* Big glossy eyes. The two specular dots per eye are what make
                them look wet and alive rather than like drilled holes. */}
            <Moving k={k} origin={[100, 74]} style={eyesStyle}>
              <Layer w={w} h={h}>
                <Ellipse cx="82" cy="74" rx="8.5" ry="10.5" fill={c.avatarFace} />
                <Ellipse cx="118" cy="74" rx="8.5" ry="10.5" fill={c.avatarFace} />
                <Circle cx="79" cy="70" r="3.2" fill="#ffffff" opacity={0.95} />
                <Circle cx="115" cy="70" r="3.2" fill="#ffffff" opacity={0.95} />
                <Circle cx="85" cy="79" r="1.6" fill="#ffffff" opacity={0.6} />
                <Circle cx="121" cy="79" r="1.6" fill="#ffffff" opacity={0.6} />
              </Layer>
            </Moving>

            {isSpeaking && !viseme && (
              <Moving k={k} origin={[100, 94]} style={talkStyle}>
                <Layer w={w} h={h}>
                  <Ellipse cx="100" cy="94" rx="8" ry="6.5" fill={c.avatarFace} />
                </Layer>
              </Moving>
            )}
          </Moving>
        </Moving>
      </View>
    </View>
  );

  return tourId ? <TourTarget id={tourId}>{figure}</TourTarget> : figure;
}
