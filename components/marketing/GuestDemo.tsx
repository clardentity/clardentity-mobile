import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type TextInputInstance,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { guestSessionId, type GuestTurn } from "@/lib/guestDemo";
import { streamGuestMessage } from "@/lib/guestDemo";
import { stashGuestTranscript, type StashedTurn } from "@/lib/guestHandoff";
import { track } from "@/lib/analytics";
import { AppText } from "@/components/ui/primitives";
import { MessageInput } from "@/components/chat/MessageInput";
import { MessageList, type StreamingMessage } from "@/components/chat/MessageList";
import { ModeSelector } from "@/components/chat/ModeSelector";
import { ContextQuestionCard } from "@/components/chat/ContextQuestionCard";
import { HealthConsentCard } from "@/components/chat/HealthConsentCard";
import { ModeDisclosure } from "@/components/chat/ChatGreeting";
import { rememberSessionHealthConsent } from "@/lib/healthConsent";
import { RefinedQuestionCard } from "@/components/chat/RefinedQuestionCard";
import { ClarifyingOptionsCard } from "@/components/chat/ClarifyingOptionsCard";
import { ModeSwitchToast } from "@/components/chat/ModeSwitchToast";
import { MODE_BY_VALUE, type CognitiveMode, type PickableMode } from "@/lib/modes";
import { fonts, fontSize, px, radius, space, ThemeOverride, useColors } from "@/lib/theme";
import type {
  ChatMessage,
  ClarifyingOptionsSuggestion,
  DecisionReviewData,
  GeneratedImage,
  RefinedQuestionSuggestion,
  ThinkingReviewData,
  HealthConsentState,
} from "@/lib/sse";

/* Try it here, without signing up.
 *
 * The stage on the landing page is a picture of the product until you tap
 * it, at which point it becomes the product. It grows out of the box that
 * was tapped rather than appearing over it - the curtain is the same
 * curtain, and only the frame around it changes - because the thing being
 * demonstrated is that the box you were watching is real.
 *
 * Which is why this renders the app's own components rather than a sketch
 * of them: the real composer and the real message list. They are
 * prop-driven, so this costs almost nothing and cannot drift: a change to
 * the composer lands here the same day it lands in the app, because it is
 * the same file.
 *
 * The web scoped the app's dark tokens to this panel (data-theme="dark"), so
 * the chat surfaces sit on the photograph the way the design intends. React
 * Native has no cascade to scope; that takes a theme override from
 * lib/theme: GuestDemo wraps the panel in ThemeOverride, so every component
 * inside reads the dark palette.
 *
 * Then the lights go down. While it is still an invitation the curtain is
 * lit, as on the page; once a question has been asked it is a conversation,
 * and a bright photograph behind a paragraph of text is a photograph you are
 * reading through. The fade is the moment the demo stops advertising and
 * starts working.
 *
 * And the answers are the product's answers. The server runs a demo turn
 * through the app's own pipeline and this component drives it the way
 * ChatView does - the same events, the same handlers, the same pre-answer
 * questions, the same switch toast, the same Quick answer - so a visitor
 * sees every part of an answer a signed-in user would.
 *
 * It ends at 5,000 tokens with the way in, which the server decides - the
 * client shows the wall on the server's number rather than counting for
 * itself, because the only count that is true is the one that was charged.
 */

const DARK = "#1a0710"; // the house burgundy, with the lights down
const CURTAIN = require("@/assets/landing/curtain-stage.webp");

type Phase = "inviting" | "talking" | "spent";

/** Where the stage was on screen when it was tapped, in window points - what
 *  the web read from getBoundingClientRect. */
export type DemoOrigin = { top: number; left: number; width: number; height: number };

/** What a guest pressed that needs an account. The copy is per-control
 *  because "sign up to continue" under a microphone tells someone nothing
 *  about what they would get. */
const GATE_COPY: Record<string, { title: string; body: string }> = {
  call: {
    title: "Live calls need an account",
    body: "Talk to any companion out loud, interrupt it mid-sentence, and keep the transcript in the conversation afterwards.",
  },
  voice: {
    title: "Dictation needs an account",
    body: "Speak a question instead of typing it. It lands in the box as text, so you can read it back before you ask.",
  },
  attach: {
    title: "Attachments need an account",
    body: "Put a PDF, spreadsheet, slide deck or image in front of a companion, and ask about it for as long as the workspace lives.",
  },
  model: {
    title: "Choosing a model needs an account",
    body: "Pick the model by name in Co-Creative, or leave it on Auto and let Clardentity choose for each question.",
  },
};

/** A companion's display name, for the switch toast and banner - the app's
 *  own label ("Thought coach"), not the landing page's title-cased one, so
 *  the two say the same thing. */
function labelOf(
  modes: readonly { name: string; value: string }[],
  value: string,
): string {
  return MODE_BY_VALUE[value as PickableMode]?.label ?? modes.find((m) => m.value === value)?.name ?? value;
}

/** Same as the app: a stream with nothing to show after this long gets the
 *  Quick answer button. */
const SLOW_AFTER_MS = 7000;

let localIds = 0;

/** The visitor's question, shown the moment it is sent - the same
 *  optimistic message the app puts up before the server has answered. */
function questionMessage(content: string, mode: string): ChatMessage {
  localIds += 1;
  const id = `guest-local-${localIds}`;
  return {
    id,
    role: "user",
    content,
    mode_used: mode,
    reasoning_lens: null,
    confidence_score: null,
    confidence_band: null,
    avatar_expression: null,
    avatar_gesture: null,
    created_at: new Date().toISOString(),
    counterfactual_content: null,
    crux_text: null,
    clarifier: null,
    guidance: null,
    decision_review: null,
    thinking_review: null,
    generated_image: null,
    feedback: null,
    parent_id: null,
    sibling_index: 0,
    sibling_count: 1,
    sibling_ids: [id],
    claims: [],
  };
}

/** What the server is sent as history: the words of each turn, as the app's
 *  own history carries them (the answer's body, not its gist). */
function historyOf(messages: ChatMessage[]): GuestTurn[] {
  return messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && (m.content ?? "").trim())
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }));
}

/** What is kept for the account, if the visitor signs up: each turn with
 *  what its answer looked like. A picture-only answer has no prose, and the
 *  import needs some text, so it carries the picture's prompt. */
function stashOf(messages: ChatMessage[]): StashedTurn[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: (m.content ?? "").trim() || m.generated_image?.prompt || "Image",
      mode: m.mode_used,
      crux_text: m.crux_text,
      decision_review: m.decision_review,
      thinking_review: m.thinking_review,
      generated_image: m.generated_image,
      safety: m.safety ?? null,
    }));
}

type SendOptions = {
  modeConfirmed?: boolean;
  contextAcknowledged?: boolean;
  contextRounds?: number;
  refinedConfirmed?: boolean;
  clarifyingConfirmed?: boolean;
  /** Re-answer the last question rather than ask a new one. */
  regenerate?: boolean;
};

/* The icons the web drew inline, same paths. */
function PlusIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}
function CloseIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}
function BoltIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </Svg>
  );
}

const GROW = { duration: 460, easing: Easing.bezier(0.22, 1, 0.36, 1), reduceMotion: ReduceMotion.System };
const FADE = { duration: 700, reduceMotion: ReduceMotion.System };

/** Mounted only while it is open: the parent renders it conditionally, so
 *  every piece of state here - the conversation, the growth, the lights -
 *  starts fresh and nothing has to be reset on the way out. */
function GuestDemoPanel({
  origin,
  modes,
  initialMode,
  onClose,
}: {
  /** Where the stage was on screen when it was tapped, so the panel can
   *  grow out of it. Null means "no idea" - then it just fades in. */
  origin: DemoOrigin | null;
  modes: readonly { name: string; value: string; heroIcon: string }[];
  /** Whichever companion was lit when the box was tapped. */
  initialMode: string;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();

  /* Switchable, and it has to be. The mode arrives from whatever the stage
     happened to be cycling through, so a visitor who taps during Guidance
     and asks a factual question gets a polite redirection - correct
     behaviour for that companion, and a terrible first impression of the
     product. Carrying the lit mode across is the nice touch; being able to
     change it is what makes the touch safe. */
  const [mode, setMode] = useState(initialMode);
  const modeLabel = modes.find((m) => m.value === mode)?.name ?? "Finder";
  // Who is listening, as a companion (2026-10-15 feedback: "You're with your
  // learning companion" rather than "You're in Learning."). Thought coach
  // already names a person, so it needs no "companion" after it.
  const companionLine =
    mode === "thinking"
      ? "You’re with your thought coach."
      : `You’re with your ${modeLabel.toLowerCase()} companion.`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);
  const [sending, setSending] = useState(false);
  // Answer shown, claims still being checked - the app's "validating" state.
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [slowHint, setSlowHint] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("inviting");
  const [gate, setGate] = useState<string | null>(null);
  /* Smart switching, as in the app and on by default. */
  const [smartSwitching, setSmartSwitching] = useState(true);
  /* The pre-answer questions, held exactly as ChatView holds them: the
     accumulated send so far, so an answer is appended rather than replacing
     what was asked. */
  // Healthcare asked for the visitor's consent before answering (the app's
  // card, kept for this app session - lib/healthConsent).
  const [pendingHealth, setPendingHealth] = useState<{
    state: HealthConsentState;
    content: string;
    mode: string;
    /** Smart switching moved the question into Healthcare on its way to
     *  the card, so agreeing re-sends it there without asking again. */
    switched: boolean;
  } | null>(null);
  const [pendingContext, setPendingContext] = useState<{
    question: string;
    content: string;
    mode: string;
    rounds: number;
  } | null>(null);
  const [pendingRefined, setPendingRefined] = useState<{
    suggestion: RefinedQuestionSuggestion;
    content: string;
    mode: string;
  } | null>(null);
  const [pendingClarifying, setPendingClarifying] = useState<{
    suggestion: ClarifyingOptionsSuggestion;
    content: string;
    mode: string;
  } | null>(null);
  /* A question moved to a better companion: the toast while it is being
     answered, then the banner with the way back. */
  const [switchedFrom, setSwitchedFrom] = useState<{
    from: string;
    to: string;
    content: string;
    flags: SendOptions;
  } | null>(null);
  const [switchToast, setSwitchToast] = useState(false);
  const dismissSwitchToast = useCallback(() => setSwitchToast(false), []);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  // The verdict box and the picture can land before the "answer" event's
  // message exists; kept aside so swapping the streaming bubble for that
  // message does not make them vanish for the length of the checking.
  const earlyReviewRef = useRef<{
    decision_review?: DecisionReviewData | null;
    thinking_review?: ThinkingReviewData | null;
  } | null>(null);
  const earlyImageRef = useRef<GeneratedImage | null>(null);
  const hasAnsweredRef = useRef(false);
  const pendingQuestionIdRef = useRef<string | null>(null);
  const lastSendRef = useRef<{ content: string; mode: string } | null>(null);
  // What a regenerate took off the screen - the old answer and anything
  // after it - kept until the new answer exists. Stopped, dropped or refused
  // before then, the question gets its old answer back rather than being
  // left unanswered, which is what the app shows: it re-reads the thread,
  // and there the old answer was never deleted.
  const replacedRef = useRef<ChatMessage[] | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* The growth. The panel starts at the stage's own rectangle and is
     released to fill the screen, which is the whole of the "zoom" - no
     measuring of the destination, because the destination is the window. */
  const grow = useSharedValue(origin ? 0 : 1);
  const appear = useSharedValue(origin ? 1 : 0);
  useEffect(() => {
    grow.value = withTiming(1, GROW);
    appear.value = withTiming(1, GROW);
  }, [grow, appear]);
  const frame = useAnimatedStyle(() => {
    const t = grow.value;
    const o = origin ?? { top: 0, left: 0, width: screen.width, height: screen.height };
    return {
      top: o.top * (1 - t),
      left: o.left * (1 - t),
      width: o.width + (screen.width - o.width) * t,
      height: o.height + (screen.height - o.height) * t,
      borderRadius: px(14.44) * (1 - t),
      opacity: appear.value,
    };
  });

  useEffect(() => {
    // After the growth, not during it - focusing mid-transition brings the
    // keyboard up into the animation.
    const t = setTimeout(() => inputRef.current?.focus(), 420);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // The fallback timer behind the Quick answer button, as in the app.
  useEffect(() => {
    if (!sending || hasAnsweredRef.current) return;
    if (lastSendRef.current?.mode === "rapid") return;
    const timer = setTimeout(() => setSlowHint(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [sending]);

  /** Put back what a regenerate replaced, if its replacement never came. */
  const restoreReplaced = useCallback(() => {
    const replaced = replacedRef.current;
    replacedRef.current = null;
    if (hasAnsweredRef.current || !replaced?.length) return;
    setMessages((prev) => [...prev, ...replaced]);
  }, []);

  /** Cut the answer off. Before the answer event nothing exists, so the
   *  question comes back off the screen too - the app's rule - and a
   *  regenerate's old answer comes back on, unless `restore` is false
   *  because the same regenerate is about to be asked again. */
  const halt = useCallback(
    (restore: boolean) => {
      abortRef.current?.abort();
      if (!hasAnsweredRef.current && pendingQuestionIdRef.current) {
        const id = pendingQuestionIdRef.current;
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
      if (restore) restoreReplaced();
      pendingQuestionIdRef.current = null;
      setStreaming(null);
      setSending(false);
      setSlowHint(false);
      setValidatingId(null);
    },
    [restoreReplaced],
  );
  const stop = useCallback(() => halt(true), [halt]);

  const send = useCallback(
    async (content: string, sendMode: string, options: SendOptions = {}) => {
      const message = content.trim();
      if (!message) return;

      setDraft("");
      setError(null);
      setGate(null);
      setPendingContext(null);
      setPendingHealth(null);
      setPendingRefined(null);
      setPendingClarifying(null);
      setPhase((p) => (p === "inviting" ? "talking" : p));

      // On a regenerate the question is already on screen and its old
      // answer has been taken off; everything before the question is the
      // history, exactly as the app sends it.
      const before = messagesRef.current;
      const history = historyOf(
        options.regenerate && before.at(-1)?.role === "user" ? before.slice(0, -1) : before,
      );
      const question = options.regenerate ? null : questionMessage(message, sendMode);
      if (question) setMessages((prev) => [...prev, question]);
      if (!options.regenerate) replacedRef.current = null;
      pendingQuestionIdRef.current = question?.id ?? null;
      hasAnsweredRef.current = false;
      earlyReviewRef.current = null;
      earlyImageRef.current = null;
      lastSendRef.current = { content: message, mode: sendMode };
      setStreaming({ mode_used: sendMode, content: "" });
      setSending(true);
      setSlowHint(false);
      track("guest_demo_asked", { mode: sendMode });

      const controller = new AbortController();
      abortRef.current = controller;
      let answerMode = sendMode;

      const rollBack = () => {
        if (question) setMessages((prev) => prev.filter((m) => m.id !== question.id));
        restoreReplaced();
        setStreaming(null);
        setSending(false);
        setSlowHint(false);
      };

      await streamGuestMessage(
        {
          sessionId: guestSessionId(),
          mode: sendMode,
          message,
          history,
          smartSwitching,
          modeConfirmed: options.modeConfirmed,
          contextAcknowledged: options.contextAcknowledged,
          contextRounds: options.contextRounds,
          refinedConfirmed: options.refinedConfirmed,
          clarifyingConfirmed: options.clarifyingConfirmed,
          regenerate: options.regenerate,
          // What "make it darker" refers to: the last picture drawn here.
          lastImageId:
            [...before].reverse().find((m) => m.role === "assistant" && m.generated_image)
              ?.generated_image?.id ?? null,
        },
        {
          onSwitched: (from, to) => {
            // Before any text, so the toast is up while the answer is being
            // written rather than appearing under a finished one.
            answerMode = to;
            setMode(to);
            setStreaming((prev) => (prev ? { ...prev, mode_used: to } : prev));
            setSwitchedFrom({ from, to, content: message, flags: options });
            setSwitchToast(true);
            track("guest_demo_mode_switched", { from, to });
          },
          onStatus: (status) => {
            if (status.phase === "slow" && sendMode !== "rapid") setSlowHint(true);
            if (status.phase === "image") {
              setStreaming((prev) => (prev ? { ...prev, makingImage: true } : prev));
            }
          },
          onReview: (review) => {
            earlyReviewRef.current = review;
            setStreaming((prev) =>
              prev
                ? {
                    ...prev,
                    decisionReview: review.decision_review ?? prev.decisionReview ?? null,
                    thinkingReview: review.thinking_review ?? prev.thinkingReview ?? null,
                  }
                : prev,
            );
          },
          onSafety: (card) => {
            setStreaming((prev) => (prev ? { ...prev, safety: card } : prev));
          },
          onImage: (image) => {
            earlyImageRef.current = image;
            setStreaming((prev) => (prev ? { ...prev, generatedImage: image } : prev));
            setMessages((prev) => {
              for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].role === "assistant") {
                  if (prev[i].generated_image) return prev;
                  const next = [...prev];
                  next[i] = { ...next[i], generated_image: image };
                  return next;
                }
              }
              return prev;
            });
          },
          onCrux: (text) => {
            setSlowHint(false);
            setStreaming((prev) => (prev ? { ...prev, crux: text } : prev));
          },
          onDelta: (text) => {
            setStreaming((prev) => (prev ? { ...prev, content: prev.content + text } : prev));
          },
          onAnswer: (answer) => {
            // The text is written; only the checking is outstanding, and the
            // composer comes back now rather than after it - the app's rule.
            hasAnsweredRef.current = true;
            pendingQuestionIdRef.current = null;
            replacedRef.current = null;
            setSlowHint(false);
            const early = earlyReviewRef.current;
            const earlyImage = earlyImageRef.current;
            const carried = {
              ...answer,
              mode_used: answerMode,
              decision_review: answer.decision_review ?? early?.decision_review ?? null,
              thinking_review: answer.thinking_review ?? early?.thinking_review ?? null,
              generated_image: answer.generated_image ?? earlyImage ?? null,
            };
            setMessages((prev) => [...prev, carried]);
            setStreaming(null);
            setSending(false);
            setValidatingId(answer.id);
          },
          onFinal: (final) => {
            setMessages((prev) => {
              const index = prev.findIndex((m) => m.id === final.message.id);
              if (index === -1) return [...prev, final.message];
              const next = [...prev];
              next[index] = final.message;
              return next;
            });
            setValidatingId(null);
            setStreaming(null);
            setSending(false);
          },
          onHealthConsent: (state) => {
            rollBack();
            // `answerMode`, not `sendMode`: a question switched into
            // Healthcare reaches the card after the `switched` event.
            setPendingHealth({
              state,
              content: message,
              mode: answerMode,
              switched: answerMode !== sendMode,
            });
          },
          onContextQuestion: (asked) => {
            rollBack();
            setPendingContext({
              question: asked.question,
              content: message,
              mode: sendMode,
              rounds: options.contextRounds ?? 0,
            });
          },
          onRefinedQuestion: (suggestion) => {
            rollBack();
            setPendingRefined({ suggestion, content: message, mode: sendMode });
          },
          onClarifyingOptions: (suggestion) => {
            rollBack();
            setPendingClarifying({ suggestion, content: message, mode: sendMode });
          },
          onBudget: (budget) => {
            if (!budget.limit_reached) return;
            // The wall can also be the whole reply - an allowance already
            // spent - in which case nothing is being written.
            restoreReplaced();
            setStreaming(null);
            setSending(false);
            setValidatingId(null);
            setPhase("spent");
            track("guest_demo_limit");
            // Stashed at the wall, not at the tap on "create an account":
            // by then this component is unmounting and the conversation it
            // holds is the only copy there has ever been. After the final
            // event's update, which this updater runs behind.
            setMessages((prev) => {
              stashGuestTranscript(answerMode, stashOf(prev));
              return prev;
            });
          },
          onError: (detail) => {
            restoreReplaced();
            setError(detail);
            setStreaming(null);
            setSending(false);
            setSlowHint(false);
            setValidatingId(null);
          },
          onDropped: () => {
            // The demo has no saved answer to go back and read, so a lost
            // connection is said plainly rather than recovered from.
            if (controller.signal.aborted) return;
            if (!hasAnsweredRef.current && question) {
              setMessages((prev) => prev.filter((m) => m.id !== question.id));
            }
            restoreReplaced();
            setError("The answer stopped partway. Try again?");
            setStreaming(null);
            setSending(false);
            setSlowHint(false);
            setValidatingId(null);
          },
        },
        controller.signal,
      );
    },
    [smartSwitching, restoreReplaced],
  );

  /* Android's back button: it stops an answer that is being written, as
     Escape does in the app; with nothing running it closes the demo. */
  const onBack = useCallback(() => {
    if (sending) stop();
    else onClose();
  }, [sending, stop, onClose]);

  /* Start again. The budget is the server's and survives this, which is the
     point of showing it: a new chat is free, the allowance is not, and
     finding that out here is better than finding it out after signing up. */
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    replacedRef.current = null;
    setMessages([]);
    setStreaming(null);
    setSending(false);
    setValidatingId(null);
    setDraft("");
    setError(null);
    setGate(null);
    setPendingContext(null);
    setPendingRefined(null);
    setPendingClarifying(null);
    setSwitchedFrom(null);
    setPhase((p) => (p === "spent" ? p : "inviting"));
    track("guest_demo_new_chat");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  /* The thread's own controls, as far as a conversation that lives in this
     component can have them. The app keeps every version as a branch; the
     demo keeps the latest, which is the version that is read. */
  const regenerate = useCallback(
    (messageId: string) => {
      const list = messagesRef.current;
      const index = list.findIndex((m) => m.id === messageId);
      const question = index > 0 ? list[index - 1] : null;
      if (!question || question.role !== "user") return;
      track("answer_regenerated", { mode: list[index].mode_used });
      replacedRef.current = list.slice(index);
      setMessages(list.slice(0, index));
      messagesRef.current = list.slice(0, index);
      void send(question.content ?? "", list[index].mode_used, { regenerate: true });
    },
    [send],
  );

  const editQuestion = useCallback(
    (messageId: string, content: string) => {
      const list = messagesRef.current;
      const index = list.findIndex((m) => m.id === messageId);
      if (index === -1) return;
      setMessages(list.slice(0, index));
      messagesRef.current = list.slice(0, index);
      void send(content, mode);
    },
    [send, mode],
  );

  const deleteFrom = useCallback((messageId: string) => {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === messageId);
      return index === -1 ? prev : prev.slice(0, index);
    });
  }, []);

  const quickAnswer = useCallback(() => {
    const last = lastSendRef.current;
    if (!last) return;
    track("quick_answer_tapped", { mode: last.mode });
    // The quick answer to a regenerate is still a regenerate: the question
    // stays where it is and the old answer stays off.
    const regenerating = replacedRef.current !== null && !hasAnsweredRef.current;
    halt(!regenerating);
    void send(last.content, "rapid", { modeConfirmed: true, regenerate: regenerating });
  }, [send, halt]);

  /* The way in. The web's link navigated away and took this panel with it;
     a Modal stays above whatever is pushed under it, so it closes first. */
  const signUp = useCallback(
    (from: string) => {
      track("guest_demo_signup_clicked", { from });
      onClose();
      router.push("/register");
    },
    [onClose],
  );

  const lightsDown = phase !== "inviting";
  const curtain = useSharedValue(1);
  const veil = useSharedValue(0.35);
  useEffect(() => {
    curtain.value = withTiming(lightsDown ? 0.18 : 1, FADE);
    veil.value = withTiming(lightsDown ? 1 : 0.35, FADE);
  }, [lightsDown, curtain, veil]);
  const curtainStyle = useAnimatedStyle(() => ({ opacity: curtain.value }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  const gateCopy = gate ? GATE_COPY[gate] : null;
  const empty = phase === "inviting" && messages.length === 0 && !sending;
  const white = (alpha: number) => `rgba(255,255,255,${alpha})`;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onBack}>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={`Try Clardentity in ${modeLabel} mode`}
        style={[{ position: "absolute", overflow: "hidden", backgroundColor: DARK }, frame]}
      >
        {/* The same photograph, in the same crop - it is the point of growing
            out of the stage rather than opening over it. */}
        <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, curtainStyle]}>
          <Image source={CURTAIN} contentFit="cover" style={{ flex: 1 }} accessible={false} />
        </Animated.View>
        {/* The lights going down: one veil, deepening, rather than swapping
            one background for another. */}
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, veilStyle]}
        >
          <LinearGradient colors={["rgba(26,7,16,0.55)", DARK]} style={{ flex: 1 }} />
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              paddingTop: insets.top + px(64),
              paddingBottom: insets.bottom + space(6),
              paddingHorizontal: space(4),
            }}
          >
            {empty ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: fontSize["2xl"], color: "#ffffff", textAlign: "center" }}>
                  Hi, Welcome to Clardentity.
                </Text>
                {/* Which companion is listening, and nothing about not having
                    an account - the way in is already on the screen, and
                    leading with what the visitor lacks is a strange way to
                    open. */}
                <Text style={{ marginTop: space(2), fontFamily: fonts.regular, fontSize: fontSize.sm, color: white(0.7), textAlign: "center" }}>
                  {companionLine}
                </Text>
                <ModeDisclosure
                  mode={mode}
                  style={{ marginTop: space(2), maxWidth: px(448), textAlign: "center", fontSize: fontSize.xs, color: white(0.55) }}
                />
              </View>
            ) : (
              <View style={{ flex: 1, minHeight: 0 }}>
                {/* The app's own list, with the app's own callbacks where a
                    conversation held in this component can honour them:
                    another answer, an edited question, deleting from a point.
                    Rating and exporting write to a conversation that does not
                    exist for a guest; the empty conversation id is what keeps
                    those off the screen rather than present and broken. */}
                <MessageList
                  conversationId=""
                  messages={messages}
                  streaming={streaming}
                  busy={sending}
                  validatingId={validatingId}
                  onRegenerate={regenerate}
                  onSubmitEdit={editQuestion}
                  onDeleteMessage={deleteFrom}
                  onClarifierAnswer={(answer: string) => void send(answer, mode)}
                  onUseMode={(next: string) => setMode(next)}
                  onAskRefined={(q: string) => void send(q, mode)}
                />
              </View>
            )}

            {/* The pre-answer questions, between the thread and the composer,
                exactly where the app puts them and with the app's cards. */}
            <ScrollView style={{ maxHeight: screen.height * 0.45, flexGrow: 0 }} keyboardShouldPersistTaps="handled">
              {pendingHealth && (
                <View style={{ marginBottom: space(3) }}>
                  <HealthConsentCard
                    state={pendingHealth.state}
                    onAgree={() => {
                      const { state, content, mode: healthMode, switched } = pendingHealth;
                      rememberSessionHealthConsent(state.version);
                      setPendingHealth(null);
                      track("consent_choice", { choice: "health_granted_demo" });
                      void send(content, healthMode, switched ? { modeConfirmed: true } : {});
                    }}
                    onDecline={() => {
                      setPendingHealth(null);
                      setDraft(pendingHealth.content);
                    }}
                  />
                </View>
              )}
              {pendingContext && (
                <ContextQuestionCard
                  key={pendingContext.rounds}
                  question={pendingContext.question}
                  busy={sending}
                  onAnswer={(context: string) =>
                    void send(
                      `${pendingContext.content}\n\n(Clardentity asked: "${pendingContext.question}")\n${context}`,
                      pendingContext.mode,
                      { contextRounds: pendingContext.rounds + 1 },
                    )
                  }
                  onSkip={() =>
                    void send(pendingContext.content, pendingContext.mode, {
                      contextAcknowledged: true,
                      contextRounds: pendingContext.rounds,
                    })
                  }
                />
              )}
              {pendingRefined && (
                <RefinedQuestionCard
                  refinedQuestion={pendingRefined.suggestion.refined_question}
                  reason={pendingRefined.suggestion.refinement_reason}
                  busy={sending}
                  onAskRefined={() =>
                    void send(
                      `${pendingRefined.content}\n\n(Clardentity asked: "Did you mean: ${pendingRefined.suggestion.refined_question}")\n${pendingRefined.suggestion.refined_question}`,
                      pendingRefined.mode,
                      { refinedConfirmed: true },
                    )
                  }
                  onKeepOriginal={() =>
                    void send(pendingRefined.content, pendingRefined.mode, { refinedConfirmed: true })
                  }
                />
              )}
              {pendingClarifying && (
                <ClarifyingOptionsCard
                  question={pendingClarifying.suggestion.question}
                  options={pendingClarifying.suggestion.options}
                  busy={sending}
                  onAnswer={(answer: string) =>
                    void send(
                      `${pendingClarifying.content}\n\n(Clardentity asked: "${pendingClarifying.suggestion.question}")\n${answer}`,
                      pendingClarifying.mode,
                      { clarifyingConfirmed: true },
                    )
                  }
                  onSkip={() =>
                    void send(pendingClarifying.content, pendingClarifying.mode, {
                      clarifyingConfirmed: true,
                    })
                  }
                />
              )}
            </ScrollView>

            {error && (
              <Text style={{ marginTop: space(3), fontFamily: fonts.regular, fontSize: fontSize.sm, color: "#ff9db4" }}>
                {error}
              </Text>
            )}

            {phase === "spent" ? (
              <View
                style={{
                  marginTop: space(6),
                  borderRadius: radius["2xl"],
                  borderWidth: 1,
                  borderColor: white(0.15),
                  backgroundColor: white(0.07),
                  padding: space(5),
                  alignItems: "center",
                }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.lg, color: "#ffffff", textAlign: "center" }}>
                  That&apos;s the preview. Don&apos;t lose it.
                </Text>
                <Text
                  style={{
                    marginTop: space(1),
                    fontFamily: fonts.regular,
                    fontSize: fontSize.sm,
                    lineHeight: fontSize.sm * 1.6,
                    color: white(0.7),
                    textAlign: "center",
                  }}
                >
                  Create a free account and this conversation comes with you - every message, in your own workspace.
                  Then keep going in any of the eight companions, with each claim checked against its source.
                </Text>
                <Pressable
                  onPress={() => signUp("limit")}
                  accessibilityRole="link"
                  style={({ pressed }) => ({
                    marginTop: space(4),
                    height: px(44),
                    justifyContent: "center",
                    borderRadius: radius.full,
                    backgroundColor: "#ffffff",
                    paddingHorizontal: space(6),
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: DARK }}>Save it to a free account</Text>
                </Pressable>
                {/* Said plainly, because the promise above is about their
                    words and the honest version of it has a condition. */}
                <Text style={{ marginTop: space(2), fontFamily: fonts.regular, fontSize: fontSize.xs, color: white(0.5) }}>
                  Saved when you sign up on this device.
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: space(3), gap: space(2) }}>
                {/* What a guest pressed, and what it would have done. Above the
                    composer rather than over it, so the control they reached
                    for is still visible under their own hand. */}
                {gateCopy && (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      columnGap: space(4),
                      rowGap: space(2),
                      borderRadius: radius["2xl"],
                      borderWidth: 1,
                      borderColor: white(0.15),
                      backgroundColor: white(0.07),
                      paddingHorizontal: space(4),
                      paddingVertical: space(3),
                    }}
                  >
                    <View style={{ flexGrow: 1, flexBasis: px(180), minWidth: 0 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: "#ffffff" }}>{gateCopy.title}</Text>
                      <Text
                        style={{
                          marginTop: space(0.5),
                          fontFamily: fonts.regular,
                          fontSize: fontSize.sm,
                          lineHeight: fontSize.sm * 1.6,
                          color: white(0.7),
                        }}
                      >
                        {gateCopy.body}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => signUp(gate ?? "")}
                      accessibilityRole="link"
                      style={({ pressed }) => ({
                        height: px(36),
                        justifyContent: "center",
                        borderRadius: radius.full,
                        backgroundColor: "#ffffff",
                        paddingHorizontal: space(4),
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: DARK }}>Create a free account</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setGate(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss"
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: px(28),
                        height: px(28),
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: radius.full,
                        backgroundColor: pressed ? white(0.1) : "transparent",
                      })}
                    >
                      <CloseIcon size={px(16)} color={white(0.6)} />
                    </Pressable>
                  </View>
                )}

                {/* The app's switch toast: what just happened, a four-second
                    ring, and one button to have it answered where it was
                    asked instead. */}
                {switchToast && switchedFrom && (
                  <ModeSwitchToast
                    from={labelOf(modes, switchedFrom.from)}
                    to={labelOf(modes, switchedFrom.to)}
                    onDismiss={dismissSwitchToast}
                    onRevert={() => {
                      stop();
                      const { from, content, flags } = switchedFrom;
                      track("mode_switch_reverted", { to: from, via: "countdown" });
                      setSwitchToast(false);
                      setSwitchedFrom(null);
                      setMode(from);
                      void send(content, from, { ...flags, modeConfirmed: true });
                    }}
                  />
                )}

                {sending && slowHint && !streaming?.crux && (
                  // The app's Quick answer: an instant, unchecked answer
                  // instead of the long one.
                  <View style={{ alignItems: "center" }}>
                    <Pressable
                      onPress={quickAnswer}
                      accessibilityRole="button"
                      accessibilityLabel="Stop this answer and get an instant, unchecked one instead"
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space(1.5),
                        borderRadius: radius.lg,
                        backgroundColor: c.ink,
                        paddingHorizontal: space(3),
                        paddingVertical: space(1.5),
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <BoltIcon size={px(14)} color={c.inkInverse} />
                      <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.inkInverse }}>Quick answer</Text>
                    </Pressable>
                  </View>
                )}

                {/* The app's mode picker, not a row of pills that looks like
                    it. Nothing is locked here: the demo's whole argument is
                    that all eight are a question away. */}
                <ModeSelector
                  value={mode as CognitiveMode}
                  onChange={(next: CognitiveMode) => {
                    track("guest_demo_mode_picked", { mode: next });
                    setSwitchedFrom(null);
                    setMode(next);
                  }}
                  disabled={sending}
                  lockedModes={[]}
                />

                {/* The banner the app leaves once the toast has gone: the way
                    back, for as long as the moved question is the last one. */}
                {switchedFrom && !switchToast && mode === switchedFrom.to && (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: space(2),
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: c.brandBorder,
                      backgroundColor: c.brandSoft,
                      paddingHorizontal: space(3),
                      paddingVertical: space(1.5),
                    }}
                  >
                    <AppText size="xs" tone="secondary">
                      Switched to {labelOf(modes, switchedFrom.to)} - it suits this question better.
                    </AppText>
                    {sending ? (
                      <Pressable
                        onPress={() => {
                          stop();
                          const { from, content, flags } = switchedFrom;
                          track("mode_switch_reverted", { to: from, via: "banner" });
                          setSwitchedFrom(null);
                          setMode(from);
                          void send(content, from, { ...flags, modeConfirmed: true });
                        }}
                        accessibilityRole="button"
                      >
                        <AppText size="xs" weight="medium" tone="brand">
                          Answer in {labelOf(modes, switchedFrom.from)} instead
                        </AppText>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setMode(switchedFrom.from);
                          setSwitchedFrom(null);
                        }}
                        accessibilityRole="button"
                      >
                        <AppText size="xs" weight="medium" tone="brand">
                          Back to {labelOf(modes, switchedFrom.from)}
                        </AppText>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setSwitchedFrom(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss"
                      hitSlop={8}
                      style={{ marginLeft: "auto", paddingHorizontal: space(1) }}
                    >
                      <AppText size="xs" tone="muted">
                        ×
                      </AppText>
                    </Pressable>
                  </View>
                )}

                {/* The product's composer, whole. */}
                <MessageInput
                  disabled={sending}
                  disabledReason={sending ? "Writing the answer…" : undefined}
                  value={draft}
                  onChange={setDraft}
                  onSend={(content: string) => void send(content, mode)}
                  textareaRef={inputRef}
                  mode={mode}
                  isGenerating={sending}
                  onStop={stop}
                  onStartCall={() => {
                    track("guest_demo_gated", { feature: "call" });
                    setGate("call");
                  }}
                  gated={(feature: string) => {
                    track("guest_demo_gated", { feature });
                    setGate(feature);
                  }}
                  trailing={
                    // Same control, same place, same words as the app.
                    <Pressable
                      onPress={() => setSmartSwitching((on) => !on)}
                      disabled={sending}
                      accessibilityRole="button"
                      accessibilityLabel={
                        smartSwitching
                          ? "Smart: a question that fits another mode better is answered there automatically, with a way back. Tap for manual."
                          : "Manual: the mode is whatever you pick; it never switches. Tap for smart."
                      }
                      style={({ pressed }) => ({
                        borderRadius: radius.md,
                        paddingHorizontal: space(2),
                        paddingVertical: space(1),
                        backgroundColor: pressed ? c.surfaceHover : "transparent",
                        opacity: sending ? 0.5 : 1,
                      })}
                    >
                      <AppText tone="muted">{smartSwitching ? "Smart" : "Manual"}</AppText>
                    </Pressable>
                  }
                />
                {messages.length > 0 && (
                  <ModeDisclosure
                    mode={mode}
                    style={{ marginTop: space(1.5), paddingHorizontal: space(2), textAlign: "center", fontSize: fontSize.xs, color: white(0.55) }}
                  />
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* The chrome the app puts at the top of a thread, in the order it puts
            it: start again on the left, close on the right. After the body so
            it draws, and takes taps, above it. */}
        <View
          style={{
            position: "absolute",
            right: space(4),
            top: insets.top + space(4),
            flexDirection: "row",
            alignItems: "center",
            gap: space(2),
          }}
        >
          <Pressable
            onPress={newChat}
            disabled={sending || messages.length === 0}
            accessibilityRole="button"
            accessibilityLabel="New chat"
            style={({ pressed }) => ({
              height: px(36),
              flexDirection: "row",
              alignItems: "center",
              gap: space(1.5),
              borderRadius: radius.full,
              backgroundColor: pressed ? white(0.2) : white(0.1),
              paddingHorizontal: space(3),
              opacity: sending || messages.length === 0 ? 0.4 : 1,
            })}
          >
            <PlusIcon size={px(16)} color={white(0.8)} />
            <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: white(0.8) }}>New chat</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close the demo"
            style={({ pressed }) => ({
              width: px(36),
              height: px(36),
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radius.full,
              backgroundColor: pressed ? white(0.2) : white(0.1),
            })}
          >
            <CloseIcon size={px(20)} color={white(0.8)} />
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

/** The demo, drawn in the dark palette as the web scopes it. */
export function GuestDemo(props: Parameters<typeof GuestDemoPanel>[0]) {
  return (
    <ThemeOverride theme="dark">
      <GuestDemoPanel {...props} />
    </ThemeOverride>
  );
}
