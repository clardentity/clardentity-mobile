/* Web build only (`npx expo start --web`, used for quick checks in a
 * browser). react-native-webrtc has no web implementation, so the call is
 * unavailable there; the real call is lib/liveCall.ts on iOS and Android, and
 * the website keeps its own browser WebRTC version. Same exports. */

export type CallPhase = "connecting" | "listening" | "speaking" | "ended" | "error";

export type Viseme = { openness: number; width: number };

export type LiveCallHandlers = {
  onPhase: (phase: CallPhase) => void;
  onViseme: (viseme: Viseme) => void;
  onError: (message: string) => void;
  onTranscript?: (role: "user" | "assistant", text: string) => void;
};

export class LiveCall {
  constructor(private handlers: LiveCallHandlers) {}

  async start(): Promise<void> {
    this.handlers.onError("Live calls are available in the iOS and Android apps.");
    this.handlers.onPhase("error");
  }

  setMuted(muted: boolean): void {
    void muted;
  }

  stop(): void {
    this.handlers.onPhase("ended");
  }
}
