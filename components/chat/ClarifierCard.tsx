import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* One question the answer needs answered, with options you can tap.
 *
 * The answer above it is already there - this is never a gate. That matters:
 * a companion that stops and asks before saying anything is a form, and the
 * whole point of asking is to make a good answer better rather than to make
 * you work before you get one.
 *
 * Options are numbered. On the web 1-4 selected them from the keyboard; a
 * phone has no keys to spare for that, so the shortcut is dropped here and the
 * numbers stay only as labels. */

export function ClarifierCard({
  question,
  options,
  onAnswer,
  disabled,
}: {
  question: string;
  options: string[];
  onAnswer: (answer: string) => void;
  disabled?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [answered, setAnswered] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const c = useColors();
  const s = useThemedStyles(styles);

  // Answered, not gone. The question was structured data attached to the
  // answer, so once the card closed it left the transcript entirely - and the
  // reply underneath ("Just curious about the topic") read as a non-sequitur
  // with nothing above it to say what it was answering.
  if (answered !== null) {
    return <Text style={s.asked}>Asked: {question}</Text>;
  }

  if (dismissed) return null;

  function submitCustom() {
    const trimmed = custom.trim();
    if (trimmed) {
      setAnswered(trimmed);
      onAnswer(trimmed);
    }
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.question}>{question}</Text>
        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss question"
          hitSlop={12}
          style={({ pressed }) => [s.dismiss, pressed && { backgroundColor: c.surfaceHover }]}
        >
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={c.inkMuted} strokeWidth={2} strokeLinecap="round">
            <Path d="M18 6 6 18M6 6l12 12" />
          </Svg>
        </Pressable>
      </View>

      <View style={s.list}>
        {options.map((option, index) => (
          <Pressable
            key={option}
            disabled={disabled}
            onPress={() => {
              setAnswered(option);
              onAnswer(option);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.option,
              index > 0 && s.divider,
              pressed && { backgroundColor: c.surfaceHover },
              disabled && { opacity: 0.5 },
            ]}
          >
            <View style={s.number}>
              <Text style={s.numberText}>{index + 1}</Text>
            </View>
            <Text style={s.optionText}>{option}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.form}>
        <TextInput
          value={custom}
          onChangeText={setCustom}
          editable={!disabled}
          placeholder="Something else"
          placeholderTextColor={c.inkMuted}
          accessibilityLabel="Answer in your own words"
          returnKeyType="send"
          onSubmitEditing={submitCustom}
          style={s.input}
        />
        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          style={({ pressed }) => [s.skip, pressed && { backgroundColor: c.surfaceHover }]}
        >
          <Text style={s.skipText}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    asked: {
      marginTop: space(2.5),
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.625,
      color: c.inkMuted,
      fontFamily: fonts.regular,
    },
    card: {
      marginTop: space(3),
      overflow: "hidden",
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.brandBorder,
      backgroundColor: c.brandSoft,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: space(3),
      paddingHorizontal: space(3),
      paddingVertical: space(2),
    },
    question: { flex: 1, fontSize: fontSize.xs, fontFamily: fonts.medium, color: c.ink },
    dismiss: { borderRadius: radius.md, padding: space(0.5) },
    list: { borderTopWidth: 1, borderTopColor: c.hairline },
    divider: { borderTopWidth: 1, borderTopColor: c.hairline },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(2.5),
      paddingHorizontal: space(3),
      paddingVertical: space(2),
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
    optionText: { flex: 1, fontSize: fontSize.xs, color: c.ink, fontFamily: fonts.regular },
    form: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(2),
      borderTopWidth: 1,
      borderTopColor: c.hairline,
      paddingHorizontal: space(3),
      paddingVertical: space(2),
    },
    input: { flex: 1, minWidth: 0, fontSize: fontSize.xs, color: c.ink, fontFamily: fonts.regular, paddingVertical: space(1) },
    skip: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.hairlineStrong,
      paddingHorizontal: space(2),
      paddingVertical: space(0.5),
    },
    skipText: { fontSize: fontSize.xs, color: c.inkSecondary, fontFamily: fonts.regular },
  });
