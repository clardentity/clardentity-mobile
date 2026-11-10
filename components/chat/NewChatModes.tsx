import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { MaskIcon } from "@/components/ui/MaskIcon";
import type { CognitiveMode } from "@/components/chat/ModeSelector";
import { fonts, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* The mobile design's new chat (Figma "01 · Mobile / New chat"): a large
 * left-aligned question, then four companions to start in, each a white card
 * with its mark in a soft square. Picking one sets the composer's mode; the
 * chat begins when you send. */

const CARDS: Array<{ mode: CognitiveMode; label: string; hint: string; icon: string }> = [
  { mode: "knowing", label: "Finder", hint: "Find answers with clarity", icon: "/ui/m-magnifying-glass.svg" },
  { mode: "thinking", label: "Thought Coach", hint: "Think through your ideas", icon: "/ui/m-brain.svg" },
  { mode: "decision", label: "Decision-Making", hint: "Explore your options", icon: "/ui/m-crosshair.svg" },
  { mode: "guidance", label: "Reflect and Relieve", hint: "A space to reflect", icon: "/ui/m-book-open.svg" },
];

export function NewChatModes({
  mode,
  onPick,
}: {
  mode: CognitiveMode | null;
  onPick: (mode: CognitiveMode) => void;
}) {
  const c = useColors();
  const s = useThemedStyles(styles);
  return (
    <Animated.View entering={FadeIn.duration(400)} style={s.root}>
      <Text accessibilityRole="header" style={s.title}>
        What can I help{"\n"}you with today?
      </Text>
      <Text style={s.label}>Choose a mode</Text>
      <View style={{ gap: 11 }}>
        {CARDS.map((card) => {
          const selected = card.mode === mode;
          return (
            <Pressable
              key={card.mode}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityHint={card.hint}
              onPress={() => onPick(card.mode)}
              style={({ pressed }) => [
                s.card,
                selected && { borderColor: c.brandBorder },
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={[s.accent, selected && { backgroundColor: c.brandSoft }]}>
                <MaskIcon src={card.icon} size={16} color={c.brand} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={s.cardTitle}>
                  {card.label}
                </Text>
                <Text numberOfLines={1} style={s.cardHint}>
                  {card.hint}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    root: { alignSelf: "stretch", paddingHorizontal: 2 },
    title: { paddingHorizontal: 8, fontFamily: fonts.medium, fontSize: 31, lineHeight: 37, color: c.ink },
    label: {
      marginTop: 44,
      marginBottom: 12,
      paddingHorizontal: 8,
      fontFamily: fonts.medium,
      fontSize: 11,
      letterSpacing: 0.3,
      textTransform: "uppercase",
      color: c.inkTertiary,
    },
    card: {
      height: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: c.surface,
      paddingHorizontal: 13,
    },
    accent: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceSunken,
    },
    cardTitle: { fontFamily: fonts.medium, fontSize: 16, color: c.ink },
    cardHint: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: c.inkSecondary },
  });
