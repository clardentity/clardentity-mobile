import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { AvatarPanel, type Viseme } from "@/components/avatar/AvatarPanel";
import { LiveCall, type CallPhase } from "@/lib/liveCall";
import { fonts, fontSize, px, space, useThemedStyles, type Colors } from "@/lib/theme";

/* The call takes the screen.
 *
 * Everything else in this app is a document you read; a call is a thing you
 * are in. Leaving the chat visible behind a small speaking head would invite
 * you to keep reading it, which is the one thing you cannot do while talking.
 * So the transcript goes, the companion comes up to full size, and the only
 * controls are mute and hang up.
 */

const PHASE_LABEL: Record<CallPhase, string> = {
  connecting: "Connecting…",
  listening: "Listening",
  speaking: "Speaking",
  ended: "Call ended",
  error: "Call failed",
};

/** Mounted only while the call is up, so "fresh state for a new call" is
 *  what the initial values already mean - no effect has to reset anything. */
export function LiveCallOverlay({
  open,
  onClose,
  onEnded,
}: {
  open: boolean;
  onClose: () => void;
  /** Everything said on the call, in order, once it ends. */
  onEnded?: (turns: { role: "user" | "assistant"; content: string }[]) => void;
}) {
  if (!open) return null;
  return <CallSession onClose={onClose} onEnded={onEnded} />;
}

function CallSession({
  onClose,
  onEnded,
}: {
  onClose: () => void;
  onEnded?: (turns: { role: "user" | "assistant"; content: string }[]) => void;
}) {
  const s = useThemedStyles(styles);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<CallPhase>("connecting");
  const [viseme, setViseme] = useState<Viseme | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const callRef = useRef<LiveCall | null>(null);
  // A ref, not state: transcript lines arrive from a callback that outlives
  // the render they were registered in, and nothing on screen depends on
  // them until the call is over.
  const turnsRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  // Held in a ref so the unmount cleanup below calls whatever the latest
  // handler is, without `onEnded` becoming a dependency that would tear the
  // call down and rebuild it every time the parent re-renders.
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    const call = new LiveCall({
      onPhase: setPhase,
      onViseme: setViseme,
      onError: setError,
      onTranscript: (role, text) => {
        const content = text.trim();
        if (content) turnsRef.current.push({ role, content });
      },
    });
    callRef.current = call;
    void call.start();

    return () => {
      call.stop();
      callRef.current = null;
      // Handing the transcript over on unmount means it survives every way a
      // call can end - the End button, Android's back button, or navigating
      // away.
      if (turnsRef.current.length) onEndedRef.current?.(turnsRef.current);
      turnsRef.current = [];
    };
  }, []);

  const speaking = phase === "speaking";

  // The web's min(60vmin, 34rem) and min(42vmin, 22rem).
  const vmin = Math.min(width, height);
  const bloomSize = Math.min(vmin * 0.6, px(544));
  const avatarSize = Math.min(vmin * 0.42, px(352));
  // The two advice lines go on short screens, where the controls matter more.
  const roomForHints = height >= 600;

  // A soft bloom behind the companion that breathes with its voice. The
  // opacity eases (the web's transition-opacity); the scale follows the
  // voice frame by frame.
  const bloomOpacity = useSharedValue(0.4);
  useEffect(() => {
    bloomOpacity.value = withTiming(speaking ? 0.95 : 0.4, { duration: 300 });
  }, [speaking, bloomOpacity]);
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloomOpacity.value }));
  const bloomScale = 1 + (viseme?.openness ?? 0) * 0.16;

  const iconColor = muted ? s.colors.ink : s.colors.inkSecondary;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View accessibilityViewIsModal accessibilityLabel="Live call" style={s.root}>
        {/* Scrollable rather than hard-centred: on a short screen a centred
            column of avatar, status, two hint lines and a control row simply
            does not fit, and the End button must never be pushed off the
            bottom edge. */}
        <ScrollView
          contentContainerStyle={[
            s.content,
            { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              s.bloom,
              { width: bloomSize, height: bloomSize, transform: [{ scale: bloomScale }] },
              bloomStyle,
            ]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="call-bloom" cx="50" cy="50" r="70.71" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={s.colors.brand} stopOpacity={0.26} />
                  <Stop offset="0.66" stopColor={s.colors.brand} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="100" fill="url(#call-bloom)" />
            </Svg>
          </Animated.View>

          <AvatarPanel
            state={speaking ? "speaking" : phase === "connecting" ? "thinking" : "listening"}
            gesture="none"
            expression="neutral"
            viseme={speaking ? viseme : null}
            style={{ width: avatarSize, height: avatarSize }}
          />

          <Text style={s.status} accessibilityLiveRegion="polite">
            {error ?? PHASE_LABEL[phase]}
          </Text>
          {!error && phase === "listening" && roomForHints && (
            <Text style={s.hint}>Just talk - it will wait until you&apos;ve finished.</Text>
          )}
          {!error && roomForHints && (
            <Text style={[s.hint, { maxWidth: 384 }]}>
              Answers on a call aren&apos;t cited. Ask in the chat when you need the evidence.
            </Text>
          )}

          <View style={s.controls}>
            <Pressable
              onPress={() => {
                const next = !muted;
                setMuted(next);
                callRef.current?.setMuted(next);
              }}
              disabled={Boolean(error)}
              accessibilityRole="button"
              accessibilityLabel={muted ? "Unmute" : "Mute"}
              accessibilityState={{ selected: muted, disabled: Boolean(error) }}
              style={({ pressed }) => [
                s.mute,
                (muted || pressed) && { backgroundColor: s.colors.surfaceHover },
                error ? { opacity: 0.4 } : null,
              ]}
            >
              <Svg viewBox="0 0 24 24" width={px(20)} height={px(20)} fill="none">
                <Rect x="9" y="3" width="6" height="11" rx="3" stroke={iconColor} strokeWidth="1.75" />
                <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke={iconColor} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                {muted && <Path d="m3 3 18 18" stroke={iconColor} strokeWidth="1.75" strokeLinecap="round" />}
              </Svg>
            </Pressable>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="End call"
              style={({ pressed }) => [s.end, pressed && { opacity: 0.9 }]}
            >
              <View style={{ transform: [{ rotate: "135deg" }] }}>
                <Svg viewBox="0 0 24 24" width={px(20)} height={px(20)} fill="none">
                  <Path
                    d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"
                    stroke="#ffffff"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={s.endText}>End</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = (c: Colors) => ({
  colors: c,
  ...StyleSheet.create({
    root: { flex: 1, backgroundColor: c.canvas },
    content: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space(6) },
    bloom: { position: "absolute", alignSelf: "center" },
    status: { marginTop: space(4), fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.inkSecondary, textAlign: "center" },
    hint: { marginTop: space(1), fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted, textAlign: "center" },
    controls: { marginTop: space(6), flexDirection: "row", alignItems: "center", gap: space(3) },
    mute: {
      width: px(48),
      height: px(48),
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    end: {
      height: px(48),
      flexDirection: "row",
      alignItems: "center",
      gap: space(2),
      borderRadius: 9999,
      backgroundColor: c.bandLow,
      paddingHorizontal: space(6),
    },
    endText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: "#ffffff" },
  }),
});
