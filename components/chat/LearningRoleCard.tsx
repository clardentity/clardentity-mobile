import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { track } from "@/lib/analytics";
import {
  getLearningRole,
  getServerLearningRole,
  loadLearningRole,
  setLearningRole,
  subscribe,
  type LearningRole,
} from "@/lib/learningRole";
import { fonts, fontSize, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* Asked once, the first time someone opens Learning mode.
 *
 * Learning is the one mode where the same question wants a different answer
 * depending on who is asking. "Explain the Krebs cycle" from a student is a
 * request to understand it; from a teacher it is a request for the order to
 * introduce it in and the misconceptions to expect. ("Just visiting" was a
 * third option until 2026-10-10; it was taken out, and an account that
 * picked it keeps its answer - the server still understands it.)
 * Inference could work this out eventually, but not from the first message -
 * which is exactly the one where getting it wrong is most obvious.
 *
 * Buttons rather than a text box, because the answer steers the system
 * prompt. A closed set is a setting; free text would be user input reaching
 * the instructions. (`ContextQuestionCard` is the open-text sibling, for
 * questions where a menu would be grotesque.)
 *
 * It appears above the composer rather than in the thread: it is a question
 * about the person, not a turn in the conversation, and it should not still
 * be sitting there when they scroll back through what they asked.
 */

const OPTIONS: { value: LearningRole; label: string; blurb: string }[] = [
  { value: "student", label: "A student", blurb: "Teach me the material" },
  { value: "teacher", label: "A teacher", blurb: "Help me put it across" },
];

export function LearningRoleCard() {
  const role = useSyncExternalStore(subscribe, getLearningRole, getServerLearningRole);
  const [busy, setBusy] = useState(false);
  const c = useColors();
  const s = useThemedStyles(styles);

  useEffect(() => {
    void loadLearningRole();
  }, []);

  async function choose(value: LearningRole) {
    setBusy(true);
    track("learning_role_set", { role: value });
    await setLearningRole(value);
    setBusy(false);
  }

  // Not looked yet, or already answered: nothing to show.
  if (role !== null) return null;

  return (
    <View style={s.card}>
      <Text style={s.question}>Before we start - are you learning this yourself, or teaching it to someone else?</Text>
      <View style={s.options}>
        {OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            disabled={busy}
            onPress={() => void choose(option.value)}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.option,
              pressed && { borderColor: c.brandBorder, backgroundColor: c.surfaceHover },
              busy && { opacity: 0.6 },
            ]}
          >
            <Text style={s.label}>{option.label}</Text>
            <Text style={s.blurb}>{option.blurb}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[s.blurb, { marginTop: space(2) }]}>
        Changes how explanations are pitched. You can change it later in Settings.
      </Text>
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
    question: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.625, fontFamily: fonts.regular, color: c.ink },
    options: { marginTop: space(2.5), flexDirection: "row", flexWrap: "wrap", gap: space(2) },
    option: {
      minWidth: 0,
      alignItems: "flex-start",
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      paddingHorizontal: space(3),
      paddingVertical: space(2),
    },
    label: { fontSize: fontSize.sm, fontFamily: fonts.medium, color: c.ink },
    blurb: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.inkMuted },
  });
