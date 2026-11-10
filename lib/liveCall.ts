import Constants, { ExecutionEnvironment } from "expo-constants";
import { getLocales } from "expo-localization";
import type { MediaStream, RTCPeerConnection } from "react-native-webrtc";
import { API_BASE_URL } from "@/lib/apiClient";
import { getAccessToken, refreshAccessToken } from "@/lib/auth";

/* The live call, as a plain object with a start and a stop.
 *
 * Audio goes phone-to-OpenAI over WebRTC rather than through our backend:
 * relaying it would add a round trip to every packet, and a voice call is the
 * one place in this app where 200ms is the difference between a conversation
 * and a radio check. Our server's only job is to mint the short-lived
 * credential that authorises the session - the real API key never reaches the
 * app.
 *
 * Native differences from the web version: react-native-webrtc plays the
 * remote track itself (no <audio> element), and there is no Web Audio
 * analyser, so the mouth is driven by the inbound track's `audioLevel` from
 * getStats() instead of an FFT. That gives openness; width stays neutral.
 * WebRTC needs a development build (not Expo Go).
 */

type WebRTC = typeof import("react-native-webrtc");

/* Loaded on first call rather than imported: react-native-webrtc throws at
 * import time when its native module is missing, which is the case in Expo
 * Go. Importing it eagerly would crash the whole chat screen there; this way
 * only the call says it is unavailable. */
function loadWebRTC(): WebRTC | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-webrtc") as WebRTC;
  } catch {
    return null;
  }
}

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export type CallPhase = "connecting" | "listening" | "speaking" | "ended" | "error";

export type Viseme = { openness: number; width: number };

export type LiveCallHandlers = {
  onPhase: (phase: CallPhase) => void;
  onViseme: (viseme: Viseme) => void;
  onError: (message: string) => void;
  /** Finalised transcript lines, so the call leaves something behind. */
  onTranscript?: (role: "user" | "assistant", text: string) => void;
};

/* What the phone already knows about where it is: the user's own language
 * settings ("ml-IN" names both the language and the region) and the
 * timezone, for someone whose phone is in English but who is sitting in
 * Kochi. It goes to the call rather than being looked up server-side because
 * the server only has the address the request came from, which is wrong for
 * anyone on a VPN or a carrier routing through another state. */
function localeSignals(): { timezone: string | null; languages: string[] } {
  try {
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      // Capped: a handful is all the instruction needs.
      languages: getLocales()
        .map((l) => l.languageTag)
        .slice(0, 6),
    };
  } catch {
    return { timezone: null, languages: [] };
  }
}

async function mintClientSecret(): Promise<string> {
  let token = getAccessToken() ?? (await refreshAccessToken());
  if (!token) throw new Error("Your session expired. Sign in again to start a call.");
  const signals = localeSignals();
  const post = (bearer: string) =>
    fetch(`${API_BASE_URL}/realtime/session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signals),
    });

  let res = await post(token);

  if (res.status === 401) {
    token = await refreshAccessToken();
    if (!token) throw new Error("Your session expired. Sign in again to start a call.");
    res = await post(token);
  }

  if (!res.ok) {
    // Only our own deliberate failures get to write the message. Anything
    // else is a framework string that reads like the app is broken in a way
    // the user could fix.
    const body = await res.json().catch(() => null);
    const ours = res.status === 429 || res.status === 503;
    throw new Error(
      (ours && typeof body?.detail === "string" ? body.detail : null) ??
        "Calls aren't available right now. Try again in a moment.",
    );
  }

  const data = await res.json();
  if (!data.client_secret) throw new Error("Could not start the call.");
  return data.client_secret as string;
}

type StatsReport = Map<string, { type?: string; kind?: string; audioLevel?: number }>;

export class LiveCall {
  private pc: RTCPeerConnection | null = null;
  private mic: MediaStream | null = null;
  private meter: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private handlers: LiveCallHandlers) {}

  async start(): Promise<void> {
    const webrtc = loadWebRTC();
    if (!webrtc) {
      this.handlers.onError("Live calls need the full Clardentity app. They don't run in Expo Go.");
      this.handlers.onPhase("error");
      return;
    }
    const { mediaDevices, RTCPeerConnection } = webrtc;

    this.handlers.onPhase("connecting");

    try {
      const secret = await mintClientSecret();

      // Asked for after the token succeeds, so a user who is going to hit an
      // error doesn't get a microphone prompt first.
      this.mic = (await mediaDevices.getUserMedia({ audio: true, video: false })) as MediaStream;
      if (this.stopped) return this.teardown();

      const pc = new RTCPeerConnection({});
      this.pc = pc;

      this.mic.getAudioTracks().forEach((track) => pc.addTrack(track, this.mic as MediaStream));

      // The remote track plays by itself; it is also what the meter reads.
      pc.addEventListener("track", () => this.startMeter());

      pc.addEventListener("connectionstatechange", () => {
        if (this.stopped) return;
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          this.handlers.onError("The call dropped.");
          this.handlers.onPhase("error");
        }
      });

      // Data channel carries session events and transcripts alongside audio.
      const channel = pc.createDataChannel("oai-events");
      channel.addEventListener("message", (event: { data: unknown }) => {
        if (typeof event.data === "string") this.onServerEvent(event.data);
      });

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      const answer = await fetch(CALLS_URL, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/sdp" },
      });

      if (!answer.ok) throw new Error("Could not connect the call.");

      await pc.setRemoteDescription({ type: "answer", sdp: await answer.text() });
      if (this.stopped) return this.teardown();
      this.handlers.onPhase("listening");
    } catch (err) {
      if (this.stopped) return;
      const message =
        err instanceof Error && /permission|denied|notallowed/i.test(`${err.name} ${err.message}`)
          ? "Microphone access is blocked. Allow it in Settings to use the call."
          : err instanceof Error
            ? err.message
            : "Could not start the call.";
      this.handlers.onError(message);
      this.handlers.onPhase("error");
      this.teardown();
    }
  }

  private onServerEvent(raw: string) {
    let event: { type?: string; transcript?: string; delta?: string };
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    // Turn boundaries drive the on-screen state; the meter drives the mouth.
    if (event.type === "output_audio_buffer.started") this.handlers.onPhase("speaking");
    if (event.type === "output_audio_buffer.stopped") this.handlers.onPhase("listening");

    if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
      this.handlers.onTranscript?.("user", event.transcript);
    }
    if (event.type === "response.output_audio_transcript.done" && event.transcript) {
      this.handlers.onTranscript?.("assistant", event.transcript);
    }
  }

  /** Reads the companion's voice level for the mouth. Attack fast, release
   *  slower, as on the web: a mouth that snaps shut between syllables reads
   *  as a glitch, one that snaps open reads as speech. */
  private startMeter() {
    if (this.meter) return;
    let openness = 0;
    this.meter = setInterval(async () => {
      const pc = this.pc;
      if (!pc) return;
      try {
        const report = (await pc.getStats()) as unknown as StatsReport;
        let level = 0;
        report.forEach((s) => {
          if (s.type === "inbound-rtp" && s.kind === "audio" && typeof s.audioLevel === "number") level = s.audioLevel;
        });
        const energy = Math.min(1, level * 3.6);
        const target = energy < 0.04 ? 0 : energy;
        openness += (target - openness) * (target > openness ? 0.6 : 0.25);
        this.handlers.onViseme({ openness, width: 0.5 });
      } catch {
        // stats are best-effort
      }
    }, 80);
  }

  /** Disables the outgoing track rather than tearing the stream down, so the
   *  session, the peer connection and the model's sense of the conversation
   *  all survive being muted. */
  setMuted(muted: boolean): void {
    this.mic?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  stop(): void {
    this.stopped = true;
    this.teardown();
    this.handlers.onPhase("ended");
  }

  private teardown(): void {
    if (this.meter) clearInterval(this.meter);
    this.meter = null;
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic?.release?.();
    this.mic = null;
    this.pc?.getSenders().forEach((s) => s.track?.stop());
    this.pc?.close();
    this.pc = null;
  }
}
