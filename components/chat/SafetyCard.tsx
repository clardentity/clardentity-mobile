import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as WebBrowser from "expo-web-browser";
import type { SafetyCardData, SafetyResource } from "@/lib/sse";
import { fonts, fontSize, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* The support card, above an answer the safety screen flagged (backend
 * services/safety). The numbers come from the server's verified table for
 * where the person is - never from the model - so they are right even if the
 * prose beside them is not. Each one is a tap-to-call button, because the
 * person reading this may not be in a state to copy a number.
 *
 * Two registers: a crisis ("you don't have to face this alone", danger
 * number first) and a concern (support is there if wanted, no alarm). */

function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
  } catch {
    // Hermes builds without Intl.DisplayNames land here too.
    return code;
  }
}

function Call({ resource }: { resource: SafetyResource }) {
  const c = useColors();
  const s = useThemedStyles(styles);
  return (
    <Pressable
      onPress={() => void Linking.openURL(`tel:${resource.number.replace(/[^\d+*#]/g, "")}`)}
      accessibilityRole="button"
      accessibilityLabel={`Call ${resource.label}, ${resource.number}`}
      style={({ pressed }) => [s.call, pressed && { backgroundColor: c.surfaceHover }]}
    >
      <Text style={s.number}>{resource.number}</Text>
      <Text style={s.callLabel}>
        {resource.label}
        {resource.hours ? ` · ${resource.hours}` : ""}
      </Text>
    </Pressable>
  );
}

export function SafetyCard({ card }: { card: SafetyCardData }) {
  const c = useColors();
  const s = useThemedStyles(styles);
  const crisis = card.level === "crisis";
  // The number to say first. Where the ambulance has its own number - Japan's
  // 119 beside the police's 110, Brazil's 192 beside 190 - a medical
  // emergency or someone who may hurt themselves needs the ambulance, not
  // the police; harm from someone else keeps the general number.
  const medical = ["suicide_or_self_harm", "medical_emergency", "someone_else_at_risk", "distress"].includes(
    card.kind,
  );
  const emergency =
    (medical && card.resources.find((r) => r.kind === "ambulance")) ||
    card.resources.find((r) => r.kind === "emergency");
  const hasCrisisLine = card.resources.some((r) => r.kind === "crisis");
  // In a crisis the danger number leads; otherwise the crisis line does,
  // because "call emergency services" to someone who is low reads as alarm.
  const ordered = crisis
    ? [...card.resources].sort((a, b) => Number(b === emergency) - Number(a === emergency))
    : [...card.resources].sort((a, b) => Number(b.kind === "crisis") - Number(a.kind === "crisis"));
  const where = countryName(card.country);

  return (
    <Animated.View entering={FadeIn.duration(300)} accessibilityLabel="Support" style={s.card}>
      <Text style={s.title}>{crisis ? "You don't have to face this alone." : "Support is here if you want it."}</Text>
      <Text style={s.lead}>
        {crisis
          ? emergency
            ? `If you might act on these thoughts or you're in danger, call ${emergency.number} now. Talking to someone helps, at any hour.`
            : "If you might act on these thoughts or you're in danger, call your local emergency number now."
          : "Free, confidential support - you can reach out any time."}
      </Text>
      {ordered.length > 0 && (
        <View style={s.calls}>
          {ordered.map((r) => (
            <Call key={`${r.kind}-${r.number}`} resource={r} />
          ))}
        </View>
      )}
      <Text style={s.foot}>
        {!hasCrisisLine && (
          <>
            <Text
              onPress={() => void WebBrowser.openBrowserAsync(card.fallback_url)}
              accessibilityRole="link"
              style={{ fontFamily: fonts.medium, color: c.brand, textDecorationLine: "underline" }}
            >
              Find a free helpline near you
            </Text>
            {where ? " · " : ""}
          </>
        )}
        {where ? `Numbers for ${where}` : null}
      </Text>
    </Animated.View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    card: {
      borderRadius: radius["2xl"],
      borderWidth: 1,
      borderColor: c.brandBorder,
      backgroundColor: c.brandSoft,
      paddingHorizontal: space(4),
      paddingVertical: space(3.5),
    },
    title: { fontSize: fontSize.sm, fontFamily: fonts.semibold, color: c.ink },
    lead: {
      marginTop: space(0.5),
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.625,
      fontFamily: fonts.regular,
      color: c.inkSecondary,
    },
    calls: { marginTop: space(2.5), flexDirection: "row", flexWrap: "wrap", gap: space(2) },
    call: {
      minWidth: 0,
      minHeight: 44,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.brandBorder,
      backgroundColor: c.surfaceRaised,
      paddingHorizontal: space(3),
      paddingVertical: space(2),
    },
    number: { fontSize: fontSize.base, fontFamily: fonts.semibold, color: c.brand, fontVariant: ["tabular-nums"] },
    callLabel: { fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.375, fontFamily: fonts.regular, color: c.inkSecondary },
    foot: { marginTop: space(2), fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.inkMuted },
  });
