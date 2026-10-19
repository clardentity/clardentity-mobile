import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, fontSize, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* Offered before the answer exists, not after.
 *
 * A question so vague that answering it well required guessing has already
 * had its guess baked into the answer by the time a "did you mean" note
 * shows up next to it. So this stops first and asks - like the mode and
 * context gates, nothing has been written when it appears: no message saved,
 * no answer generated, so either choice costs the same single round trip.
 */

export function RefinedQuestionCard({
  refinedQuestion,
  reason,
  busy,
  onAskRefined,
  onKeepOriginal,
}: {
  refinedQuestion: string;
  reason: string | null;
  busy?: boolean;
  onAskRefined: () => void;
  onKeepOriginal: () => void;
}) {
  const c = useColors();
  const s = useThemedStyles(styles);
  return (
    <View style={s.card}>
      <Text style={s.question}>Did you mean: “{refinedQuestion}”?</Text>
      {reason ? <Text style={[s.small, { color: c.inkSecondary }]}>{reason}</Text> : null}
      <Text style={[s.small, { color: c.inkMuted }]}>
        Nothing has been answered yet - whichever you pick is what gets written, checked and scored.
      </Text>

      <View style={s.actions}>
        <Pressable
          onPress={onAskRefined}
          disabled={busy}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [s.primary, pressed && { backgroundColor: c.brandDark }, busy && { opacity: 0.6 }]}
        >
          <Text style={s.primaryText}>{busy ? "Asking…" : "Ask it this way"}</Text>
        </Pressable>
        <Pressable
          onPress={onKeepOriginal}
          disabled={busy}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [s.ghost, pressed && { backgroundColor: c.surfaceHover }, busy && { opacity: 0.6 }]}
        >
          <Text style={s.ghostText}>Keep my wording</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    card: {
      marginTop: space(2),
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.brandBorder,
      backgroundColor: c.brandSoft,
      padding: space(3.5),
    },
    question: { fontSize: fontSize.sm, fontFamily: fonts.medium, color: c.ink },
    small: { marginTop: space(1), fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.625, fontFamily: fonts.regular },
    actions: { marginTop: space(3), flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(2) },
    primary: { borderRadius: radius.full, backgroundColor: c.brand, paddingHorizontal: space(3.5), paddingVertical: space(1.5) },
    primaryText: { fontSize: fontSize.xs, fontFamily: fonts.medium, color: "#ffffff" },
    ghost: { borderRadius: radius.full, paddingHorizontal: space(3), paddingVertical: space(1.5) },
    ghostText: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.inkSecondary },
  });
