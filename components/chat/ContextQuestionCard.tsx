import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fonts, fontSize, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* The question a person would ask before giving an opinion.
 *
 * Deliberately open text, not options. `ClarifyingOptionsCard` is the
 * sibling pre-answer gate for "a short, enumerable set of likely answers" -
 * right for "what do you want to learn next" and grotesque for "why do you
 * want to divorce your wife". A multiple-choice menu of reasons for ending a
 * marriage would be worse than asking nothing at all, so this one stays an
 * open question and an empty box.
 *
 * It also cannot become a wall. Answering is optional and skipping is one
 * tap: the point is to gather context a good answer needs, not to make
 * someone justify themselves to software before it will help them.
 */

export function ContextQuestionCard({
  question,
  busy,
  onAnswer,
  onSkip,
}: {
  question: string;
  busy?: boolean;
  onAnswer: (context: string) => void;
  onSkip: () => void;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const answered = value.trim().length > 0;
  const c = useColors();
  const s = useThemedStyles(styles);

  return (
    <View style={s.card}>
      <Text style={s.question}>{question}</Text>

      <TextInput
        value={value}
        onChangeText={setValue}
        multiline
        // The return key sends - the same contract as the composer directly
        // below it. (The web's Shift+Enter line break has no phone keyboard
        // equivalent.)
        submitBehavior="submit"
        returnKeyType="send"
        onSubmitEditing={() => {
          if (answered && !busy) onAnswer(value.trim());
        }}
        autoFocus
        editable={!busy}
        placeholder="However much you want to say."
        placeholderTextColor={c.inkMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textAlignVertical="top"
        style={[s.input, focused && { borderColor: c.brandBorder }, busy && { opacity: 0.6 }]}
      />

      <View style={s.actions}>
        <Pressable
          onPress={() => onAnswer(value.trim())}
          disabled={busy || !answered}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [
            s.send,
            pressed && { backgroundColor: c.brandDark },
            (busy || !answered) && { opacity: 0.4 },
          ]}
        >
          <Text style={s.sendText}>{busy ? "Sending…" : "Send"}</Text>
        </Pressable>
        <Pressable
          onPress={onSkip}
          disabled={busy}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [s.ghost, pressed && { backgroundColor: c.surfaceHover }, busy && { opacity: 0.6 }]}
        >
          <Text style={s.ghostText}>Answer without this</Text>
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
      borderColor: c.hairline,
      backgroundColor: c.surfaceMuted,
      padding: space(3.5),
    },
    question: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.625, color: c.ink, fontFamily: fonts.regular },
    input: {
      marginTop: space(2.5),
      minHeight: fontSize.sm * 1.5 * 2 + space(4),
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      paddingHorizontal: space(3),
      paddingVertical: space(2),
      fontSize: fontSize.sm,
      fontFamily: fonts.regular,
      color: c.ink,
    },
    actions: { marginTop: space(2), flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(2) },
    send: {
      borderRadius: radius.full,
      backgroundColor: c.brand,
      paddingHorizontal: space(3.5),
      paddingVertical: space(1.5),
    },
    sendText: { fontSize: fontSize.xs, fontFamily: fonts.medium, color: "#ffffff" },
    ghost: { borderRadius: radius.full, paddingHorizontal: space(3), paddingVertical: space(1.5) },
    ghostText: { fontSize: fontSize.xs, color: c.inkSecondary, fontFamily: fonts.regular },
  });
