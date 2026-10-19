import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import type { HealthConsentCopy, HealthConsentState } from "@/lib/sse";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* Healthcare asks before it answers.
 *
 * Health information is special-category or sensitive data almost everywhere
 * the product is used, and the common denominator of those laws is explicit,
 * separate, informed consent before it is processed - so this card stands
 * between someone picking Healthcare and their first question being read.
 * Every line on it comes from the server (backend api/healthcare): the
 * jurisdiction, what is collected and why, who processes it and where, what
 * happens to the conversation, how to withdraw and where to complain, the
 * laws it is given under and the age it needs. The age box is not
 * decoration: below that age the person cannot consent alone.
 *
 * Where the notice exists in more than one language (Hindi in India, as the
 * DPDP Act asks), it can be read in either, and the one it was agreed in is
 * recorded with the consent. */

const LANGUAGE_NAMES: Record<string, string> = { en: "English", hi: "हिन्दी" };
/** The word before the last law in the list. */
const AND: Record<string, string> = { en: " and ", hi: " और " };

/** The English text, for a server that predates `copy`. */
function fallbackCopy(state: HealthConsentState): HealthConsentCopy {
  return {
    eyebrow: "Before Healthcare answers",
    title: `Your health information, under the rules for ${state.jurisdiction.name}`,
    points: state.points,
    given_under: "Given under",
    age_label: `I am ${state.consent_age} or older, and I agree to Healthcare using my health information as described.`,
    agree: "I agree",
    decline: "Not now",
    footer: "You can withdraw this any time in Settings.",
  };
}

export function HealthConsentCard({
  state,
  onAgree,
  onDecline,
  busy = false,
  error,
}: {
  state: HealthConsentState;
  /** Called with the language the notice was read in. */
  onAgree: (language: string) => void;
  onDecline: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const languages = state.languages?.length ? state.languages : ["en"];
  const [language, setLanguage] = useState(languages[0]);
  const copy = state.copy?.[language] ?? fallbackCopy(state);
  const c = useColors();
  const s = useThemedStyles(styles);

  if (!state.available) {
    return (
      <View accessibilityLabel="Healthcare" style={[s.card, { borderColor: c.hairline }]}>
        <Text style={s.title}>Healthcare isn&apos;t available in {state.jurisdiction.name}.</Text>
        {state.storage_reason ? <Text style={[s.small, s.secondary, { marginTop: space(1) }]}>{state.storage_reason}</Text> : null}
        <Pressable
          onPress={onDecline}
          accessibilityRole="button"
          style={({ pressed }) => [s.outline, { marginTop: space(3), alignSelf: "flex-start" }, pressed && { backgroundColor: c.surfaceHover }]}
        >
          <Text style={[s.small, s.secondary, { fontFamily: fonts.medium }]}>Choose another companion</Text>
        </Pressable>
      </View>
    );
  }

  const agreeOff = !ageConfirmed || busy;

  return (
    <Animated.View entering={FadeIn.duration(250)} accessibilityLabel="Healthcare consent" style={s.card}>
      <View style={s.top}>
        <Text style={s.eyebrow}>{copy.eyebrow}</Text>
        {languages.length > 1 && (
          <View accessibilityLabel="Language" style={s.languages}>
            {languages.map((code) => {
              const on = code === language;
              return (
                <Pressable
                  key={code}
                  onPress={() => setLanguage(code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  hitSlop={6}
                  style={({ pressed }) => [
                    s.language,
                    on ? { borderColor: c.brandBorder, backgroundColor: c.brandSoft } : { borderColor: c.hairline },
                    pressed && !on && { backgroundColor: c.surfaceHover },
                  ]}
                >
                  <Text style={[s.small, { color: on ? c.ink : c.inkSecondary }]}>{LANGUAGE_NAMES[code] ?? code}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      <Text style={[s.title, { marginTop: space(1) }]}>{copy.title}</Text>
      <View style={s.points}>
        {copy.points.map((point) => (
          <View key={point} style={s.point}>
            <View style={s.bullet} />
            <Text style={[s.small, s.relaxed, s.secondary, { flex: 1 }]}>{point}</Text>
          </View>
        ))}
      </View>
      {state.laws.length > 0 && (
        <Text style={[s.small, s.relaxed, { marginTop: space(2), color: c.inkMuted }]}>
          {copy.given_under}{" "}
          {state.laws.map((law, i) => (
            <Text key={law.name}>
              {i > 0 && (i === state.laws.length - 1 ? (AND[language] ?? " and ") : ", ")}
              {law.url ? (
                <Text
                  onPress={() => void WebBrowser.openBrowserAsync(law.url)}
                  accessibilityRole="link"
                  style={{ textDecorationLine: "underline" }}
                >
                  {law.name}
                </Text>
              ) : (
                law.name
              )}
            </Text>
          ))}
          .
        </Text>
      )}
      <Pressable
        onPress={() => setAgeConfirmed((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ageConfirmed }}
        style={s.check}
      >
        <View style={[s.box, ageConfirmed && { backgroundColor: c.brand, borderColor: c.brand }]}>
          {ageConfirmed && (
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 6 9 17l-5-5" />
            </Svg>
          )}
        </View>
        <Text style={[s.body, { flex: 1 }]}>{copy.age_label}</Text>
      </Pressable>
      {error ? <Text style={[s.small, { marginTop: space(2), color: c.bandLow }]}>{error}</Text> : null}
      <View style={s.actions}>
        <Pressable
          onPress={() => onAgree(language)}
          disabled={agreeOff}
          accessibilityRole="button"
          accessibilityState={{ disabled: agreeOff }}
          style={({ pressed }) => [
            s.agree,
            pressed && { backgroundColor: c.brandDark },
            agreeOff && { opacity: 0.5 },
          ]}
        >
          <Text style={[s.body, { color: "#ffffff", fontFamily: fonts.medium }]}>{busy ? "…" : copy.agree}</Text>
        </Pressable>
        <Pressable
          onPress={onDecline}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [s.outline, s.declinePad, pressed && { backgroundColor: c.surfaceHover }]}
        >
          <Text style={[s.body, s.secondary]}>{copy.decline}</Text>
        </Pressable>
      </View>
      <Text style={[s.small, { marginTop: space(2), color: c.inkMuted }]}>{copy.footer}</Text>
    </Animated.View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    card: {
      borderRadius: radius["2xl"],
      borderWidth: 1,
      borderColor: c.brandBorder,
      backgroundColor: c.surface,
      paddingHorizontal: space(4),
      paddingVertical: space(4),
    },
    top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space(3) },
    eyebrow: {
      flex: 1,
      fontSize: fontSize.xs,
      fontFamily: fonts.medium,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: c.brand,
    },
    languages: { flexDirection: "row", flexShrink: 0, gap: space(1) },
    language: { borderRadius: radius.full, borderWidth: 1, paddingHorizontal: space(2.5), paddingVertical: space(0.5) },
    title: { fontSize: fontSize.sm, fontFamily: fonts.semibold, color: c.ink },
    body: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: c.ink },
    small: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.ink },
    relaxed: { lineHeight: fontSize.xs * 1.625 },
    secondary: { color: c.inkSecondary },
    points: { marginTop: space(2), gap: space(1.5) },
    point: { flexDirection: "row", gap: space(2) },
    bullet: { marginTop: 7, width: px(4), height: px(4), borderRadius: 999, backgroundColor: c.inkMuted },
    check: { marginTop: space(3), flexDirection: "row", alignItems: "flex-start", gap: space(2) },
    box: {
      marginTop: 2,
      width: px(16),
      height: px(16),
      borderRadius: radius.base,
      borderWidth: 1.5,
      borderColor: c.hairlineStrong,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    actions: { marginTop: space(3), flexDirection: "row", flexWrap: "wrap", gap: space(2) },
    agree: { borderRadius: radius.full, backgroundColor: c.brand, paddingHorizontal: space(4), paddingVertical: space(1.5) },
    outline: {
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: c.hairline,
      paddingHorizontal: space(3),
      paddingVertical: space(1.5),
    },
    declinePad: { paddingHorizontal: space(4) },
  });
