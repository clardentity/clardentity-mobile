import { StyleSheet, Text, View } from "react-native";
import { MODE_BY_VALUE, type CognitiveMode } from "@/lib/modes";
import type { Guidance } from "@/lib/sse";
import { fonts, fontSize, space, useThemedStyles, type Colors } from "@/lib/theme";

/* Two suggestions about the question, offered as ghosts.
 *
 * Neither is a correction and neither blocks anything - the answer above is
 * already there and still stands. So this is drawn as faint as it can be and
 * still be read: no card, no fill, nothing but the dotted underline on the
 * thing you can act on. (The web brightens the row on hover; a phone has no
 * hover, so it stays at the resting faintness, as it does on the web's phone
 * layout.)
 *
 * Both halves are null on most turns. A nudge that fires every time is chrome.
 */

export function GuidanceCard({
  guidance,
  onUseMode,
  onAskRefined,
  disabled,
}: {
  guidance: Guidance;
  onUseMode?: (mode: CognitiveMode) => void;
  onAskRefined?: (question: string) => void;
  disabled?: boolean;
}) {
  const s = useThemedStyles(styles);
  const mode = guidance.suggested_mode as CognitiveMode | null;
  const modeLabel = mode ? MODE_BY_VALUE[mode]?.label : null;
  const refined = guidance.refined_question;

  if (!modeLabel && !refined) return null;

  const modeOff = disabled || !onUseMode;
  const refinedOff = disabled || !onAskRefined;

  return (
    <View style={s.root}>
      {modeLabel && mode ? (
        // The action is a nested Text with onPress so it wraps with the
        // sentence around it, as the inline <button> did.
        <Text style={s.line}>
          <Text style={s.lead}>Better suited to </Text>
          <Text
            onPress={modeOff ? undefined : () => onUseMode?.(mode)}
            accessibilityRole="button"
            accessibilityState={{ disabled: modeOff }}
            style={[s.action, { fontFamily: fonts.medium }, modeOff && s.actionOff]}
          >
            {modeLabel} mode
          </Text>
          {guidance.mode_reason ? <Text> - {guidance.mode_reason}</Text> : null}
        </Text>
      ) : null}

      {refined ? (
        <Text style={s.line}>
          <Text style={s.lead}>Did you mean: </Text>
          <Text
            onPress={refinedOff ? undefined : () => onAskRefined?.(refined)}
            accessibilityRole="button"
            accessibilityState={{ disabled: refinedOff }}
            style={[s.action, { fontStyle: "italic" }, refinedOff && s.actionOff]}
          >
            {refined}
          </Text>
          {guidance.refinement_reason ? <Text> - {guidance.refinement_reason}</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    root: { marginTop: space(2.5), gap: space(1.5), opacity: 0.55 },
    line: { fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.625, fontFamily: fonts.regular, color: c.inkMuted },
    lead: { color: c.inkSecondary },
    action: {
      color: c.brand,
      textDecorationLine: "underline",
      textDecorationStyle: "dotted",
      textDecorationColor: c.brand,
    },
    actionOff: { textDecorationLine: "none", opacity: 0.6 },
  });
