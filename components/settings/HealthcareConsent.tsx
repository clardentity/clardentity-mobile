import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { authErrorMessage } from "@/lib/auth";
import { fetchHealthConsent, withdrawHealthConsent } from "@/lib/healthConsent";
import type { HealthConsentState } from "@/lib/sse";
import { AppText } from "@/components/ui/primitives";
import { fonts, fontSize, px, radius, space, useColors } from "@/lib/theme";

/* Where Healthcare's consent can be read and taken back. Withdrawing is as
 * easy as giving was, which GDPR Art. 7(3) and India's DPDP Act s.6(4) both
 * ask for - and it deletes every chat with a Healthcare message in it, which
 * both also expect of data held on consent (DPDP s.8(7), GDPR Art. 17(1)(b)).
 * Deleting cannot be undone, so the button asks once more. */
export function HealthcareConsent() {
  const c = useColors();
  const [state, setState] = useState<HealthConsentState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHealthConsent()
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch(() => {
        if (!cancelled) setNote("Couldn't load your Healthcare consent just now.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function withdraw() {
    setBusy(true);
    setNote(null);
    try {
      const next = await withdrawHealthConsent();
      setState(next);
      setConfirming(false);
      setNote(
        `Consent withdrawn, and ${next.deleted_conversations} chat${next.deleted_conversations === 1 ? "" : "s"} with Healthcare messages deleted. Healthcare will ask again before it answers.`,
      );
    } catch (err) {
      setNote(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!state) return note ? <AppText tone="secondary">{note}</AppText> : null;

  return (
    <View style={{ gap: space(3) }}>
      <AppText tone="secondary">
        {state.given && state.given_at
          ? `Given on ${new Date(state.given_at).toLocaleDateString()} under the rules for ${state.jurisdiction.name}.`
          : `Not given. Healthcare asks before it answers, under the rules for ${state.jurisdiction.name}.`}
        {state.storage === "transient" && " There, Healthcare chats are never saved - each one is temporary."}
      </AppText>
      {state.given && !confirming && (
        <Pill onPress={() => setConfirming(true)} height={42}>
          <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.ink }}>Withdraw consent</Text>
        </Pill>
      )}
      {state.given && confirming && (
        <View style={{ gap: space(2), borderRadius: radius.xl, borderWidth: 1, borderColor: c.hairline, padding: space(3) }}>
          <AppText>Withdrawing deletes every chat that has a Healthcare message in it. This can&apos;t be undone.</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
            <Pill onPress={() => void withdraw()} disabled={busy} height={38} danger>
              <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.bandLow }}>
                {busy ? "Withdrawing…" : "Withdraw and delete"}
              </Text>
            </Pill>
            <Pill onPress={() => setConfirming(false)} disabled={busy} height={38} quiet>
              <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.inkSecondary }}>Keep consent</Text>
            </Pill>
          </View>
        </View>
      )}
      {note && (
        <AppText size="xs" tone="secondary">
          {note}
        </AppText>
      )}
    </View>
  );
}

/** The page's outline pill (`rounded-[34px] border px-[21px]`), in the three
 *  weights this control uses. */
function Pill({
  children,
  onPress,
  disabled,
  height,
  danger,
  quiet,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  height: number;
  danger?: boolean;
  quiet?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={{ top: Math.max(0, (44 - px(height)) / 2), bottom: Math.max(0, (44 - px(height)) / 2) }}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        height: px(height),
        flexDirection: "row",
        alignItems: "center",
        borderRadius: px(34),
        borderWidth: 1,
        borderColor: danger ? c.bandLowBorder : quiet ? c.hairline : c.hairlineStrong,
        backgroundColor: pressed ? (danger ? c.bandLowBg : c.surfaceHover) : danger ? c.surface : "transparent",
        paddingHorizontal: px(height === 42 ? 21 : 18),
        opacity: disabled && danger ? 0.5 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
