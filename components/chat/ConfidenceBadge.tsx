import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Claim } from "@/lib/sse";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";
import { PopoverSheet } from "@/components/chat/PopoverSheet";

/** SRS §9.3 bands. Colour is deliberately the strongest signal on a message,
 *  so these are the only saturated hues in the chat surface. */
function bandStyle(c: Colors, band: string): { bg: string; text: string; border: string; dot: string } {
  switch (band) {
    case "Likely Fact":
      return { bg: c.bandHighBg, text: c.bandHigh, border: c.bandHighBorder, dot: c.bandHigh };
    case "Plausible":
      return { bg: c.bandMidBg, text: c.bandMid, border: c.bandMidBorder, dot: c.bandMid };
    case "Needs Verification":
      return { bg: c.bandLowBg, text: c.bandLow, border: c.bandLowBorder, dot: c.bandLow };
    default:
      return { bg: c.surfaceSunken, text: c.inkSecondary, border: c.hairline, dot: c.inkMuted };
  }
}

/* What the band means, in one sentence each - the badge alone was a red
 * label with a number, and the question that came back was "what does it
 * give me?". The breakdown below it answers with the claim counts. */
const BAND_MEANING: Record<string, string> = {
  "Likely Fact": "Most of the claims in this answer are directly backed by the sources cited.",
  Plausible: "The claims are partly backed - sound, but short of direct confirmation.",
  "Needs Verification":
    "Few or none of the claims could be matched to a source. A claim marked not checked hasn't been disproved - no source was found to check it against - so this is worth verifying before you rely on it.",
};

/* Same five-tier vocabulary as the citation popover, counted up. */
const TIER_LABELS: Array<[string, string]> = [
  ["verifiable_fact", "backed directly"],
  ["probable_fact", "strongly supported"],
  ["gray_area", "sources neither confirm nor refute"],
  ["distorted", "overstated"],
  ["fabricated", "checked - nothing backs it"],
  ["unsupported", "not checked - no source found"],
  ["opinion", "stated as opinion"],
];

/* The explanation opens as a bottom sheet rather than a box under the
 * badge: on a phone the badge sits at the right edge of the message row, and
 * a sheet needs no outside-tap or Escape handling - the Modal brings both. */
export function ConfidenceBadge({
  band,
  score,
  claims = [],
}: {
  band: string;
  score: number | null;
  /** The scored claims behind the band; drives the breakdown. */
  claims?: Claim[];
}) {
  const [open, setOpen] = useState(false);
  const c = useColors();
  const s = useThemedStyles(styles);
  const tone = bandStyle(c, band);

  const counts = new Map<string, number>();
  for (const claim of claims) {
    const key = claim.entailment_label ?? "gray_area";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const factual = claims.filter((cl) => cl.entailment_label !== "opinion");
  const backed = factual.filter(
    (cl) => cl.entailment_label === "verifiable_fact" || cl.entailment_label === "probable_fact",
  ).length;

  return (
    <>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${band}${score !== null ? `, ${Math.round(score)} out of 100` : ""}. What this means`}
        hitSlop={8}
        style={({ pressed }) => [
          s.badge,
          { backgroundColor: tone.bg, borderColor: tone.border },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={[s.dot, { backgroundColor: tone.dot }]} />
        <Text style={[s.badgeText, { color: tone.text }]} numberOfLines={1}>
          {band}
        </Text>
        {/* The web hides the number below its sm breakpoint - the band beside
            it already says what it means, and keeping it cost the mode name
            on the left its last few characters. This app is only ever that
            narrow layout, so the number lives in the sheet instead. */}
        <Svg
          width={10}
          height={10}
          viewBox="0 0 24 24"
          fill="none"
          stroke={tone.text}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.7, transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        >
          <Path d="m6 9 6 6 6-6" />
        </Svg>
      </Pressable>
      <PopoverSheet open={open} onClose={() => setOpen(false)} label="What this score means">
        <Text style={s.heading}>
          {band}
          {score !== null && <Text style={s.headingScore}>{`  ${Math.round(score)} / 100`}</Text>}
        </Text>
        <Text style={[s.body, { marginTop: space(1), color: c.inkSecondary }]}>
          {BAND_MEANING[band] ?? "How well the claims in this answer are grounded in cited sources."}
        </Text>
        {claims.length > 0 && (
          <>
            <Text style={[s.body, { marginTop: space(2), fontFamily: fonts.medium, color: c.ink }]}>
              {backed} of {factual.length} factual {factual.length === 1 ? "claim" : "claims"} backed by a source
            </Text>
            <View style={{ marginTop: space(1), gap: space(0.5) }}>
              {TIER_LABELS.filter(([tier]) => counts.get(tier)).map(([tier, label]) => (
                <View key={tier} style={s.countRow}>
                  <Text style={[s.body, s.muted]}>{label}</Text>
                  <Text style={[s.body, s.muted, s.nums]}>{counts.get(tier)}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.body, s.muted, { marginTop: space(2) }]}>
              Open the full answer and tap a numbered marker to see the source behind each claim.
            </Text>
          </>
        )}
      </PopoverSheet>
    </>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
      gap: space(1.5),
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: space(2),
      paddingVertical: space(0.5),
    },
    dot: { width: px(6), height: px(6), borderRadius: 999 },
    badgeText: { fontSize: fontSize.xs, fontFamily: fonts.medium },
    heading: { fontSize: fontSize.sm, fontFamily: fonts.semibold, color: c.ink },
    headingScore: { fontFamily: fonts.regular, color: c.inkMuted, fontVariant: ["tabular-nums"] },
    body: { fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.625, fontFamily: fonts.regular, color: c.ink },
    muted: { color: c.inkMuted },
    nums: { fontVariant: ["tabular-nums"] },
    countRow: { flexDirection: "row", justifyContent: "space-between", gap: space(3) },
  });
