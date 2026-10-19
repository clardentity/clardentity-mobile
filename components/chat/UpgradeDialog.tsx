import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { apiFetch } from "@/lib/apiClient";
import { track } from "@/lib/analytics";
import {
  closePreviewAccess,
  loadPreviewAccess,
  openPreviewAccess,
  usePreviewAccess,
} from "@/lib/previewAccess";
import { fonts, fontSize, px, radius, space, useThemedStyles, type Colors } from "@/lib/theme";

/* The upgrade prompt, as a bento grid.
 *
 * Shown when someone reaches for a model that isn't on their plan. It is a
 * sales surface, so the honest constraint on it is that every tile has to
 * describe something we will actually ship - a locked door is annoying, a
 * locked door onto an empty room is worse.
 *
 * On a phone the grid is one column (the web's two only start at sm).
 */

type Tile = {
  title: string;
  /** The companions this tier opens - named, per the client, rather than
   *  counted, so someone can see whether the one they wanted is in it. */
  companions: string;
  body: string;
  accent?: boolean;
};

/* The four plans as specified by the client (features subject to change on
 * their side). Presentational only until billing exists: nothing here is
 * enforced, and "Notify me" is the only action. Each tier lets you choose
 * which companions you keep, up to its count; Basic's three are fixed. */
const TILES: Tile[] = [
  {
    title: "Clar-Basic · Free",
    companions: "Finder and Thought coach",
    body: "A daily allowance of prompts, no card needed - and a bonus day's allowance when you sign up. Bring your profile over from another assistant.",
  },
  {
    title: "Clar-Pro · $20/mo",
    companions: "Any 5 of the 8 companions",
    body: "Your pick - Decision-making and Co-Creative are the usual additions. 2,000 premium credits a month.",
    accent: true,
  },
  {
    title: "Clar-Max · $40/mo",
    companions: "Any 7 of the 8 companions",
    body: "Plus your choice of model and version in Co-Creative. 5,500 elite credits a month.",
  },
  {
    title: "Clar-Ultra · $100/mo · Teams",
    companions: "All 8 companions",
    body: "Everything in Max for a whole organisation - shared workspaces, co-working and team controls - with model choice in Co-Creative. 13,000 ultra-elite credits a month.",
  },
];

export function UpgradeDialog({
  open,
  onClose,
  trigger,
}: {
  open: boolean;
  onClose: () => void;
  /** Which locked model was clicked, so the headline can name it. */
  trigger?: string | null;
}) {
  const s = useThemedStyles(styles);
  const { height } = useWindowDimensions();
  const [registered, setRegistered] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Billing does not exist yet, so the locks are the only thing keeping
  // testers out of the modes we most need feedback on. "Skip for now" opens
  // them for this account against a daily allowance the server counts.
  const preview = usePreviewAccess();
  const [opening, setOpening] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function togglePreview(open: boolean) {
    setOpening(true);
    setPreviewError(null);
    try {
      if (open) {
        await openPreviewAccess();
        track("preview_opened");
      } else {
        await closePreviewAccess();
      }
    } catch {
      setPreviewError("Couldn't reach the server - try again in a moment.");
    } finally {
      setOpening(false);
    }
  }

  async function notifyMe() {
    setBusy(true);
    try {
      const res = await apiFetch<{ email: string }>("/pro/interest", {
        method: "POST",
        body: { model: trigger?.toLowerCase() ?? null },
      });
      setRegistered(res.email);
    } catch {
      // Recording interest is not something the user can fix or should be
      // told about; closing is the honest fallback for a button whose only
      // job was to say "yes, I want this".
      onClose();
    } finally {
      setBusy(false);
    }
  }

  // Re-read on open: the allowance is spent by sending messages, which
  // happens while this dialog is closed.
  useEffect(() => {
    if (open) void loadPreviewAccess(true);
  }, [open]);

  if (!open) return null;

  return (
    // Android's back button closes it, as Escape did.
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, s.backdrop]}
        />

        <View
          accessibilityViewIsModal
          accessibilityLabel="Upgrade to Clardentity Pro"
          style={[s.dialog, { maxHeight: height * 0.85 }]}
        >
          <ScrollView contentContainerStyle={{ padding: space(5) }}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>CLARDENTITY PRO</Text>
                <Text style={s.title} accessibilityRole="header">
                  {trigger ? `${trigger} is part of Pro.` : "Unlock every mode and model."}
                </Text>
                {/* Was "add the models you already trust", which made sense
                    when these rows carried other vendors' names. They are
                    Clar tiers now and nobody trusts them yet - the pitch is
                    depth, not familiarity. */}
                <Text style={s.lede}>Keep the companion that shows its work. Give it more to work with.</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                style={({ pressed }) => [s.close, pressed && { backgroundColor: s.colors.surfaceHover }]}
              >
                <Svg viewBox="0 0 24 24" width={px(16)} height={px(16)} fill="none">
                  <Path d="M18 6 6 18M6 6l12 12" stroke={s.colors.inkMuted} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>

            <View style={s.tiles}>
              {TILES.map((tile) => (
                <View key={tile.title} style={[s.tile, tile.accent ? s.tileAccent : null]}>
                  <Text style={[s.tileTitle, tile.accent && { color: s.colors.brand }]}>{tile.title}</Text>
                  <Text style={s.tileCompanions}>{tile.companions}</Text>
                  <Text style={s.tileBody}>{tile.body}</Text>
                </View>
              ))}
            </View>

            {/* The testing door. Stated plainly rather than dressed as an
                offer: these are paid-tier companions, and this is a way to
                try them while there is nothing to pay with. */}
            <View style={s.preview}>
              {preview.unlocked ? (
                <>
                  <Text style={s.previewTitle}>The paid companions are open on this account.</Text>
                  <Text style={s.tileBody}>
                    {preview.remainingToday} of {preview.dailyLimit} messages left today in Guidance, Healthcare,
                    Co-Creative and Legal. The allowance resets daily and doesn&apos;t touch the other companions.
                  </Text>
                  <Pressable
                    onPress={() => void togglePreview(false)}
                    disabled={opening}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      s.pillButton,
                      { borderColor: s.colors.hairline },
                      pressed && { backgroundColor: s.colors.surfaceHover },
                      opening && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={[s.pillText, { color: s.colors.inkSecondary }]}>
                      {opening ? "Closing…" : "Lock them again"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={s.previewTitle}>Want to try them while Pro is being built?</Text>
                  <Text style={s.tileBody}>
                    Open every companion on this account with a daily message allowance - no card, nothing to cancel.
                  </Text>
                  <Pressable
                    onPress={() => void togglePreview(true)}
                    disabled={opening}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      s.pillButton,
                      { borderColor: s.colors.brandBorder, backgroundColor: pressed ? s.colors.brand : s.colors.brandSoft },
                      opening && { opacity: 0.6 },
                    ]}
                  >
                    {({ pressed }) => (
                      <Text style={[s.pillText, { color: pressed ? "#ffffff" : s.colors.brand }]}>
                        {opening ? "Opening…" : "Skip for now - let me use them"}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
              {previewError && <Text style={s.error}>{previewError}</Text>}
            </View>

            <View style={s.footer}>
              {/* The caller is signed in, so the address is already known -
                  the button records the interest and says where the mail
                  will go. */}
              <Text style={s.footnote}>
                {registered ? `You're on the list. We'll email ${registered} when Pro opens.` : "Pro is not open yet."}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  style={({ pressed }) => [s.footerButton, pressed && { backgroundColor: s.colors.surfaceHover }]}
                >
                  <Text style={[s.footerText, { color: s.colors.inkMuted }]}>{registered ? "Close" : "Not now"}</Text>
                </Pressable>
                {!registered && (
                  <Pressable
                    onPress={notifyMe}
                    disabled={busy}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      s.footerButton,
                      { backgroundColor: pressed ? s.colors.brandDark : s.colors.brand, paddingHorizontal: space(4) },
                      busy && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={[s.footerText, { fontFamily: fonts.medium, color: "#ffffff" }]}>
                      {busy ? "Adding…" : "Notify me"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = (c: Colors) => ({
  colors: c,
  ...StyleSheet.create({
    root: { flex: 1, alignItems: "center", justifyContent: "center", padding: space(4) },
    backdrop: { backgroundColor: "rgba(0,0,0,0.6)" },
    dialog: {
      width: "100%",
      maxWidth: 672,
      borderRadius: radius["2xl"],
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surfaceRaised,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space(4) },
    eyebrow: { fontFamily: fonts.semibold, fontSize: fontSize.xs, letterSpacing: 0.6, color: c.brand },
    title: { marginTop: space(1), fontFamily: fonts.semibold, fontSize: fontSize.xl, letterSpacing: -0.3, color: c.ink },
    lede: { marginTop: space(1), fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.inkMuted },
    close: { borderRadius: radius.md, padding: space(1.5) },
    tiles: { marginTop: space(5), gap: space(2.5) },
    tile: { borderRadius: radius.xl, borderWidth: 1, borderColor: c.hairline, backgroundColor: c.surfaceMuted, padding: space(3.5) },
    tileAccent: { borderColor: c.brandBorder, backgroundColor: c.brandSoft },
    tileTitle: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: c.ink },
    tileCompanions: { marginTop: space(1), fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.ink },
    tileBody: { marginTop: space(1), fontFamily: fonts.regular, fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.625, color: c.inkSecondary },
    preview: { marginTop: space(4), borderRadius: radius.xl, borderWidth: 1, borderColor: c.hairline, backgroundColor: c.surfaceMuted, padding: space(3.5) },
    previewTitle: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.ink },
    pillButton: {
      marginTop: space(2.5),
      alignSelf: "flex-start",
      borderRadius: radius.full,
      borderWidth: 1,
      paddingHorizontal: space(3.5),
      paddingVertical: space(1.5),
    },
    pillText: { fontFamily: fonts.medium, fontSize: fontSize.xs },
    error: { marginTop: space(2), fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.bandLow },
    footer: { marginTop: space(5), flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space(3) },
    footnote: { flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted },
    footerButton: { borderRadius: radius.full, paddingHorizontal: space(3.5), paddingVertical: space(2) },
    footerText: { fontFamily: fonts.regular, fontSize: fontSize.sm },
  }),
});
