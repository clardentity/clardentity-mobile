import { StyleSheet, Text, View } from "react-native";
import type { ThinkingReviewData } from "@/lib/sse";
import { fonts, fontSize, radius, space, useThemedStyles, type Colors } from "@/lib/theme";

/* What Thinking mode shows where the evidence panel would be.
 *
 * Claims and citations are the wrong instrument for a reasoning chain: it is
 * sound or unsound because of how it moves between steps, not because a
 * document agrees with it. So the panel here is a contrast - the reasoning
 * that holds for this question against the way it most easily goes wrong -
 * and the failure modes carry their catalogue names, because "you'll weight
 * the first number you saw" is worth more with "Anchoring Bias" attached.
 *
 * It describes the question, not our answer, which means it is also a
 * checklist you can hold the answer up against.
 */

export function ThinkingReview({ review }: { review: ThinkingReviewData }) {
  const s = useThemedStyles(styles);
  if (!review.sound?.length || !review.biased?.length) return null;

  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={[s.caps, s.secondary]}>
        How to think about this
      </Text>

      {/* Two columns at every width. The contrast *is* the panel - stacking
          it puts "goes wrong" below the fold and turns a comparison into two
          lists. Narrow screens pay for it in type size rather than in
          losing the side-by-side. */}
      <View style={s.columns}>
        <View style={s.column}>
          <Text style={[s.caps, s.high]}>Correct or appropriate</Text>
          <View style={s.list}>
            {review.sound.map((entry, i) => (
              <View key={i}>
                <Text style={s.approach}>{entry.approach}</Text>
                <Text style={s.why}>{entry.why}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.column}>
          <Text style={[s.caps, s.caution]}>Incorrect or inappropriate</Text>
          <View style={s.list}>
            {review.biased.map((entry, i) => (
              <View key={i}>
                <Text style={s.approach}>{entry.approach}</Text>
                {entry.bias_name ? <Text style={[s.biasName, s.caution]}>{entry.bias_name}</Text> : null}
                <Text style={s.why}>{entry.why}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    card: {
      marginBottom: space(2.5),
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surfaceMuted,
      padding: space(3),
    },
    caps: { fontSize: fontSize.xs, fontFamily: fonts.semibold, textTransform: "uppercase", letterSpacing: 0.4 },
    secondary: { color: c.inkSecondary },
    high: { color: c.bandHigh },
    caution: { color: c.caution },
    columns: { marginTop: space(2.5), flexDirection: "row", gap: space(2.5) },
    column: { flex: 1, minWidth: 0 },
    list: { marginTop: space(1.5), gap: space(2) },
    approach: { fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.625, fontFamily: fonts.medium, color: c.ink },
    biasName: { marginTop: space(0.5), fontSize: fontSize.xs, fontFamily: fonts.medium },
    why: {
      marginTop: space(0.5),
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.625,
      fontFamily: fonts.regular,
      color: c.inkSecondary,
    },
  });
