import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { ErrorBoundary } from "@/components/system/ErrorBoundaries";
import { usePhoneLayout } from "@/lib/usePhoneLayout";
import type {
  Claim,
  ChatMessage,
  Evidence,
  Guidance,
  DecisionReviewData,
  GeneratedImage,
  SafetyCardData,
  ThinkingReviewData,
} from "@/lib/sse";
import { ConfidenceBadge } from "@/components/chat/ConfidenceBadge";
import { CruxCard } from "@/components/chat/CruxCard";
import { modeLabel } from "@/lib/modes";
import { SourcesFooter } from "@/components/chat/SourcesFooter";
import { CitationPopover } from "@/components/chat/CitationPopover";
import { OpinionMarker } from "@/components/chat/OpinionMarker";
import { ResponseFlip, FlipButton, useCounterfactual } from "@/components/chat/ResponseFlip";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { ClarifierCard } from "@/components/chat/ClarifierCard";
import { GuidanceCard } from "@/components/chat/GuidanceCard";
import { DecisionReview } from "@/components/chat/DecisionReview";
import {
  GeneratedImageCard,
  GeneratedImagePlaceholder,
} from "@/components/chat/GeneratedImageCard";
import { ThinkingReview } from "@/components/chat/ThinkingReview";
import { SafetyCard } from "@/components/chat/SafetyCard";
import { FeedbackWidget } from "@/components/chat/FeedbackWidget";
import { ExportFileMenu } from "@/components/chat/ExportFileMenu";
import { cleanMessageText } from "@/lib/text";
import { renderInline, splitBlocks } from "@/lib/markdown";
import { Spinner } from "@/components/ui/primitives";
import { sessionStorage } from "@/lib/storage";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";
import { track } from "@/lib/analytics";

export type StreamingMessage = {
  mode_used: string;
  content: string;
  /** Arrives before any body text (its own SSE event), so the gist is the
   *  first thing on screen and the body streams in behind the fold. */
  crux?: string | null;
  /** The verdict box, when its event has landed - normally before the gist. */
  decisionReview?: DecisionReviewData | null;
  thinkingReview?: ThinkingReviewData | null;
  /** Co-Creative: the picture, once it has finished. Usually lands after the
   *  answer has streamed - generating one takes ten to twenty seconds. */
  generatedImage?: GeneratedImage | null;
  /** True between "a picture is being made" and the picture arriving. */
  makingImage?: boolean;
  /** The support card, when the safety screen flagged the question. Arrives
   *  before any text, so it shows over the rabbit. */
  safety?: SafetyCardData | null;
};

/* The thread's rows. The web maps messages into a scrolling div and appends
 * the streaming pieces after them; a FlatList wants one array, so the
 * streaming pieces are rows of their own at the end. */
type Row =
  | { key: string; kind: "message"; message: ChatMessage }
  | { key: string; kind: "streaming-safety"; card: SafetyCardData }
  | { key: string; kind: "thinking" }
  | { key: string; kind: "streaming"; streaming: StreamingMessage };

/** How close to the bottom still counts as "at the bottom": 80px of slack,
 *  so it survives the last line of a message and a rounding error. */
const AT_BOTTOM_SLACK = 80;

export function MessageList({
  conversationId,
  messages,
  streaming,
  playingMessageId,
  onPlayAudio,
  emptyStateAvatar,
  validatingId,
  onRegenerate,
  onDeleteMessage,
  onSwitchBranch,
  busy,
  thinkingLabel,
  onClarifierAnswer,
  onUseMode,
  onAskRefined,
  loading,
  onSubmitEdit,
  emptyState,
}: {
  conversationId: string;
  messages: ChatMessage[];
  streaming: StreamingMessage | null;
  playingMessageId?: string | null;
  onPlayAudio?: (messageId: string, text: string) => void;
  /** Shown above the empty-state copy. An empty chat is the one moment there
   *  is room for the companion at full size, and the one moment a greeting
   *  from it is worth anything. */
  emptyStateAvatar?: ReactNode;
  /** Answer shown and saved, claims still being checked. */
  validatingId?: string | null;
  onRegenerate?: (messageId: string) => void;
  /** Permanently deletes this message and everything after it, so the
   *  conversation can continue fresh from here. Offered on both roles. */
  onDeleteMessage?: (messageId: string) => void;
  /** Fork switcher: move to the branch that starts with this sibling id. */
  onSwitchBranch?: (messageId: string) => void;
  busy?: boolean;
  /** Named progress for the indicator ("Searching the web"); phone layout only, set by ChatView. */
  thinkingLabel?: string | null;
  /** Sends a clarifying-question answer as the next message. */
  onClarifierAnswer?: (answer: string) => void;
  /** Acting on a guidance nudge: switch mode, or ask the sharper question. */
  onUseMode?: (mode: string) => void;
  onAskRefined?: (question: string) => void;
  /** History is still being fetched. Distinct from "there is nothing here" -
   *  showing the empty state first made every reopened chat flash
   *  "Start a chat" before its messages arrived. */
  loading?: boolean;
  onSubmitEdit?: (messageId: string, content: string) => void;
  /** Shown in the middle of a chat with nothing in it yet. Passed in rather
   *  than built here because this list is also the landing page's guest
   *  demo, which has no account and must not greet anybody by name. */
  emptyState?: ReactNode;
}) {
  const s = useThemedStyles(listStyles);
  const colors = useColors();
  const listRef = useRef<FlatList<Row>>(null);
  /* Where the thread is scrolled to, from the last scroll event and layout.
   * The web reads these off the element whenever it needs them; a native
   * list only reports them, so they are kept here. */
  const metrics = useRef({ offset: 0, content: 0, layout: 0 });
  const fromBottom = () => metrics.current.content - metrics.current.offset - metrics.current.layout;

  /* Whether to follow new content down.
   *
   * True until you scroll away from the bottom yourself. Without this, reading
   * back through an answer while the next one streams in yanks you to the
   * bottom every few hundred milliseconds - the one thing worse than not
   * scrolling at all. A ref rather than state: it changes on every scroll
   * event and nothing renders from it. */
  const stickToBottom = useRef(true);

  // True while our own smooth scroll is travelling. Its in-between positions
  // fire scroll events that look exactly like the reader scrolling up, and
  // used to switch following off halfway down - the new answer then grew
  // below the fold with nothing scrolling after it.
  const autoScrolling = useRef(false);
  // The next follow should glide rather than jump: set when a new message
  // lands, read by the content-size handler below.
  const smoothNext = useRef(false);

  /* Phone only: a "jump to latest" button once you are more than a screen
   * up, and your place in each chat kept for the session - leave a chat
   * halfway through and come back, and it opens where you were rather than
   * at the bottom. Per chat, in sessionStorage (memory, for the life of the
   * app process), dropped once you're back at the bottom. */
  const phone = usePhoneLayout();
  const [showJump, setShowJump] = useState(false);
  const placeKey = `clardentity-place:${conversationId}`;
  const savePlace = useRef(0);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    metrics.current = {
      offset: contentOffset.y,
      content: contentSize.height,
      layout: layoutMeasurement.height,
    };
    const distance = fromBottom();
    const atBottom = distance < AT_BOTTOM_SLACK;
    if (phone) {
      setShowJump(distance > layoutMeasurement.height);
      if (!savePlace.current) {
        savePlace.current = requestAnimationFrame(() => {
          savePlace.current = 0;
          if (fromBottom() < AT_BOTTOM_SLACK) sessionStorage.removeItem(placeKey);
          // unrounded, as on the web: a rounded value restored a pixel off
          else sessionStorage.setItem(placeKey, metrics.current.offset.toFixed(2));
        });
      }
    }
    if (autoScrolling.current) {
      if (atBottom) autoScrolling.current = false;
      return;
    }
    stickToBottom.current = atBottom;
  }

  const lastMessageId = messages.at(-1)?.id ?? null;
  const hasMessages = messages.length > 0;

  // Back to where you were in this chat - once, as the thread first lays
  // out, and before the follow below would carry it to the bottom. A native
  // list measures its rows as it renders them, so the saved offset may not
  // be reachable on the first size report; it waits for one that is, with a
  // short fallback for a chat that has since got shorter.
  const placeRestored = useRef(false);
  const savedPlace = useRef<number | null | undefined>(undefined);
  const restoreFallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** True while a restore is pending or just happened - the follow skips. */
  function restorePlace(contentHeight: number): boolean {
    if (placeRestored.current || !phone || !hasMessages) return false;
    if (savedPlace.current === undefined) {
      const raw = sessionStorage.getItem(placeKey);
      const n = raw === null ? null : Number(raw);
      savedPlace.current = n !== null && Number.isFinite(n) ? n : null;
    }
    const saved = savedPlace.current;
    if (saved === null) {
      placeRestored.current = true;
      return false;
    }
    stickToBottom.current = false;
    const reachable = contentHeight - metrics.current.layout;
    if (metrics.current.layout > 0 && reachable >= saved) {
      placeRestored.current = true;
      listRef.current?.scrollToOffset({ offset: saved, animated: false });
      return true;
    }
    if (!restoreFallback.current) {
      restoreFallback.current = setTimeout(() => {
        if (placeRestored.current) return;
        placeRestored.current = true;
        const max = Math.max(0, metrics.current.content - metrics.current.layout);
        listRef.current?.scrollToOffset({ offset: Math.min(saved, max), animated: false });
      }, 600);
    }
    return true;
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(savePlace.current);
      if (restoreFallback.current) clearTimeout(restoreFallback.current);
    },
    [],
  );

  function jumpToLatest() {
    stickToBottom.current = true;
    autoScrolling.current = true;
    setShowJump(false);
    listRef.current?.scrollToEnd({ animated: true });
    setTimeout(() => (autoScrolling.current = false), 800);
  }

  /* What a streaming answer opens with, and so when its bubble may appear.
   *
   * The gist, normally. Thought coach leads with its box instead, so the box
   * alone is enough to open the bubble there. Decision-making's box sits
   * *under* the gist (gist, then the decisions, then the journey), so a box
   * that lands first - it often does, a few seconds ahead - waits for the
   * gist rather than appearing and then being pushed down by it. */
  const streamingLead = Boolean(streaming?.crux || streaming?.thinkingReview);

  // A new message - yours or its answer - is the moment you want to be at the
  // bottom, so this one is smooth and deliberate.
  useEffect(() => {
    if (!stickToBottom.current) return;
    // Already there: no scroll will happen, so no scroll event would ever
    // release the flag below - and a reader scrolling up in the next 800ms
    // would be ignored, then yanked down by the next message.
    if (fromBottom() < 2) return;
    autoScrolling.current = true;
    smoothNext.current = true;
    listRef.current?.scrollToEnd({ animated: true });
    // Released when the scroll reaches the bottom (handleScroll), or after
    // this long whatever happened - a finger may have stopped it.
    const release = setTimeout(() => (autoScrolling.current = false), 800);
    return () => clearTimeout(release);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId, busy]);

  /* An answer keeps growing after it lands - the analysis, badges and footer
   * arrive with `final`, seconds later - and streaming text arrives many
   * times a second. While the reader is following, follow all of it. The web
   * needed a ResizeObserver on the last message and a per-token effect for
   * this; a native list reports every change in its content height, which
   * covers both. Coalesced to one jump per frame: tokens can land several to
   * a frame. Smooth only straight after a new message - animating per token
   * would queue an animation each time and visibly lag the text. */
  const followFrame = useRef(0);
  function handleContentSizeChange(_w: number, h: number) {
    metrics.current.content = h;
    if (restorePlace(h)) return;
    if (!stickToBottom.current || followFrame.current) return;
    followFrame.current = requestAnimationFrame(() => {
      followFrame.current = 0;
      if (!stickToBottom.current) return;
      const animated = smoothNext.current;
      smoothNext.current = false;
      listRef.current?.scrollToEnd({ animated });
    });
  }
  useEffect(() => () => cancelAnimationFrame(followFrame.current), []);

  // A phone's new chat: the companion above the greeting. While the history
  // loads the greeting is laid out but invisible, so the companion is
  // already where it will stay and nothing moves when the greeting appears.
  // The web's chat-empty drops the companion when the space is too short for
  // both - the keyboard open on a small phone; here the height is measured.
  const [emptyHeight, setEmptyHeight] = useState<number | null>(null);
  const phoneEmpty = (greeting: boolean) => (
    <View style={s.empty} onLayout={(e: LayoutChangeEvent) => setEmptyHeight(e.nativeEvent.layout.height)}>
      {(emptyHeight === null || emptyHeight >= px(300)) && <View style={s.emptyAvatar}>{emptyStateAvatar}</View>}
      <View
        style={greeting ? undefined : s.invisible}
        accessibilityElementsHidden={!greeting}
        importantForAccessibility={greeting ? "auto" : "no-hide-descendants"}
      >
        {emptyState}
      </View>
    </View>
  );

  if (loading) {
    if (phone) return phoneEmpty(false);
    return (
      <View style={s.loadingWide}>
        {emptyStateAvatar}
        <View style={{ marginTop: space(4) }}>
          <ThinkingIndicator label="Opening the chat" />
        </View>
      </View>
    );
  }

  if (messages.length === 0 && !streaming && !busy) {
    if (phone) return phoneEmpty(true);
    // A greeting is not a paragraph, it is the room acknowledging you walked
    // in. The space is kept either way so the composer sits on the centre
    // line.
    return <View style={s.emptyWide}>{emptyState}</View>;
  }

  const rows: Row[] = messages.map((m) => ({ key: m.id, kind: "message", message: m }));
  /* Generation happens under the hood. Until the gist lands, the whole wait
     is the rabbit; the body text that streams in meanwhile is accumulated
     (so cancelling mid-way still has it) but never shown token by token -
     the finished answer replaces this all at once. */
  if (streaming?.safety) rows.push({ key: "streaming-safety", kind: "streaming-safety", card: streaming.safety });
  if (busy && !streamingLead) rows.push({ key: "thinking", kind: "thinking" });
  // The bubble appears as soon as there is a gist to show - the gist is the
  // first thing read, and the rest is still being written behind it (the
  // rabbit says so, under the card).
  if (streaming && streamingLead) rows.push({ key: "streaming", kind: "streaming", streaming });

  function renderRow({ item }: { item: Row }) {
    if (item.kind === "streaming-safety") return <SafetyCard card={item.card} />;
    if (item.kind === "thinking") {
      return (
        <View style={s.thinkingRow}>
          <View style={s.thinkingBubble}>
            <ThinkingIndicator label={thinkingLabel} />
          </View>
        </View>
      );
    }
    if (item.kind === "streaming") {
      const st = item.streaming;
      return (
        <ErrorBoundary where="streaming-answer" label="This answer couldn't be shown.">
          <MessageBubble
            id="streaming"
            role="assistant"
            content={st.content}
            modeUsed={st.mode_used}
            confidenceScore={null}
            confidenceBand={null}
            claims={[]}
            crux={st.crux ?? null}
            decisionReview={st.decisionReview ?? null}
            generatedImage={st.generatedImage ?? null}
            makingImage={st.makingImage ?? false}
            thinkingReview={st.thinkingReview ?? null}
            isStreaming
            openFully={st.safety?.level === "crisis"}
          />
        </ErrorBoundary>
      );
    }
    const m = item.message;
    return (
      <ErrorBoundary
        where="message"
        label={m.role === "user" ? "This message couldn't be shown." : "This answer couldn't be shown."}
      >
        <View style={{ gap: space(5) }}>
          {m.role === "assistant" && m.safety && <SafetyCard card={m.safety} />}
          <MessageBubble
            id={m.id}
            role={m.role}
            content={m.content ?? ""}
            modeUsed={m.mode_used}
            confidenceScore={m.confidence_score}
            confidenceBand={m.confidence_band}
            claims={m.claims}
            crux={m.crux_text}
            createdAt={m.created_at}
            counterfactual={m.counterfactual_content}
            clarifier={m.clarifier}
            guidance={m.guidance}
            decisionReview={m.decision_review}
            generatedImage={m.generated_image}
            thinkingReview={m.thinking_review}
            feedback={m.feedback}
            siblingIndex={m.sibling_index}
            siblingCount={m.sibling_count}
            siblingIds={m.sibling_ids}
            onSwitchBranch={onSwitchBranch}
            isPlaying={playingMessageId === m.id}
            onPlayAudio={
              onPlayAudio
                ? () => {
                    track("answer_listened");
                    onPlayAudio(m.id, m.content ?? "");
                  }
                : undefined
            }
            isValidating={validatingId === m.id}
            canEdit={m.role === "user" && Boolean(onSubmitEdit)}
            onRegenerate={m.role === "assistant" && onRegenerate ? () => onRegenerate(m.id) : undefined}
            onDelete={onDeleteMessage ? () => onDeleteMessage(m.id) : undefined}
            busy={busy}
            conversationId={conversationId}
            onClarifierAnswer={onClarifierAnswer}
            onUseMode={onUseMode}
            onAskRefined={onAskRefined}
            onSubmitEdit={onSubmitEdit}
            openFully={m.safety?.level === "crisis"}
          />
        </View>
      </ErrorBoundary>
    );
  }

  return (
    // The wrapper holds the jump button over the thread; it takes the flex
    // slot the thread used to, so the layout is the same.
    <Animated.View entering={FadeIn.duration(350)} style={s.wrap} testID="message-list">
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        ItemSeparatorComponent={RowGap}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onLayout={(e) => (metrics.current.layout = e.nativeEvent.layout.height)}
        onContentSizeChange={handleContentSizeChange}
        // A finger is the reader, never our own smooth scroll.
        onScrollBeginDrag={() => (autoScrolling.current = false)}
        // Rows vary wildly in height and the place restore and the follow
        // both need real measurements, so a normal-length chat is rendered
        // whole rather than estimated.
        initialNumToRender={Math.min(rows.length, 40)}
        windowSize={11}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={s.list}
        // paddingBottom: room for the companion, which floats over the end of
        // the thread on a phone (ChatView), so the last line can scroll clear.
        contentContainerStyle={s.listContent}
      />
      {phone && showJump && (
        <Animated.View entering={FadeIn.duration(200)} style={s.jumpWrap} pointerEvents="box-none">
          <Pressable
            onPress={jumpToLatest}
            accessibilityRole="button"
            accessibilityLabel="Jump to the latest message"
            hitSlop={4}
            style={({ pressed }) => [s.jump, pressed && { backgroundColor: colors.surfaceHover }]}
          >
            <Svg viewBox="0 0 24 24" width={px(20)} height={px(20)} fill="none" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 5v14M6 13l6 6 6-6" />
            </Svg>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** The web's space-y-5 between messages. */
function RowGap() {
  return <View style={{ height: space(5) }} />;
}

const listStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { flex: 1, minHeight: 0 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: space(1), paddingTop: space(5), paddingBottom: space(20) },
    empty: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", overflow: "hidden", paddingHorizontal: space(4) },
    emptyAvatar: { marginBottom: space(3) },
    invisible: { opacity: 0 },
    loadingWide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space(4), paddingVertical: space(16) },
    emptyWide: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: space(4) },
    thinkingRow: { flexDirection: "row", justifyContent: "flex-start" },
    thinkingBubble: {
      borderRadius: radius["2xl"],
      borderBottomLeftRadius: radius.md,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      paddingHorizontal: space(4),
      paddingVertical: space(3),
    },
    jumpWrap: { position: "absolute", bottom: space(3), left: 0, right: 0, alignItems: "center", zIndex: 10 },
    jump: {
      width: px(40),
      height: px(40),
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  });

/** "10:04" for anything from today, "8 Sept, 10:04" otherwise. Conversations
 *  here run across days, and a bare time on a message from last week read as
 *  if it were from today - the date is only dropped when it would be
 *  redundant. Same shape as WorkspaceDetail's shortDate for older rows. */
function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return time;
  const date = d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  return `${date}, ${time}`;
}

/** The tier (`entailment_label`) and score belong to the CLAIM the marker's
 *  evidence sits inside, not to the evidence item itself - a claim can cite
 *  several sources, and the tier is a verdict on the claim as a whole. */
function findEvidenceForMarker(
  claims: Claim[],
  marker: number,
): { evidence: Evidence; claimScore: number | null; entailmentLabel: string | null } | null {
  for (const claim of claims) {
    const found = claim.evidence.find((e) => e.citation_marker === marker);
    if (found) {
      return { evidence: found, claimScore: claim.claim_score, entailmentLabel: claim.entailment_label };
    }
  }
  return null;
}

/** Citation markers become popovers, and the light formatting (bold,
 *  italic, code) renders around them - the formatting is split first so a
 *  marker inside a bold run still gets its pill. Everything returned here
 *  sits inside a <Text>, so the pills are inline in the running text. */
function renderCitations(text: string, claims: Claim[], keyPrefix: string): ReactNode[] {
  return renderInline(text, keyPrefix, (leaf, key) => renderMarkers(leaf, claims, key));
}

function renderMarkers(text: string, claims: Claim[], keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return <Text key={`${keyPrefix}-${i}`}>{part}</Text>;
    const marker = parseInt(match[1], 10);
    const found = findEvidenceForMarker(claims, marker);
    return (
      <CitationPopover
        key={`${keyPrefix}-${i}`}
        marker={marker}
        evidence={found?.evidence ?? null}
        claimScore={found?.claimScore ?? null}
        entailmentLabel={found?.entailmentLabel ?? null}
      />
    );
  });
}

/** Citation markers become popovers; sentences the model tagged as its own
 *  opinion get an inline "opinion" tag after them. Opinions have no citation
 *  by definition, so this tag is the only thing that distinguishes them from
 *  sourced text now that the evidence panel is gone. Located by matching the
 *  claim's text inside the prose - the claim text is lifted from that same
 *  prose, so an exact match is the normal case; a claim that doesn't match
 *  (reflection reworded it) simply goes untagged rather than mis-tagged. */
function renderTextWithCitations(text: string, claims: Claim[]): ReactNode[] {
  // Messages written before the backend stripped markup still have it stored.
  const clean = cleanMessageText(text);
  const cuts: number[] = [];
  for (const claim of claims) {
    if (claim.entailment_label !== "opinion") continue;
    const needle = cleanMessageText(claim.claim_text).trim();
    if (needle.length < 8) continue;
    const at = clean.indexOf(needle);
    if (at !== -1) cuts.push(at + needle.length);
  }
  if (cuts.length === 0) return renderCitations(clean, claims, "t");

  const out: ReactNode[] = [];
  let from = 0;
  for (const [n, cut] of [...new Set(cuts)].sort((a, b) => a - b).entries()) {
    out.push(...renderCitations(clean.slice(from, cut), claims, `s${n}`));
    out.push(<OpinionMarker key={`op${n}`} />);
    from = cut;
  }
  out.push(...renderCitations(clean.slice(from), claims, "tail"));
  return out;
}

/* The body of an answer: paragraphs, lists and comparison tables (see
 * lib/markdown for the set and the splitter), each run of text going
 * through the citation-and-opinion renderer. A comparison the model wrote
 * as pipe rows becomes a real table - a grid of cells in a sideways
 * scroller, since a phone is rarely wide enough for one - markers inside
 * the cells included. Every run of text is selectable, so a passage can be
 * copied out of an answer the way it could on the web. */
function AnswerBody({ text, claims }: { text: string; claims: Claim[] }) {
  const s = useThemedStyles(bodyStyles);
  const clean = cleanMessageText(text);
  const blocks = splitBlocks(clean);
  if (blocks.length === 1 && blocks[0].kind === "text") {
    return (
      <Text selectable style={s.text}>
        {renderTextWithCitations(clean, claims)}
      </Text>
    );
  }
  return (
    <View>
      {blocks.map((block, n) => {
        if (block.kind === "text") {
          // A paragraph between blocks keeps its own blank lines, as
          // whitespace-pre-wrap did; an empty one is just the gap.
          if (!block.text.trim()) return null;
          return (
            <Text key={`b${n}`} selectable style={s.text}>
              {renderTextWithCitations(block.text.replace(/^\n+|\n+$/g, ""), claims)}
            </Text>
          );
        }
        if (block.kind === "list") {
          return (
            <View key={`b${n}`} style={s.list}>
              {block.items.map((item, i) => (
                <View key={i} style={s.listItem}>
                  <Text style={[s.text, s.listMarker]}>{block.ordered ? `${i + 1}.` : "•"}</Text>
                  <Text selectable style={[s.text, s.listText]}>
                    {renderTextWithCitations(item, claims)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        const columns = block.rows[0].length;
        // No table layout natively: each column is sized from its longest
        // cell, within bounds, so the grid lines up and long cells wrap.
        const widths = Array.from({ length: columns }, (_, c) => {
          const longest = Math.max(...block.rows.map((row) => (row[c] ?? "").length));
          return Math.max(px(80), Math.min(px(240), longest * px(8) + space(4)));
        });
        return (
          <ScrollView key={`b${n}`} horizontal showsHorizontalScrollIndicator={false} style={s.tableScroll}>
            <View>
              <View style={[s.tableRow, s.tableHeadRow]}>
                {block.rows[0].map((cell, c) => (
                  <Text key={c} selectable style={[s.cell, s.headCell, { width: widths[c] }]}>
                    {renderCitations(cell, claims, `h${n}-${c}`)}
                  </Text>
                ))}
              </View>
              {block.rows.slice(1).map((row, r, body) => (
                <View key={r} style={[s.tableRow, r < body.length - 1 && s.tableBodyRow]}>
                  {Array.from({ length: columns }, (_, c) => (
                    <Text key={c} selectable style={[s.cell, s.bodyCell, { width: widths[c] }]}>
                      {renderCitations(row[c] ?? "", claims, `c${n}-${r}-${c}`)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        );
      })}
    </View>
  );
}

const bodyStyles = (c: Colors) =>
  StyleSheet.create({
    // The same step the question above it is set in. The card's own chrome -
    // the mode, the band, the actions - stays small; it is the answer that
    // has to be as readable as the thing it is answering.
    text: { fontFamily: fonts.regular, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.625, color: c.ink },
    list: { marginVertical: space(1.5), gap: space(1) },
    listItem: { flexDirection: "row" },
    listMarker: { width: space(5), textAlign: "left" },
    listText: { flex: 1 },
    tableScroll: { marginVertical: space(2) },
    tableRow: { flexDirection: "row" },
    tableHeadRow: { borderBottomWidth: 1, borderBottomColor: c.hairlineStrong },
    tableBodyRow: { borderBottomWidth: 1, borderBottomColor: c.hairline },
    cell: { paddingHorizontal: space(2), paddingVertical: space(1.5), fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.4 },
    headCell: { fontFamily: fonts.semibold, color: c.ink },
    bodyCell: { fontFamily: fonts.regular, color: c.inkSecondary },
  });

/* A user message can carry one or more pre-answer exchanges inside it: the
 * composer embeds each gate Clardentity raised (a context question, a
 * "did you mean", a clarifying choice) as
 *   <original>\n\n(Clardentity asked: "<question>")\n<answer>
 * so the whole turn is one message for the model and for edit/resend. That
 * raw form is kept for both; only the rendering unpicks it, into the original
 * question followed by a small two-sided thread - Clardentity's question on
 * the left, the reply on the right - the way a quoted exchange reads in a
 * messaging app. */
const ASKED_RE = /\n\n\(Clardentity asked: "([\s\S]*?)"\)\n/g;

type Exchange = { question: string; answer: string };

function parseUserMessage(content: string): { head: string; exchanges: Exchange[] } {
  const exchanges: Exchange[] = [];
  let head = content;
  let match: RegExpExecArray | null;
  let cursor = 0;
  let pendingQuestion: string | null = null;
  ASKED_RE.lastIndex = 0;
  while ((match = ASKED_RE.exec(content)) !== null) {
    const before = content.slice(cursor, match.index);
    if (pendingQuestion === null) head = before;
    else exchanges.push({ question: pendingQuestion, answer: before.trim() });
    pendingQuestion = match[1];
    cursor = match.index + match[0].length;
  }
  if (pendingQuestion !== null) {
    exchanges.push({ question: pendingQuestion, answer: content.slice(cursor).trim() });
  }
  return { head, exchanges };
}

function UserMessageBody({ content }: { content: string }) {
  const s = useThemedStyles(userBodyStyles);
  const { head, exchanges } = parseUserMessage(content);
  if (exchanges.length === 0) {
    return <Text style={s.text}>{content}</Text>;
  }
  // The exchange colours are the web's own fixed tints (black/15, white/15,
  // white, brand), not palette tokens.
  return (
    <View>
      <Text style={s.text}>{head}</Text>
      <View style={s.thread}>
        {exchanges.map((x, i) => (
          <View key={i} style={{ gap: space(1.5) }}>
            <View style={s.left}>
              <View style={s.theirs}>
                <Text style={[s.label, { color: "rgba(255,255,255,0.7)" }]}>Clardentity</Text>
                <Text style={s.small}>{x.question}</Text>
              </View>
            </View>
            {x.answer ? (
              <View style={s.right}>
                <View style={s.mine}>
                  <Text style={[s.label, s.mineLabel]}>You</Text>
                  <Text style={[s.small, s.mineText]}>{x.answer}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const userBodyStyles = (c: Colors) =>
  StyleSheet.create({
    // Grey, not burgundy, and the same 20px the composer types at.
    text: { fontFamily: fonts.regular, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.625, color: c.ink },
    thread: { marginTop: space(2), gap: space(1.5), borderRadius: radius.xl, backgroundColor: "rgba(0,0,0,0.15)", padding: space(1.5) },
    left: { flexDirection: "row", justifyContent: "flex-start" },
    right: { flexDirection: "row", justifyContent: "flex-end" },
    theirs: {
      maxWidth: "88%",
      borderRadius: radius.xl,
      borderBottomLeftRadius: radius.sm,
      backgroundColor: "rgba(255,255,255,0.15)",
      paddingHorizontal: space(2.5),
      paddingVertical: space(1.5),
    },
    mine: {
      maxWidth: "88%",
      borderRadius: radius.xl,
      borderBottomRightRadius: radius.sm,
      backgroundColor: "#ffffff",
      paddingHorizontal: space(2.5),
      paddingVertical: space(1.5),
    },
    label: { marginBottom: space(0.5), fontFamily: fonts.semibold, fontSize: fontSize.xs, textTransform: "uppercase", letterSpacing: 0.4 },
    mineLabel: { color: c.brand, opacity: 0.7 },
    small: { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.375, color: c.ink },
    mineText: { color: c.brand },
  });

function MessageBubble({
  id,
  role,
  content,
  modeUsed,
  confidenceScore,
  confidenceBand,
  claims,
  crux,
  createdAt,
  counterfactual,
  clarifier,
  guidance,
  decisionReview,
  thinkingReview,
  generatedImage,
  makingImage,
  feedback,
  siblingIndex,
  siblingCount,
  siblingIds,
  onSwitchBranch,
  isStreaming,
  isPlaying,
  onPlayAudio,
  isValidating,
  canEdit,
  onRegenerate,
  onDelete,
  busy,
  conversationId,
  onClarifierAnswer,
  onUseMode,
  onAskRefined,
  onSubmitEdit,
  openFully = false,
}: {
  id: string;
  role: string;
  content: string;
  modeUsed: string;
  confidenceScore: number | null;
  confidenceBand: string | null;
  claims: Claim[];
  /** The model's own one-sentence bottom line. Null for messages generated
   *  before this shipped, and always absent while still streaming. */
  crux?: string | null;
  /** Absent for the synthetic streaming bubble, which isn't a real message
   *  yet - it gets a real one once `onAnswer` replaces it. */
  createdAt?: string;
  counterfactual?: string | null;
  clarifier?: { question: string; options: string[] } | null;
  guidance?: Guidance | null;
  decisionReview?: DecisionReviewData | null;
  thinkingReview?: ThinkingReviewData | null;
  generatedImage?: GeneratedImage | null;
  makingImage?: boolean;
  feedback?: { rating: "up" | "down" | null; comment: string | null } | null;
  /** This message's position among its siblings, and how many there are -
   *  1 sibling means there's nothing to switch between. */
  siblingIndex?: number;
  siblingCount?: number;
  siblingIds?: string[];
  onSwitchBranch?: (messageId: string) => void;
  isStreaming?: boolean;
  isPlaying?: boolean;
  onPlayAudio?: () => void;
  isValidating?: boolean;
  canEdit?: boolean;
  onRegenerate?: () => void;
  /** Permanently deletes this message and everything after it. */
  onDelete?: () => void;
  busy?: boolean;
  conversationId?: string;
  onClarifierAnswer?: (answer: string) => void;
  onUseMode?: (mode: string) => void;
  onAskRefined?: (question: string) => void;
  onSubmitEdit?: (messageId: string, content: string) => void;
  /** Show the whole answer, not just the gist: a reply to someone who may
   *  be in danger asks whether they are safe below its first line, and that
   *  must not wait behind a "Show full answer" they may never press. */
  openFully?: boolean;
}) {
  const s = useThemedStyles(bubbleStyles);
  const colors = useColors();
  const isUser = role === "user";

  /* Whether a confidence verdict is meaningful for this answer.
   *
   * The band measures how well claims are grounded in cited sources. In
   * Knowing that is the entire job, so it is always shown - including when
   * nothing supported the answer, which is exactly when the reader most needs
   * telling.
   *
   * The other three modes produce reasoning, recommendations and
   * explanations. A Thinking answer with nothing cited is not dubious, it is
   * a chain of reasoning, and stamping "Needs Verification" on it reports an
   * absence that was never a fault - the same category error as calling an
   * uncited claim "Fabricated". So outside Knowing the verdict appears only
   * once the answer actually rested on a source, where it is a real
   * statement about real evidence. */
  const citedAnything = claims.some((c) => c.evidence.length > 0);

  /* Which panel belongs under this answer.
   *
   * Thinking and Decision don't produce claims worth citing. A reasoning
   * chain is sound or unsound, not sourced or unsourced; a recommendation is
   * a judgement, not a fact with a footnote. Showing them an evidence panel
   * reported an absence that was never a fault, so each gets the panel that
   * actually says something about its own output - the reasoning contrast,
   * and the decisions worth considering. Knowing and Learning keep the
   * evidence, which is the whole point of those two. */
  const panel =
    modeUsed === "thinking" ? "thinking" : modeUsed === "decision" ? "decision" : "evidence";
  const verdictIsMeaningful =
    panel === "evidence" && (modeUsed === "knowing" || citedAnything);
  // Whether the crux exists at all decides whether there's a fold in the
  // first place - a message with no crux (written before this shipped, or a
  // stream whose gist hasn't landed yet) just renders the answer flat. While
  // streaming, the gist arrives as its own event before any body text, so
  // the fold exists from the first token: the body writes itself in behind
  // it rather than scrolling past the reader first.
  const hasCrux = !isUser && Boolean(crux);
  // Collapsed by default, even the first time this message is seen: the
  // whole point of the crux is to make reading the full answer optional,
  // not to show it in full anyway and add a summary on top.
  const [detailOpen, setDetailOpen] = useState(openFully);
  // Named for what's actually behind the fold in Thinking/Decision mode -
  // the box above it already carries the verdict, so what's hidden is the
  // reasoning trail that produced it, not "the answer" (the box already is
  // one). Other modes keep the generic wording, since there's no separate
  // verdict box for the fold to be "more detail than".
  const detailLabels =
    panel === "thinking"
      ? { show: "Details of thinking journey", hide: "Hide details of thinking journey" }
      : panel === "decision"
        ? {
            show: "Details of the decision making journey",
            hide: "Hide details of the decision making journey",
          }
        : { show: "Show full answer", hide: "Hide full answer" };
  // The Devil's Draft now lives on the back of this bubble rather than in a
  // panel beneath it, so its state belongs to the bubble.
  const devil = useCounterfactual({ conversationId, messageId: id, preloaded: counterfactual });
  // Editing happens inside the bubble. The previous version rewound the
  // conversation the moment you clicked edit and dropped the text into the
  // composer - so the rest of the chat disappeared before you had typed
  // anything, and cancelling was impossible because it was already gone.
  // Nothing is destroyed now until you actually submit.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  // Your own message's Copy / Edit / Delete. The web reveals them on hover;
  // a phone has no hover, so a long press on the bubble shows them (and
  // another hides them). An answer's row is always there, as on the web.
  const [ownActions, setOwnActions] = useState(false);

  function submitEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === content) {
      setEditing(false);
      return;
    }
    setEditing(false);
    onSubmitEdit?.(id, trimmed);
  }

  const bubble = (
    <View style={isUser ? s.mine : s.theirs}>
      {!isUser && (
        <View style={s.header}>
          {/* Mode only. The reasoning lens the agent picked is deliberately
              never surfaced - it is an internal choice about how to think,
              and naming it ("critical", "non-linear") asked the reader to
              hold a vocabulary that was only ever meant for the model. The
              band badge beside it has to stay on one line, so when the row
              runs out of width it is the mode name that gives way. */}
          <Text numberOfLines={1} style={s.modeLabel}>
            {modeLabel(modeUsed)}
          </Text>
          <View style={s.headerActions}>
            {/* Only when there is a back to turn to: either one already
                generated with the answer, or a conversation the fetch can
                ask. Without both - the landing page's guest demo - the
                button flipped the card to a blank face. */}
            {!isStreaming && content && (counterfactual || conversationId) ? (
              <FlipButton
                flipped={devil.flipped}
                onClick={() => {
                  if (!devil.flipped) track("counterfactual_flipped");
                  devil.toggle();
                }}
              />
            ) : null}
            {onPlayAudio && content ? (
              <Pressable
                onPress={onPlayAudio}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? "Stop playback" : "Listen to this answer"}
                hitSlop={10}
                style={({ pressed }) => [s.iconButton, pressed && s.pressed]}
              >
                {({ pressed }) => (
                  <Svg
                    viewBox="0 0 24 24"
                    width={px(14)}
                    height={px(14)}
                    fill="none"
                    stroke={pressed ? colors.brand : colors.inkMuted}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {isPlaying ? (
                      <>
                        <Rect x="6" y="5" width="4" height="14" rx="1" />
                        <Rect x="14" y="5" width="4" height="14" rx="1" />
                      </>
                    ) : (
                      <>
                        <Path d="M11 5 6 9H2v6h4l5 4z" />
                        <Path d="M15.5 8.5a5 5 0 0 1 0 7" />
                      </>
                    )}
                  </Svg>
                )}
              </Pressable>
            ) : null}
            {confidenceBand && verdictIsMeaningful ? (
              <ConfidenceBadge band={confidenceBand} score={confidenceScore} claims={claims} />
            ) : null}
          </View>
        </View>
      )}
      {guidance && !isStreaming && (
        // Above the answer, not below it: this is a nudge about the
        // *question* ("did you mean...", "this fits a different mode
        // better") - the same place a search engine puts "Did you mean?",
        // since it's read before the answer it would have changed, not as
        // a footnote after.
        <GuidanceCard
          guidance={guidance}
          onUseMode={onUseMode ? (m: string) => onUseMode(m) : undefined}
          onAskRefined={onAskRefined}
          disabled={busy}
        />
      )}
      {/* The picture leads, when there is one: it is the answer to "draw
          me a logo", not an illustration of a paragraph. */}
      {!isUser && generatedImage && <GeneratedImageCard image={generatedImage} />}
      {!isUser && !generatedImage && makingImage && <GeneratedImagePlaceholder />}
      {/* Thought coach's box is the analysis itself and leads, above the
          gist: the reasoning contrast, then the one-line answer, then the
          journey folded beneath. */}
      {!isUser && panel === "thinking" && thinkingReview && <ThinkingReview review={thinkingReview} />}
      {/* Its slot, held while it is still being written, so that order is
          visible from the first frame rather than the box dropping in
          above things already read. */}
      {!isUser && isStreaming && panel === "thinking" && !thinkingReview && (
        <View style={s.slot}>
          <ThinkingIndicator compact label="Working out how to think about this" />
        </View>
      )}
      {hasCrux && <CruxCard text={crux as string} />}
      {/* Decision-making reads gist, then "One decision that's correct,
          and the ones that aren't", then the journey (2026-10-12; it used
          to lead with the box, as Thought coach still does). The box's
          slot is held under the gist while it is being written, for the
          same reason as above. */}
      {!isUser && panel === "decision" && decisionReview && <DecisionReview review={decisionReview} />}
      {!isUser && isStreaming && panel === "decision" && !decisionReview && (
        <View style={s.slot}>
          <ThinkingIndicator compact label="Weighing the decisions" />
        </View>
      )}
      {isStreaming && (hasCrux || decisionReview || thinkingReview) && (
        // The rest is still being written, out of sight. No fold yet -
        // there's nothing finished behind it to open. (While only the
        // box's held slot is showing, that slot carries the rabbit.)
        <ThinkingIndicator compact />
      )}
      {hasCrux && !isStreaming && (
        <Pressable
          onPress={() => setDetailOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: detailOpen }}
          style={({ pressed }) => [s.fold, pressed && s.pressed]}
        >
          <Svg
            viewBox="0 0 24 24"
            width={px(16)}
            height={px(16)}
            fill="none"
            stroke={colors.inkMuted}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={detailOpen ? { transform: [{ rotate: "90deg" }] } : undefined}
          >
            <Path d="m9 18 6-6-6-6" />
          </Svg>
          <Text style={s.foldText}>{detailOpen ? detailLabels.hide : detailLabels.show}</Text>
        </Pressable>
      )}
      {!isStreaming && (!hasCrux || detailOpen) && (
        <>
          {editing ? (
            <View>
              <TextInput
                value={draft}
                autoFocus
                multiline
                onChangeText={setDraft}
                placeholderTextColor={colors.inkMuted}
                style={s.editBox}
              />
              {/* No "Enter to resend, Esc to cancel" line: Return is the
                  new-line key on a phone keyboard, so the buttons are the
                  way out. */}
              <View style={s.editActions}>
                <Pressable
                  onPress={() => {
                    setDraft(content);
                    setEditing(false);
                  }}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [s.editCancel, pressed && s.pressed]}
                >
                  <Text style={s.editCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={submitEdit}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [s.editSubmit, pressed && { backgroundColor: colors.brandDark }]}
                >
                  <Text style={s.editSubmitText}>Resend</Text>
                </Pressable>
              </View>
            </View>
          ) : isUser ? (
            <UserMessageBody content={content} />
          ) : (
            // Only answers have a back. Wrapping your own messages in the flip
            // container gave them a second face they could never show.
            <ResponseFlip
              flipped={devil.flipped}
              text={devil.text}
              loading={devil.loading}
              error={devil.error}
              front={<AnswerBody text={content} claims={claims} />}
            />
          )}
          {!isUser && !isStreaming && !editing && <SourcesFooter claims={claims} />}

          {isValidating && (
            // The answer above is complete and saved. This says what is still
            // happening, so a message that gains a score a few seconds later
            // doesn't look like it changed on its own.
            <View style={s.validating}>
              <Spinner />
              <Text style={s.meta}>Checking claims…</Text>
            </View>
          )}
        </>
      )}

      {clarifier && !isStreaming && onClarifierAnswer && (
        <ClarifierCard
          question={clarifier.question}
          options={clarifier.options}
          onAnswer={onClarifierAnswer}
          disabled={busy}
        />
      )}

      {!isUser && !isStreaming && conversationId && (
        <FeedbackWidget conversationId={conversationId} messageId={id} feedback={feedback ?? null} />
      )}

      {!isUser && !isStreaming && conversationId && modeUsed === "creative" && (
        <ExportFileMenu conversationId={conversationId} messageId={id} />
      )}

      {!isStreaming && (siblingCount ?? 1) > 1 && siblingIds && onSwitchBranch && (
        <ForkSwitcher
          siblingIds={siblingIds}
          siblingIndex={siblingIndex ?? 0}
          onSwitchBranch={onSwitchBranch}
          side={isUser ? "mine" : "theirs"}
        />
      )}

      {!isStreaming && !editing && (!isUser || ownActions) && (
        <MessageActions
          content={content}
          onEdit={
            canEdit
              ? () => {
                  setDraft(content);
                  setEditing(true);
                  setOwnActions(false);
                }
              : undefined
          }
          onRegenerate={onRegenerate}
          onDelete={onDelete}
          busy={busy}
          side={isUser ? "mine" : "theirs"}
        />
      )}
      {!isStreaming && createdAt && (
        // Its own row, not folded into MessageActions: that row hides
        // itself on a user bubble until asked for, and a timestamp you have
        // to ask for isn't one you can glance at.
        <Text style={[s.time, isUser && { textAlign: "right" }]}>{formatMessageTime(createdAt)}</Text>
      )}
    </View>
  );

  return (
    <View testID="message" style={[s.row, { justifyContent: isUser ? "flex-end" : "flex-start" }]}>
      {isUser ? (
        <Pressable
          onLongPress={
            editing
              ? undefined
              : () => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setOwnActions((v) => !v);
                }
          }
          accessibilityHint={editing ? undefined : "Long press for copy, edit and delete"}
          style={s.mineWrap}
        >
          {bubble}
        </Pressable>
      ) : (
        bubble
      )}
    </View>
  );
}

const bubbleStyles = (c: Colors) =>
  StyleSheet.create({
    row: { flexDirection: "row" },
    // Grey, not burgundy, and the same 20px the composer types at: the
    // design gives your own message a step off the canvas and keeps the
    // brand for the one control you press.
    mineWrap: { maxWidth: "78%" },
    mine: {
      borderRadius: px(12),
      backgroundColor: c.bubbleMine,
      paddingHorizontal: px(23),
      paddingVertical: px(11),
    },
    theirs: {
      width: "100%",
      maxWidth: "88%",
      borderRadius: radius["2xl"],
      borderBottomLeftRadius: radius.md,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      paddingHorizontal: space(4),
      paddingVertical: space(3),
    },
    header: { marginBottom: space(2), flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(2) },
    modeLabel: {
      flexShrink: 1,
      minWidth: 0,
      fontFamily: fonts.semibold,
      fontSize: fontSize.xs,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: c.inkMuted,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
    iconButton: { borderRadius: radius.md, padding: space(1) },
    pressed: { backgroundColor: c.surfaceHover },
    slot: {
      marginBottom: space(3),
      borderRadius: px(12),
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.hairlineStrong,
      padding: space(4),
    },
    fold: {
      marginHorizontal: -space(1),
      marginBottom: space(2),
      flexDirection: "row",
      alignItems: "center",
      gap: space(1.5),
      borderRadius: radius.md,
      paddingHorizontal: space(1),
      paddingVertical: space(1),
    },
    foldText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.inkMuted },
    editBox: {
      width: "100%",
      maxHeight: fontSize.xl * 1.25 * 8,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.hairlineStrong,
      backgroundColor: c.surface,
      paddingHorizontal: space(2),
      paddingVertical: space(1.5),
      fontFamily: fonts.regular,
      fontSize: fontSize.xl,
      color: c.ink,
      textAlignVertical: "top",
    },
    editActions: { marginTop: space(1.5), flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: space(2) },
    editCancel: { borderRadius: radius.md, paddingHorizontal: space(2), paddingVertical: space(0.5) },
    editCancelText: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkSecondary },
    editSubmit: { borderRadius: radius.md, backgroundColor: c.brand, paddingHorizontal: space(2), paddingVertical: space(0.5) },
    editSubmitText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: "#ffffff" },
    validating: { marginTop: space(2), flexDirection: "row", alignItems: "center", gap: space(1.5) },
    meta: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted },
    time: { marginTop: space(1), fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted, fontVariant: ["tabular-nums"] },
  });

/** "< 2/3 >" - move between sibling versions of this exact message: other
 *  answers to the same question (regenerate), or other wordings of the
 *  question itself (edit). Always visible once there's more than one, the
 *  same way a chat client's own version switcher never hides - it's the only
 *  way back to something regenerating or editing would otherwise bury. */
function ForkSwitcher({
  siblingIds,
  siblingIndex,
  onSwitchBranch,
  side,
}: {
  siblingIds: string[];
  siblingIndex: number;
  onSwitchBranch: (messageId: string) => void;
  /** Whose message this row belongs to. It no longer changes the colours -
   *  the bubble is grey now - only where the row sits. */
  side: "mine" | "theirs";
}) {
  const s = useThemedStyles(actionStyles);
  const count = siblingIds.length;
  const atFirst = siblingIndex <= 0;
  const atLast = siblingIndex >= count - 1;

  return (
    <View style={[s.fork, side === "mine" && { justifyContent: "flex-end" }]}>
      <Pressable
        onPress={() => onSwitchBranch(siblingIds[siblingIndex - 1])}
        disabled={atFirst}
        accessibilityRole="button"
        accessibilityLabel="Previous version"
        hitSlop={12}
        style={({ pressed }) => [s.forkButton, pressed && s.pressed, atFirst && { opacity: 0.3 }]}
      >
        <ChevronIcon direction="left" />
      </Pressable>
      <Text style={s.forkCount}>
        {siblingIndex + 1}/{count}
      </Text>
      <Pressable
        onPress={() => onSwitchBranch(siblingIds[siblingIndex + 1])}
        disabled={atLast}
        accessibilityRole="button"
        accessibilityLabel="Next version"
        hitSlop={12}
        style={({ pressed }) => [s.forkButton, pressed && s.pressed, atLast && { opacity: 0.3 }]}
      >
        <ChevronIcon direction="right" />
      </Pressable>
    </View>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  const colors = useColors();
  return (
    <Svg viewBox="0 0 24 24" width={px(12)} height={px(12)} fill="none" stroke={colors.inkMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 6 6 6-6 6"} />
    </Svg>
  );
}

/** Copy / edit / regenerate / delete. Edit belongs to your messages,
 *  regenerate to its answers. Under an answer the row is always there; under
 *  your own message it appears on a long press (see MessageBubble). */
function MessageActions({
  content,
  onEdit,
  onRegenerate,
  onDelete,
  busy,
  side,
}: {
  content: string;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
  busy?: boolean;
  /** Whose message this row belongs to. It no longer changes the colours -
   *  the bubble is grey now - only where the row sits. */
  side: "mine" | "theirs";
}) {
  const s = useThemedStyles(actionStyles);
  const [copied, setCopied] = useState(false);

  if (!content) return null;

  async function copy() {
    try {
      // What was on screen, not what was on the wire. Citation markers point
      // at a numbered source list that isn't coming with the text, so they
      // paste as meaningless "[2]"s into whatever the reader is writing.
      const plain = cleanMessageText(content).replace(/\s*\[\d+\]/g, "");
      await Clipboard.setStringAsync(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail; silently leaving the icon unchanged is
      // better than an error for something this small.
    }
  }

  // The web asks with a second click ("Sure?"); natively the system dialog
  // is the confirmation people expect for something this permanent.
  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(
      "Delete this message?",
      "This message and everything after it will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ],
    );
  }

  return (
    <View
      style={[
        s.actions,
        // An answer's actions stay visible, as on the web - at the web's
        // resting opacity, which a hover raised there.
        side === "mine" ? { justifyContent: "flex-end" } : { opacity: 0.45 },
      ]}
    >
      <ActionButton onPress={copy} label={copied ? "Copied" : "Copy message"}>
        {copied ? <TickIcon /> : <CopyIcon />}
      </ActionButton>
      {onEdit && (
        <ActionButton onPress={onEdit} disabled={busy} label="Edit and resend">
          <PencilIcon />
        </ActionButton>
      )}
      {onRegenerate && (
        <ActionButton
          onPress={() => {
            track("answer_regenerated");
            onRegenerate();
          }}
          disabled={busy}
          label="Regenerate this answer"
        >
          <RedoIcon />
        </ActionButton>
      )}
      {onDelete && (
        <ActionButton onPress={confirmDelete} disabled={busy} label="Delete this message and everything after it">
          <TrashIcon />
        </ActionButton>
      )}
    </View>
  );
}

function ActionButton({
  onPress,
  disabled,
  label,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  const s = useThemedStyles(actionStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [s.actionButton, pressed && s.pressed, disabled && { opacity: 0.4 }]}
    >
      {children}
    </Pressable>
  );
}

const actionStyles = (c: Colors) =>
  StyleSheet.create({
    fork: { marginTop: space(1.5), flexDirection: "row", alignItems: "center", gap: space(0.5) },
    forkButton: { borderRadius: radius.md, padding: space(0.5) },
    forkCount: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted, fontVariant: ["tabular-nums"] },
    actions: { marginTop: space(2), flexDirection: "row", alignItems: "center", gap: space(2) },
    actionButton: { borderRadius: radius.md, padding: space(1) },
    pressed: { backgroundColor: c.surfaceHover },
  });

function ActionIcon({ children }: { children: ReactNode }) {
  const colors = useColors();
  return (
    <Svg
      viewBox="0 0 24 24"
      width={px(14)}
      height={px(14)}
      fill="none"
      stroke={colors.inkMuted}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

const CopyIcon = () => (
  <ActionIcon>
    <Rect x="9" y="9" width="11" height="11" rx="2" />
    <Path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </ActionIcon>
);

const TickIcon = () => (
  <ActionIcon>
    <Path d="m5 13 4 4L19 7" />
  </ActionIcon>
);

const PencilIcon = () => (
  <ActionIcon>
    <Path d="M12 20h9" />
    <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </ActionIcon>
);

const RedoIcon = () => (
  <ActionIcon>
    <Path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <Path d="M21 4v5h-5" />
  </ActionIcon>
);

const TrashIcon = () => (
  <ActionIcon>
    <Path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </ActionIcon>
);
