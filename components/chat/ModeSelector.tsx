import { useCallback, useEffect, useRef } from "react";
import { type LayoutChangeEvent, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";

import { COGNITIVE_MODES, type CognitiveMode } from "@/lib/modes";
import { useLockedModes } from "@/lib/previewAccess";
import { companionLabel, useCompanionNames } from "@/lib/companionNames";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { fonts, fontSize, px, radius, space, useThemedStyles, type Colors } from "@/lib/theme";
import { useScrollEdges } from "@/lib/useScrollEdges";
import { tourRef } from "@/components/tour/TourOverlay";

export { COGNITIVE_MODES };
export type { CognitiveMode };

/** Mode choice is deliberately explicit (SRS §7.2 - no auto-detection), so the
 *  control has to make the choice easy rather than merely available. Before a
 *  mode is picked it shows all seven with a plain-language "when to use this";
 *  afterwards it collapses to a compact segmented control so it stops
 *  competing with the conversation for attention.
 */
export function ModeSelector({
  value,
  onChange,
  disabled,
  onLocked,
  lockedModes: lockedOverride,
  folded = false,
  onUnfold,
  holdFocus = false,
}: {
  value: CognitiveMode | null;
  onChange: (mode: CognitiveMode) => void;
  disabled?: boolean;
  /** A "Soon" mode was tapped. When provided, those modes stay greyed but
   *  respond - opening the plans dialog - rather than being dead buttons that
   *  give no hint of what would unlock them. */
  onLocked?: (mode: CognitiveMode) => void;
  /** Overrides the account's own locks. The landing page's guest demo passes
   *  an empty list, because the lock is a fact about an account and a guest
   *  does not have one. */
  lockedModes?: readonly CognitiveMode[];
  /** Phone, while typing: the rail folds to one chip naming the current
   *  mode, giving the conversation back the rail's height above the
   *  keyboard. Tapping the chip calls `onUnfold`. */
  folded?: boolean;
  onUnfold?: () => void;
  /** Opened from the chip while typing: tapping a mode leaves the chat box
   *  focused, so the keyboard stays up. Natively that is the rail's
   *  keyboardShouldPersistTaps="handled", which is always on - kept for
   *  parity with the web's call sites. */
  holdFocus?: boolean;
}) {
  void holdFocus;
  const s = useThemedStyles(styles);
  const names = useCompanionNames();
  // Which companions are locked is an account fact, not a constant: "Skip
  // for now" in the plans dialog opens them for testing.
  const accountLocks = useLockedModes();
  const lockedModes = lockedOverride ?? accountLocks;
  // on a phone the rail scrolls; its edges fade where more companions are
  const { moreStart, moreEnd, scrollProps } = useScrollEdges("x");
  const stripRef = useRef<ScrollViewInstance | null>(null);
  const stripWidth = useRef(0);
  const pillFrames = useRef<Record<string, { x: number; width: number }>>({});

  // The row scrolls, so the fourth pill sits past the right edge - and if
  // that pill is the mode you are in, the control is hiding the one thing it
  // exists to tell you. Bring the selected mode into view, centred.
  const centreSelected = useCallback(() => {
    const frame = value ? pillFrames.current[value] : undefined;
    if (!frame || !stripRef.current || !stripWidth.current) return;
    const x = Math.max(0, frame.x - (stripWidth.current - frame.width) / 2);
    stripRef.current.scrollTo({ x, animated: false });
  }, [value]);

  // folded too: unfolding mounts a fresh rail, scrolled to its start
  useEffect(() => {
    centreSelected();
  }, [centreSelected, folded]);

  const current = COGNITIVE_MODES.find((m) => m.value === value);
  if (folded && current) {
    const label = companionLabel(names, current.value, current.label);
    return (
      <View style={{ flexDirection: "row" }}>
        {/* A tap on a Pressable outside a ScrollView leaves the chat box
            focused, so the keyboard stays up while the rail opens - what the
            web's mousedown preventDefault was for. */}
        <Animated.View entering={FadeIn.duration(150)}>
          <Pressable
            testID="mode-chip"
            onPress={onUnfold}
            accessibilityRole="button"
            accessibilityLabel={`Mode: ${label}. Show all modes`}
            accessibilityState={{ expanded: false }}
            hitSlop={{ top: 8, bottom: 8 }}
            style={s.chip}
          >
            <MaskIcon src={current.icon} size={px(16)} color={s.colors.brand} />
            <Text style={s.chipText} numberOfLines={1}>
              {label}
            </Text>
            <Svg viewBox="0 0 12 12" width={px(12)} height={px(12)} style={{ opacity: 0.7 }}>
              <Path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke={s.colors.brand} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  if (value === null) {
    return (
      <View>
        <Text style={s.prompt}>How should the companion approach this?</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Cognitive mode" ref={tourRef("mode-picker")} collapsable={false} style={{ gap: space(2) }}>
          {COGNITIVE_MODES.map((mode) => {
            const comingSoon = lockedModes.includes(mode.value);
            const off = disabled || (comingSoon && !onLocked);
            return (
              <Pressable
                key={mode.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: false, disabled: comingSoon || off }}
                disabled={off}
                onPress={() => (comingSoon ? onLocked?.(mode.value) : onChange(mode.value))}
                style={({ pressed }) => [
                  s.card,
                  pressed && !off && s.cardPressed,
                  off ? { opacity: 0.5 } : comingSoon && { opacity: 0.6 },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
                  <Text style={s.cardTitle}>{companionLabel(names, mode.value, mode.label)}</Text>
                  {comingSoon && (
                    <View style={s.soon}>
                      <Text style={s.soonText}>SOON</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardWhen}>{mode.when}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View ref={tourRef("mode-picker")} collapsable={false} style={{ width: "100%", minWidth: 0 }}>
      {/* The design's rail: eight separate cards spread across the width of
          the composer below, each a 20px mark above a 16px name. Below that
          width it scrolls rather than wrapping into a ragged second row -
          every companion stays one tap away and the rail keeps its shape. */}
      <ScrollView
        ref={stripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        // A tap on a mode while typing must not dismiss the keyboard first.
        keyboardShouldPersistTaps="handled"
        accessibilityRole="radiogroup"
        accessibilityLabel="Cognitive mode"
        contentContainerStyle={s.rail}
        {...scrollProps}
        onLayout={(e: LayoutChangeEvent) => {
          scrollProps.onLayout(e);
          stripWidth.current = e.nativeEvent.layout.width;
          centreSelected();
        }}
      >
        {COGNITIVE_MODES.map((mode) => {
          const selected = value === mode.value;
          const comingSoon = lockedModes.includes(mode.value);
          const off = disabled || (comingSoon && !onLocked);
          const tint = selected ? s.colors.brand : s.colors.inkSecondary;
          return (
            <Pressable
              key={mode.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: comingSoon || off }}
              accessibilityHint={comingSoon ? `${mode.when} (included in a paid plan)` : mode.when}
              disabled={off}
              onPress={() => (comingSoon ? onLocked?.(mode.value) : onChange(mode.value))}
              onLayout={(e) => {
                pillFrames.current[mode.value] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                if (selected) centreSelected();
              }}
              style={({ pressed }) => [
                s.pill,
                // The design draws every card the same and leaves selection
                // to us. The accent carries the whole card - its edge, its
                // fill and its label - which is unmistakable at a glance
                // without the filled pill that would shout over a rail of
                // eight.
                selected ? s.pillSelected : pressed && !off && s.pillPressed,
                off ? { opacity: 0.5 } : comingSoon && { opacity: 0.6 },
              ]}
            >
              <MaskIcon src={mode.icon} size={px(20)} color={tint} />
              <Text style={[s.pillText, selected && s.pillTextSelected]} numberOfLines={1}>
                {companionLabel(names, mode.value, mode.label)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {moreStart && (
        <LinearGradient
          pointerEvents="none"
          colors={[s.colors.canvas, `${s.colors.canvas}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.fade, { left: 0 }]}
        />
      )}
      {moreEnd && (
        <LinearGradient
          pointerEvents="none"
          colors={[`${s.colors.canvas}00`, s.colors.canvas]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.fade, { right: 0 }]}
        />
      )}
    </View>
  );
}

const styles = (c: Colors) => ({
  colors: c,
  ...StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(1.5),
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: c.brandBorder,
      backgroundColor: c.brandSoft,
      paddingVertical: space(1),
      paddingLeft: space(2.5),
      paddingRight: space(3),
    },
    chipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.brand },
    prompt: { marginBottom: space(2), fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.inkSecondary },
    card: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      padding: space(3),
    },
    cardPressed: { borderColor: c.brandBorder, backgroundColor: c.surfaceHover },
    cardTitle: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: c.ink },
    soon: { borderRadius: radius.full, backgroundColor: c.surfaceHover, paddingHorizontal: space(1.5), paddingVertical: 1 },
    soonText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.inkMuted, letterSpacing: 0.5 },
    cardWhen: { marginTop: space(0.5), fontFamily: fonts.regular, fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.625, color: c.inkMuted },
    rail: { flexGrow: 1, flexDirection: "row", alignItems: "stretch", justifyContent: "space-between", gap: space(1) },
    pill: {
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      borderRadius: px(8),
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      paddingHorizontal: space(3),
      paddingVertical: space(1),
    },
    pillSelected: { borderColor: c.brand, backgroundColor: c.brandSoft },
    pillPressed: { borderColor: c.hairlineStrong },
    pillText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.inkSecondary },
    pillTextSelected: { fontFamily: fonts.medium, color: c.brand },
    fade: { position: "absolute", top: 0, bottom: 0, width: 28 },
  }),
});
