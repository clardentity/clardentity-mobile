import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* Offered before the answer exists, not after.
 *
 * One specific piece of information is missing and there's a short,
 * enumerable set of likely answers - "what are you trying to get better at?"
 * with a handful of genuinely different readings - so this asks with
 * tappable options instead of either guessing one or opening a free-text box
 * (`ContextQuestionCard`'s job, for questions with no short answer list).
 * Nothing has been written when it appears: no message saved, no answer
 * generated, so tapping an option, typing one, or skipping all cost the same
 * single round trip.
 *
 * Options are numbered. The web's 1-4 keyboard shortcut does not apply on a
 * phone, so the numbers are labels only here.
 */

export function ClarifyingOptionsCard({
  question,
  options,
  busy,
  onAnswer,
  onSkip,
}: {
  question: string;
  options: string[];
  busy?: boolean;
  onAnswer: (answer: string) => void;
  onSkip: () => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const c = useColors();
  const s = useThemedStyles(styles);

  function submitCustom() {
    const trimmed = custom.trim();
    if (trimmed) onAnswer(trimmed);
  }

  return (
    <View style={s.card}>
      <Text style={s.question}>{question}</Text>

      <View style={s.list}>
        {options.map((option, index) => (
          <Pressable
            key={option}
            disabled={busy}
            onPress={() => onAnswer(option)}
            accessibilityRole="button"
            // 36pt rows: stacked edge to edge, so a hit area can't reach past
            // the row without landing on the next answer.
            style={({ pressed }) => [
              s.option,
              index > 0 && s.divider,
              pressed && { backgroundColor: c.surfaceHover },
              busy && { opacity: 0.5 },
            ]}
          >
            <View style={s.number}>
              <Text style={s.numberText}>{index + 1}</Text>
            </View>
            <Text style={s.optionText}>{option}</Text>
          </Pressable>
        ))}
      </View>

      {customOpen ? (
        // Roomier on a touch screen: the card clips at its edge, and the
        // buttons' tap areas reach past them into this padding.
        <View style={s.footer}>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            editable={!busy}
            autoFocus
            placeholder="Something else"
            placeholderTextColor={c.inkMuted}
            accessibilityLabel="Answer in your own words"
            returnKeyType="send"
            onSubmitEditing={submitCustom}
            style={s.input}
          />
          <Pressable
            onPress={submitCustom}
            disabled={busy || !custom.trim()}
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => [
              s.send,
              pressed && { backgroundColor: c.brandDark },
              (busy || !custom.trim()) && { opacity: 0.4 },
            ]}
          >
            <Text style={s.sendText}>{busy ? "Asking…" : "Send"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.footer}>
          <Pressable
            onPress={() => setCustomOpen(true)}
            disabled={busy}
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => [s.ghost, pressed && { backgroundColor: c.surfaceHover }, busy && { opacity: 0.6 }]}
          >
            <Text style={s.ghostText}>Something else</Text>
          </Pressable>
          <Pressable
            onPress={onSkip}
            disabled={busy}
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => [
              s.ghost,
              { marginLeft: "auto" },
              pressed && { backgroundColor: c.surfaceHover },
              busy && { opacity: 0.6 },
            ]}
          >
            <Text style={s.ghostText}>Answer without this</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    card: {
      marginTop: space(2),
      overflow: "hidden",
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.brandBorder,
      backgroundColor: c.brandSoft,
    },
    question: {
      paddingHorizontal: space(3.5),
      paddingVertical: space(2.5),
      fontSize: fontSize.sm,
      fontFamily: fonts.medium,
      color: c.ink,
    },
    list: { borderTopWidth: 1, borderTopColor: c.hairline },
    divider: { borderTopWidth: 1, borderTopColor: c.hairline },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(2.5),
      paddingHorizontal: space(3.5),
      paddingVertical: space(2),
      minHeight: 36,
    },
    number: {
      width: px(16),
      height: px(16),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.base,
      borderWidth: 1,
      borderColor: c.hairlineStrong,
    },
    numberText: { fontSize: fontSize.xs * 0.85, color: c.inkMuted, fontFamily: fonts.regular, fontVariant: ["tabular-nums"] },
    optionText: { flex: 1, fontSize: fontSize.sm, color: c.ink, fontFamily: fonts.regular },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(2),
      borderTopWidth: 1,
      borderTopColor: c.hairline,
      paddingHorizontal: space(3.5),
      paddingVertical: space(3.5),
    },
    input: { flex: 1, minWidth: 0, fontSize: fontSize.sm, color: c.ink, fontFamily: fonts.regular, paddingVertical: space(1) },
    send: {
      borderRadius: radius.full,
      backgroundColor: c.brand,
      paddingHorizontal: space(3),
      paddingVertical: space(1),
    },
    sendText: { fontSize: fontSize.xs, fontFamily: fonts.medium, color: "#ffffff" },
    ghost: { borderRadius: radius.full, paddingHorizontal: space(2.5), paddingVertical: space(1) },
    ghostText: { fontSize: fontSize.xs, color: c.inkSecondary, fontFamily: fonts.regular },
  });
