import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setConsent, useConsent, useConsentSettled } from "@/lib/consent";
import { fonts, fontSize, radius, space, useColors } from "@/lib/theme";

/* The analytics consent banner.
 *
 * Two buttons of equal weight. A banner where "accept" is a filled button
 * and "decline" is grey six-point text is a dark pattern with a legal
 * opinion attached, and this product's whole pitch is that it does not do
 * that sort of thing. Declining is one tap, is remembered, and costs the
 * user nothing.
 *
 * It only appears when there is something to consent to: no analytics key
 * configured means no banner at all, which is also what local development
 * and CI see.
 */
export function ConsentBanner() {
  const consent = useConsent();
  const settled = useConsentSettled();
  const configured = Boolean(process.env.EXPO_PUBLIC_POSTHOG_KEY);
  const insets = useSafeAreaInsets();
  const c = useColors();

  // Nothing until the stored answer is in. Asking a question for one frame
  // and withdrawing it is worse than asking it a moment later.
  if (!settled || !configured || consent !== "unset") return null;

  const button = {
    flex: 1,
    alignItems: "center",
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  } as const;

  return (
    <View
      accessibilityLabel="Analytics consent"
      // Above the composer, below a modal. Fixed to the bottom, so it never
      // covers the thing someone came here to type into for long.
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        padding: space(3),
        paddingBottom: space(3) + insets.bottom,
      }}
    >
      <View
        style={{
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: c.hairline,
          backgroundColor: c.surfaceRaised,
          padding: space(4),
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 16,
        }}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.ink }}>Help us see what works?</Text>
        <Text
          style={{
            marginTop: space(1.5),
            fontFamily: fonts.regular,
            fontSize: fontSize.xs,
            lineHeight: fontSize.xs * 1.625,
            color: c.inkSecondary,
          }}
        >
          We&apos;d like to count which features get used and where people get stuck. Never your questions,
          your answers, your files or your email - those stay out of it entirely. Signing in works either way.
        </Text>
        <View style={{ marginTop: space(3), flexDirection: "row", alignItems: "center", gap: space(2) }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConsent("granted")}
            hitSlop={{ top: 8, bottom: 8 }}
            style={({ pressed }) => [
              button,
              { borderColor: c.brandBorder, backgroundColor: pressed ? c.brand : c.brandSoft },
            ]}
          >
            {({ pressed }) => (
              <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.xs, color: pressed ? "#ffffff" : c.brand }}>
                Allow
              </Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConsent("denied")}
            hitSlop={{ top: 8, bottom: 8 }}
            style={({ pressed }) => [
              button,
              { borderColor: c.hairline, backgroundColor: pressed ? c.surfaceHover : "transparent" },
            ]}
          >
            {({ pressed }) => (
              <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.xs, color: pressed ? c.ink : c.inkSecondary }}>
                No thanks
              </Text>
            )}
          </Pressable>
        </View>
        <Text style={{ marginTop: space(2.5), fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted }}>
          <Text accessibilityRole="link" onPress={() => router.push("/privacy")}>
            What we collect
          </Text>
          {" · "}
          <Text accessibilityRole="link" onPress={() => router.push("/terms")}>
            Terms
          </Text>
        </Text>
      </View>
    </View>
  );
}
