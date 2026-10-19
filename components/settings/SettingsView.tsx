import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Appearance } from "@/components/profile/Appearance";
import { CompanionNames } from "@/components/profile/CompanionNames";
import { DeleteAccount } from "@/components/profile/DeleteAccount";
import { UpgradeDialog } from "@/components/chat/UpgradeDialog";
import { ProfileSection } from "@/components/profile/ProfileSection";
import { HealthcareConsent } from "@/components/settings/HealthcareConsent";
import { AppText } from "@/components/ui/primitives";
import { fonts, fontSize, px, space, useColors } from "@/lib/theme";

/* How the app behaves, and the account it belongs to.
 *
 * Everything used to be on one page - what Clardentity had worked out about
 * you, what colour it was drawn in, what the companions were called, the
 * plan, and the button that deletes the lot - which made the page you went
 * to to read your profile the same page you went to to change a theme, and
 * the thing you wanted was always six scrolls away from the top.
 *
 * The line between the two is what the page is *about*. The profile is about
 * you and is mostly written by the app; this is about the app and is entirely
 * written by you.
 */
export function SettingsView() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [plansOpen, setPlansOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingHorizontal: space(5), paddingTop: px(74), paddingBottom: insets.bottom + space(16) }}
      >
        <Text accessibilityRole="header" style={{ fontFamily: fonts.medium, fontSize: fontSize["2xl"], color: c.ink }}>
          Settings
        </Text>
        <AppText tone="secondary" style={{ lineHeight: fontSize.sm * 1.25 }}>
          How Clardentity looks and behaves, and what happens to your account.
        </AppText>

        <View style={{ marginTop: space(6) }}>
          <ProfileSection
            title="Appearance"
            description="The colour the app is drawn in, and whether it runs light or dark. The marketing page follows your colour too, once you are signed in."
          >
            <Appearance />
          </ProfileSection>

          <ProfileSection
            title="Companion Naming"
            description="Provide distinct identifiers for each model personality. Leave a field blank to keep its system label."
          >
            <CompanionNames />
          </ProfileSection>

          {/* The design's sidebar has no Upgrade row - it ends at the account
              card - so the plan surface lives here rather than being dropped.
              The web's Install button beside it is for installing the PWA,
              which an installed app has no use for. */}
          <ProfileSection
            title="Your Plan"
            description="See what each plan opens."
            action={
              <Pressable
                onPress={() => setPlansOpen(true)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  height: px(42),
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: px(34),
                  backgroundColor: pressed ? c.brandDark : c.brand,
                  paddingHorizontal: px(21),
                })}
              >
                <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: "#ffffff" }}>See plans</Text>
              </Pressable>
            }
          />

          <ProfileSection
            title="Healthcare"
            description="Your consent for Healthcare to use your health information, and how to take it back."
          >
            <HealthcareConsent />
          </ProfileSection>

          <ProfileSection
            title="Account Termination"
            description="Permanent deletion of every workspace, chat, attachment, and learned profile fact."
            action={<DeleteAccount />}
            style={{ borderBottomWidth: 0 }}
          />
        </View>
      </ScrollView>

      <UpgradeDialog open={plansOpen} onClose={() => setPlansOpen(false)} />
    </View>
  );
}
