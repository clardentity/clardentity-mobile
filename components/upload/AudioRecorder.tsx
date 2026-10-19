import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { API_BASE_URL } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/auth";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";
import { tourRef } from "@/components/tour/TourOverlay";

type RecorderState = "idle" | "recording" | "transcribing";

type TranscribeResponse = {
  transcript: string;
  language?: string | null;
  heard_speech?: boolean;
};

/** Languages the transcript is quietly accepted in. Anything else gets a
 *  visible "heard this as X" note, because an unclear recording is
 *  transcribed confidently in the wrong language rather than flagged - and
 *  the person can't tell from the text that this happened until they read
 *  it back. */
const EXPECTED_LANGUAGES = new Set(["english", "en"]);

function titleCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/* The web records with MediaRecorder (webm/opus). Natively expo-audio's
 * HIGH_QUALITY preset records AAC in an .m4a file, which the backend's
 * /audio/transcribe accepts (its allowed list includes m4a); the upload is
 * the same multipart form with a `file` part, sent with the same bearer
 * token. */
export function AudioRecorder({
  onTranscribed,
  disabled,
}: {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}) {
  const s = useThemedStyles(styles);
  const colors = useColors();
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Elapsed-time counter while recording: a number that changes is the one
  // unambiguous sign that recording is actually happening, more than any
  // colour change is.
  useEffect(() => {
    if (state !== "recording") return;
    const startedAt = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(id);
  }, [state]);

  // The REC light's pulse - the web's animate-ping.
  const ping = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state !== "recording") return;
    const loop = Animated.loop(
      Animated.timing(ping, { toValue: 1, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => {
      loop.stop();
      ping.setValue(0);
    };
  }, [state, ping]);

  async function startRecording() {
    setError(null);
    setNotice(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("denied");
      // iOS only records with the session in record mode, and only through
      // the silent switch with playsInSilentMode.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setSeconds(0);
      setState("recording");
    } catch {
      setError("Microphone access denied or unavailable");
    }
  }

  async function stopRecording() {
    setState("transcribing");
    try {
      await recorder.stop();
    } finally {
      // Back to playback mode, or answers read aloud afterwards come out of
      // the earpiece on iOS.
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
    const uri = recorder.uri;
    if (!uri) {
      setError("Transcription failed");
      setState("idle");
      return;
    }
    await transcribe(uri);
  }

  async function transcribe(uri: string) {
    try {
      const form = new FormData();
      // React Native's FormData takes a file as { uri, name, type }.
      form.append("file", { uri, name: "recording.m4a", type: "audio/mp4" } as unknown as Blob);

      const accessToken = getAccessToken();
      const res = await fetch(`${API_BASE_URL}/audio/transcribe`, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `Transcription failed with status ${res.status}`);
      }

      const data = (await res.json()) as TranscribeResponse;
      if (data.heard_speech === false || !data.transcript.trim()) {
        // Silence used to come back as "Thank you for watching" and land in
        // the composer as if you'd said it. Say what happened instead.
        setNotice("Didn't catch any speech - try again, a little closer to the mic.");
        return;
      }
      const lang = (data.language || "").toLowerCase();
      if (lang && !EXPECTED_LANGUAGES.has(lang)) {
        setNotice(`Heard this as ${titleCase(lang)}. If that's not what you said, record again.`);
      }
      onTranscribed(data.transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setState("idle");
    }
  }

  const recording = state === "recording";
  const mm = String(Math.floor(seconds / 60));
  const ss = String(seconds % 60).padStart(2, "0");
  const off = disabled || state === "transcribing";

  return (
    <View style={s.wrap}>
      <Pressable
        ref={tourRef("voice")} collapsable={false}
        disabled={off}
        onPress={recording ? stopRecording : startRecording}
        accessibilityRole="button"
        accessibilityLabel={recording ? `Stop recording (${mm}:${ss})` : "Record a voice message"}
        accessibilityState={{ selected: recording, disabled: off }}
        hitSlop={6}
        style={({ pressed }) => [
          s.button,
          recording ? s.recording : s.idle,
          pressed && !recording && { backgroundColor: colors.surfaceHover },
          off && { opacity: 0.5 },
        ]}
      >
        {({ pressed }) =>
          state === "transcribing" ? (
            <ActivityIndicator size="small" color={colors.inkMuted} />
          ) : recording ? (
            <>
              {/* A blinking dot and a running clock read as "live" the way a
                  camera's REC light does; the square says "this stops it". */}
              <View style={s.dot}>
                <Animated.View
                  style={[
                    s.dotFill,
                    StyleSheet.absoluteFill,
                    {
                      opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                      transform: [{ scale: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
                    },
                  ]}
                />
                <View style={s.dotFill} />
              </View>
              <Text style={s.clock}>
                {mm}:{ss}
              </Text>
              <Svg viewBox="0 0 24 24" width={px(12)} height={px(12)} fill={colors.bandLow}>
                <Rect x="6" y="6" width="12" height="12" rx="2" />
              </Svg>
            </>
          ) : (
            <Svg
              viewBox="0 0 24 24"
              width={px(20)}
              height={px(20)}
              fill="none"
              stroke={pressed ? colors.brand : colors.inkMuted}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
            </Svg>
          )
        }
      </Pressable>
      {error ? <Text style={[s.message, { color: colors.bandLow }]}>{error}</Text> : null}
      {notice && !error ? <Text style={[s.message, { color: colors.inkSecondary }]}>{notice}</Text> : null}
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "center", gap: space(1.5), flexShrink: 1 },
    button: {
      height: px(32),
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space(1.5),
      borderRadius: radius.lg,
    },
    idle: { width: px(32) },
    recording: { backgroundColor: c.bandLowBg, paddingHorizontal: space(2.5) },
    dot: { width: px(10), height: px(10) },
    dotFill: { width: px(10), height: px(10), borderRadius: 9999, backgroundColor: c.bandLow },
    clock: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.bandLow, fontVariant: ["tabular-nums"] },
    message: { flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSize.xs },
  });
