import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE_URL } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/auth";
import type { GeneratedImage } from "@/lib/sse";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

/* A picture made during a Co-Creative turn.
 *
 * Shown as part of the answer rather than as an attachment, because it is
 * the answer - "draw me a logo" was not a request for a paragraph with a
 * file clipped to it.
 *
 * No caption. When someone asks for a picture they get a picture - the
 * essay that used to come with it was the thing being complained about, and
 * a line of prose under the frame is the same answer in miniature. The
 * prompt is still there as the accessibility label, so screen readers are
 * unaffected.
 */

const MAX = 420;

function useImageSource(image: GeneratedImage) {
  // Served by id straight from the API. On the web an <img> cannot carry an
  // Authorization header, so the uuid in the path is the capability; a
  // native image request can, so it is sent too.
  // WebP, because the PNG the model returns is 2.4MB and spent several
  // seconds as a blank square - long enough to read as no image at all.
  const uri = `${API_BASE_URL}/images/${image.owner}/${image.id}.webp`;
  const token = getAccessToken();
  return useMemo(() => ({ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [uri, token]);
}

export function GeneratedImageCard({ image }: { image: GeneratedImage }) {
  const [viewing, setViewing] = useState(false);
  const source = useImageSource(image);
  const s = useThemedStyles(styles);
  const insets = useSafeAreaInsets();

  return (
    <View style={s.figure}>
      {/* Tap opens it full screen - the web's "open in a new tab". */}
      <Pressable onPress={() => setViewing(true)} accessibilityRole="imagebutton" accessibilityLabel={image.prompt}>
        {/* Square by construction - the model is asked for 1024x1024 - so the
            box can reserve its space before the bytes land and the answer
            below it does not jump when they do. */}
        <Image source={source} style={s.image} contentFit="cover" cachePolicy="memory-disk" transition={150} />
      </Pressable>

      <Modal visible={viewing} transparent animationType="fade" onRequestClose={() => setViewing(false)} statusBarTranslucent>
        <View style={s.viewer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewing(false)} accessibilityLabel="Close image" />
          <Image
            source={source}
            style={s.viewerImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            accessibilityLabel={image.prompt}
            pointerEvents="none"
          />
          <Pressable
            onPress={() => setViewing(false)}
            accessibilityRole="button"
            accessibilityLabel="Close image"
            hitSlop={12}
            style={[s.close, { top: insets.top + space(3) }]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round">
              <Path d="M18 6 6 18M6 6l12 12" />
            </Svg>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/** The square the picture will land in, held while it is being made.
 *
 *  Generating one takes fifteen to twenty seconds, which is longer than the
 *  answer beside it takes to write - so without this the reply looks
 *  finished, and the image arriving afterwards looks like it was never
 *  coming. Reserving the space also stops the answer jumping when it lands.
 */
export function GeneratedImagePlaceholder() {
  const c = useColors();
  const s = useThemedStyles(styles);
  const reduced = usePrefersReducedMotion();
  const pulse = useSharedValue(1);

  // Tailwind's animate-pulse: opacity 1 -> 0.5 -> 1 over 2s, forever.
  useEffect(() => {
    if (reduced) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withTiming(0.5, { duration: 1000 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduced, pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[s.figure, { alignSelf: "stretch" }]}>
      <View style={s.placeholder}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
          <Animated.View style={[{ width: px(8), height: px(8), borderRadius: 999, backgroundColor: c.brand }, dotStyle]} />
          <Text style={s.making}>Making the image…</Text>
        </View>
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    figure: {
      marginBottom: space(2.5),
      alignSelf: "flex-start",
      width: "100%",
      maxWidth: MAX,
      overflow: "hidden",
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
    },
    image: { width: "100%", aspectRatio: 1 },
    placeholder: {
      width: "100%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceMuted,
    },
    making: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: c.inkMuted },
    viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
    viewerImage: { width: "100%", height: "100%" },
    close: {
      position: "absolute",
      right: space(4),
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.14)",
    },
  });
