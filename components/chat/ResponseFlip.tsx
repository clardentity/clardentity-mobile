import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage } from "@/lib/auth";
import { Spinner } from "@/components/ui/primitives";
import { cleanMessageText } from "@/lib/text";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

/* The Devil's Draft, as the back of the card.
 *
 * It used to be a side-by-side panel below the answer, which had two problems:
 * you had to go looking for it, and reading two columns of near-identical
 * prose is work the eye refuses to do. Flipping the answer in place puts the
 * two versions in the same rectangle, one after the other, so the difference
 * arrives as a change rather than as a comparison you have to perform.
 *
 * The counterfactual is generated alongside the answer and shipped with it, so
 * the flip is usually instant; the endpoint is only called for older messages
 * that predate that, or turns where the parallel generation failed.
 */

export function FlipIcon({
  size = px(14),
  color,
  style,
}: {
  size?: number;
  /** What the web got from `currentColor`. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? c.inkMuted}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {/* A card mid-turn: one face square-on, the other edge-on behind it. */}
      <Rect x="3" y="5" width="11" height="14" rx="2" />
      <Path d="M18 7.5v9" />
      <Path d="M21 6v12" />
    </Svg>
  );
}

function comparableText(text: string): string {
  return cleanMessageText(text).replace(/\s*\[\d+\]/g, "");
}

export function useCounterfactual({
  conversationId,
  messageId,
  preloaded,
}: {
  conversationId?: string;
  messageId: string;
  preloaded?: string | null;
}) {
  const [flipped, setFlipped] = useState(false);
  const [text, setText] = useState<string | null>(preloaded ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (flipped) {
      setFlipped(false);
      return;
    }
    setFlipped(true);
    if (text || loading || !conversationId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ counterfactual_content: string }>(
        `/chat/${conversationId}/messages/${messageId}/devils-advocate`,
        { method: "POST" },
      );
      setText(res.counterfactual_content);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return { flipped, toggle, text, loading, error };
}

export function ResponseFlip({
  flipped,
  front,
  text,
  loading,
  error,
}: {
  flipped: boolean;
  front: ReactNode;
  text: string | null;
  loading: boolean;
  error: string | null;
}) {
  const c = useColors();
  const s = useThemedStyles(styles);
  const reduced = usePrefersReducedMotion();
  const turn = useSharedValue(flipped ? 1 : 0);
  const [backHeight, setBackHeight] = useState(0);

  // The 500ms ease-out turn; instant under reduced motion, where a card
  // spinning in place is exactly the motion the setting asks to be spared.
  useEffect(() => {
    turn.value = withTiming(flipped ? 1 : 0, {
      duration: reduced ? 0 : 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [flipped, reduced, turn]);

  /* Each face turns on its own (React Native has no preserve-3d to turn a
     shared parent), with the perspective in front of the rotation so it has
     depth rather than reading as a horizontal squash. The face turned away
     is hidden outright, not left to backfaceVisibility alone: on the web,
     renderers without full 3D compositing painted the back face through the
     front, mirrored. Here the switch happens when the card is edge-on, so
     the motion reads the same. */
  const frontStyle = useAnimatedStyle(() => ({
    opacity: turn.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 1600 }, { rotateY: `${turn.value * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: turn.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 1600 }, { rotateY: `${turn.value * 180 - 180}deg` }],
  }));

  return (
    /* Both faces occupy the same box, which is as tall as the taller of the
       two: the front sits in the flow and the back is laid over it, with the
       box held at least as tall as the back once it has been measured.
       Absolute positioning alone would clip whichever face is longer. */
    <View style={{ minWidth: 0, minHeight: backHeight }}>
      <Animated.View
        style={[s.face, frontStyle]}
        pointerEvents={flipped ? "none" : "auto"}
        accessibilityElementsHidden={flipped}
        importantForAccessibility={flipped ? "no-hide-descendants" : "auto"}
      >
        {front}
      </Animated.View>

      <Animated.View
        style={[s.face, s.back, backStyle]}
        pointerEvents={flipped ? "auto" : "none"}
        accessibilityElementsHidden={!flipped}
        importantForAccessibility={flipped ? "auto" : "no-hide-descendants"}
        onLayout={(e) => setBackHeight(e.nativeEvent.layout.height)}
      >
        {/* Deliberately compact. Both faces share a box so the card is as
            tall as the taller of them - a long explainer down here would pad
            every answer in the conversation with dead space it only needs
            while flipped. The counterfactual runs about half the length of
            the answer, so the front governs the height. */}
        <View style={s.panel}>
          <Text style={s.label}>Unchecked - caveats removed</Text>
          {loading && (
            <View style={s.loading}>
              <Spinner color={c.caution} />
              <Text style={[s.small, { color: c.caution }]}>Arguing the other way…</Text>
            </View>
          )}
          {error ? <Text style={[s.small, { marginTop: space(1.5), color: c.bandLow }]}>{error}</Text> : null}
          {text ? (
            // Ordinary reading colour for the body: a full paragraph of the
            // warning colour is a thing you skim and abandon, and this is
            // the half you are meant to read closely.
            <Text style={s.body}>{comparableText(text)}</Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

export function FlipButton({
  flipped,
  onClick,
  style,
}: {
  flipped: boolean;
  onClick: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const label = flipped ? "Show the checked answer" : "Flip to the unchecked version";
  return (
    <Pressable
      onPress={onClick}
      accessibilityRole="button"
      accessibilityState={{ selected: flipped }}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        { borderRadius: radius.md, padding: space(1) },
        pressed && { backgroundColor: c.surfaceHover },
        style,
      ]}
    >
      {({ pressed }) => <FlipIcon color={flipped || pressed ? c.caution : c.inkMuted} />}
    </Pressable>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    face: { minWidth: 0, backfaceVisibility: "hidden" },
    back: { position: "absolute", top: 0, left: 0, right: 0 },
    panel: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.cautionBorder,
      backgroundColor: c.cautionBg,
      paddingHorizontal: space(3),
      paddingVertical: space(2.5),
    },
    label: {
      fontSize: fontSize.xs,
      fontFamily: fonts.semibold,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: c.caution,
    },
    loading: { marginTop: space(2), flexDirection: "row", alignItems: "center", gap: space(1.5) },
    small: { fontSize: fontSize.xs, fontFamily: fonts.regular },
    body: {
      marginTop: space(1.5),
      fontSize: fontSize.sm,
      lineHeight: fontSize.sm * 1.625,
      fontFamily: fonts.regular,
      color: c.inkSecondary,
    },
  });
