import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import type { ChatMessage } from "@/lib/sse";
import { MODE_BY_VALUE, type CognitiveMode } from "@/lib/modes";
import { fonts, fontSize, px, space, useThemedStyles, type Colors } from "@/lib/theme";

/* A conversation that switched modes is really several conversations
 * interleaved: the Decision turns and the Learning turns are about the same
 * subject but are not answering each other, and reading them as one column
 * makes the reasoning look like it contradicts itself.
 *
 * So each mode gets its own track. One is in focus; the others sit either
 * side, one swipe away.
 *
 * The trade-off worth naming: this hides messages. A linear transcript is the
 * only view where "what was said, in order" is answerable at a glance, so the
 * carousel is opt-in (the pills in the header) and never appears at all
 * until a second mode actually shows up.
 *
 * On the web the track was a translated flex row driven by pointer drags,
 * horizontal wheel and the arrow keys. Here it is a paging ScrollView: the
 * platform's own swipe, momentum and edge bounce, with the vertical message
 * lists inside it scrolling on the other axis. Tracks are full width - the
 * web's peeking neighbours only appeared from sm up, and a phone is below
 * that.
 */

type Track = { mode: CognitiveMode; messages: ChatMessage[] };

export function groupByMode(messages: ChatMessage[]): Track[] {
  const order: CognitiveMode[] = [];
  const byMode = new Map<CognitiveMode, ChatMessage[]>();

  for (const message of messages) {
    const mode = message.mode_used as CognitiveMode;
    if (!MODE_BY_VALUE[mode]) continue;
    if (!byMode.has(mode)) {
      byMode.set(mode, []);
      // First appearance decides the order, so tracks don't reshuffle
      // underneath the reader as the conversation grows.
      order.push(mode);
    }
    byMode.get(mode)!.push(message);
  }

  return order.map((mode) => ({ mode, messages: byMode.get(mode)! }));
}

function StepButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const s = useThemedStyles(styles);
  const label = direction === "previous" ? "Previous mode" : "Next mode";
  return (
    <Pressable
      onPress={onClick}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={10}
      style={({ pressed }) => [
        s.step,
        pressed && { backgroundColor: s.colors.surfaceHover },
        // Kept in the layout when unavailable rather than removed, so the
        // label doesn't shift sideways as you reach the ends.
        disabled && { opacity: 0.25 },
      ]}
    >
      <Svg viewBox="0 0 24 24" width={px(14)} height={px(14)} fill="none">
        <Path
          d={direction === "previous" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
          stroke={s.colors.inkMuted}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

export function ModeCarousel({
  tracks,
  activeIndex,
  onActiveIndexChange,
  renderMessages,
}: {
  tracks: Track[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  // The mode comes with the messages so the caller can decide which track a
  // streaming answer belongs in - it arrives while you may be reading a
  // different one.
  renderMessages: (messages: ChatMessage[], mode: CognitiveMode) => ReactNode;
}) {
  const s = useThemedStyles(styles);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  // The page width is the viewport's own, measured: nothing pages until it
  // is known, so the first frame doesn't open on the wrong track.
  const [width, setWidth] = useState(0);

  const clamp = (index: number) => Math.max(0, Math.min(tracks.length - 1, index));

  // The parent owns which track is in focus (it follows the composer's
  // mode); bring the pager to it whenever that changes.
  useEffect(() => {
    if (!width) return;
    scrollRef.current?.scrollTo({ x: activeIndex * width, animated: true });
  }, [activeIndex, width]);

  function onSettled(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    const index = clamp(Math.round(event.nativeEvent.contentOffset.x / width));
    if (index !== activeIndex) onActiveIndexChange(index);
  }

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      {/* Arrows either side of the current mode's name, and nothing else. A
          pill per mode meant the row grew with the conversation and put a
          filled accent-coloured chip above every answer; the name alone says
          where you are, and the arrows say there is more. */}
      <View accessibilityLabel="Modes in this chat" style={s.nav}>
        <StepButton
          direction="previous"
          disabled={activeIndex === 0}
          onClick={() => onActiveIndexChange(clamp(activeIndex - 1))}
        />
        <Text accessibilityLiveRegion="polite" style={s.label}>
          {MODE_BY_VALUE[tracks[activeIndex]?.mode]?.label}
          <Text style={s.count}>
            {"  "}
            {activeIndex + 1}/{tracks.length}
          </Text>
        </Text>
        <StepButton
          direction="next"
          disabled={activeIndex === tracks.length - 1}
          onClick={() => onActiveIndexChange(clamp(activeIndex + 1))}
        />
      </View>

      <View style={{ flex: 1, minHeight: 0 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentOffset={{ x: activeIndex * width, y: 0 }}
            onMomentumScrollEnd={onSettled}
            style={{ flex: 1 }}
          >
            {tracks.map((track, index) => {
              const isActive = index === activeIndex;
              return (
                <View
                  key={track.mode}
                  accessibilityElementsHidden={!isActive}
                  importantForAccessibility={isActive ? "auto" : "no-hide-descendants"}
                  // Dimmed, so a neighbour glimpsed mid-swipe reads as
                  // "another column" rather than competing with the one in
                  // focus. (The web also blurred it; there is no cheap blur
                  // for a live view here.)
                  style={[s.track, { width }, !isActive && { opacity: 0.2 }]}
                >
                  {/* No card around the track. The border, its rounding and
                      the repeated mode heading cost vertical space on a
                      column whose height is the scarce thing. The nav above
                      says which mode this is. */}
                  <View style={{ flex: 1, minHeight: 0 }}>{renderMessages(track.messages, track.mode)}</View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = (c: Colors) => ({
  colors: c,
  ...StyleSheet.create({
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2), paddingVertical: space(1.5) },
    step: { borderRadius: 9999, padding: space(1.5) },
    label: { minWidth: space(24), textAlign: "center", fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.inkSecondary },
    count: { fontFamily: fonts.regular, color: c.inkMuted, fontVariant: ["tabular-nums"] },
    track: { flex: 1, paddingHorizontal: space(1) },
  }),
});
