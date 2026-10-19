import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { renderInline } from "@/lib/markdown";
import { cleanMessageText } from "@/lib/text";
import { fonts, fontSize, space, useColors } from "@/lib/theme";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

/* The web's color-mix(in srgb, a p%, b), for the hex tokens this card
 * mixes. React Native has no color-mix, so it is done once here. */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, p: number, b: string): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a;
  const ch = (i: number) => Math.round(x[i] * p + y[i] * (1 - p));
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

function alpha(hex: string, p: number): string {
  const x = hexToRgb(hex);
  return x ? `rgba(${x[0]},${x[1]},${x[2]},${p})` : hex;
}

/** The model's own one-sentence bottom line - the first and, for most
 *  readers, the only thing they read of an answer. Not itself collapsible:
 *  it's the summary the fold exists to sit under, so it has to already be
 *  visible for the fold to make sense. No heading, either; the frame does the
 *  work of saying "this is the content" (a gradient hairline, a brand-tinted
 *  glow, larger type and a single sheen pass when it arrives), and a label on
 *  top of it read as a second title competing with the mode. */
export function CruxCard({ text }: { text: string }) {
  const c = useColors();
  const reduced = usePrefersReducedMotion();
  const [width, setWidth] = useState(0);
  const sheen = useSharedValue(-1.3);

  // One pass, 1.5s after a 0.2s pause, as the web's keyframes. Parked
  // off-canvas (and never animated) under reduced motion.
  useEffect(() => {
    if (reduced || width === 0) return;
    sheen.value = -1.3;
    sheen.value = withDelay(200, withTiming(1.3, { duration: 1500, easing: Easing.out(Easing.ease) }));
  }, [reduced, width, sheen]);

  const sheenStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sheen.value * width }] }), [width]);

  return (
    // The glow: a 4px brand ring (a wrapper with padding) and a soft brand
    // shadow below it. Android draws no coloured shadow, so it keeps the ring.
    // Negative margins so the ring sits outside the card's box, as a CSS
    // box-shadow does, and the card lines up with the text around it.
    <View
      style={{
        marginHorizontal: -4,
        marginTop: -4,
        marginBottom: space(2.5) - 4,
        borderRadius: 18,
        padding: 4,
        backgroundColor: alpha(c.brand, 0.07),
      }}
    >
      <View
        style={
          Platform.OS === "ios"
            ? { borderRadius: 14, shadowColor: c.brand, shadowOpacity: 0.35, shadowRadius: 15, shadowOffset: { width: 0, height: 14 } }
            : undefined
        }
      >
        <LinearGradient
          // The gradient hairline: a 1px padding of brand fading to the strong
          // border, around the inner panel.
          colors={[c.brand, mix(c.brand, 0.45, c.hairlineStrong), c.hairlineStrong]}
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 14, padding: 1 }}
        >
          <LinearGradient
            colors={[mix(c.brand, 0.07, c.surfaceRaised), c.surfaceRaised]}
            locations={[0, 0.65]}
            style={{ borderRadius: 13, overflow: "hidden", paddingHorizontal: space(3.5), paddingVertical: space(3) }}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          >
            {!reduced && width > 0 && (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sheenStyle]}>
                <LinearGradient
                  colors={["transparent", alpha(c.brand, 0.16), "transparent"]}
                  locations={[0.35, 0.5, 0.65]}
                  // 115deg, near enough: left-to-right with a slight lean.
                  start={{ x: 0, y: 0.3 }}
                  end={{ x: 1, y: 0.7 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            )}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space(2.5) }}>
              {/* The mark, not a spark. A four-point sparkle is the glyph every
                  other assistant puts next to generated text, so on the one line
                  of an answer most people actually read it said "an AI wrote
                  this" in someone else's handwriting. The five dots say whose
                  this is. Painted in the brand so it follows the accent. */}
              <View style={{ marginTop: 5, flexShrink: 0 }}>
                <MaskIcon
                  src="/ui/logo-dots.svg"
                  color={c.brand}
                  // 23.0292 x 22.2755 in the file; height drives it and the width
                  // keeps that ratio, since the mark is not square.
                  width={16.54}
                  height={16}
                />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: fontSize.xl,
                  lineHeight: fontSize.xl * 1.375,
                  fontFamily: fonts.semibold,
                  letterSpacing: -0.01 * fontSize.xl,
                  color: c.ink,
                }}
              >
                {renderInline(cleanMessageText(text), "crux")}
              </Text>
            </View>
          </LinearGradient>
        </LinearGradient>
      </View>
    </View>
  );
}
