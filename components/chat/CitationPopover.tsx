import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import type { Evidence } from "@/lib/sse";
import { fonts, fontSize, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";
import { PopoverSheet } from "@/components/chat/PopoverSheet";

/* Wording ported from the deleted EvidencePanel so a score reads the same
   way wherever it appears - the citation popover is now the only place any
   of this shows, but readers who saw the evidence panel before shouldn't
   find the same number described differently here. */

/** Every score is a percentage of factual evidence, worded the same way
 *  wherever it appears. "only" is the qualifier that carries the meaning: a
 *  claim at 0 has no factual evidence and one at 100 has it outright, but
 *  anything in between rests on *only* that much - which is the part a
 *  reader skimming a number tends to miss. So 0 and 100 read plainly and
 *  1-99 are qualified. */
function factualEvidence(fraction: number): string {
  const pct = Math.round(fraction * 100);
  const qualified = pct > 0 && pct < 100 ? " only" : "";
  return `${pct}% Factual Evidence${qualified}`;
}

type ToneKey = keyof Pick<
  Colors,
  "bandHigh" | "bandModerate" | "bandMid" | "caution" | "bandLow" | "inkSecondary" | "inkMuted"
>;

/* The claim-level verdict, same five-tier vocabulary and wording the deleted
   EvidencePanel used - a claim can cite several sources, so this belongs to
   the claim the marker's evidence sits inside, not to that one source. The
   two harshest tiers are stated as appearances, not findings, for the same
   reason EvidencePanel's did: a score is evidence about how a claim reads
   against the sources at hand, not an accusation about the author's intent. */
const TIERS: Record<string, { label: string; meaning: string; text: ToneKey }> = {
  verifiable_fact: {
    label: "Verifiable Fact",
    meaning: "Directly confirmed by the sources cited here.",
    text: "bandHigh",
  },
  probable_fact: {
    label: "Probable Fact",
    meaning: "Strongly supported, though short of direct confirmation.",
    text: "bandModerate",
  },
  gray_area: {
    label: "Unverifiable",
    meaning: "Plausible, but these sources neither confirm nor refute it.",
    text: "bandMid",
  },
  distorted: {
    label: "Appears as distorted",
    meaning: "Rests on something real, but the framing overstates it.",
    text: "caution",
  },
  fabricated: {
    label: "Appears as fabricated / malicious",
    meaning: "Nothing found here backs this up. Worth checking yourself.",
    text: "bandLow",
  },
  // Nothing was found to check against - neither confirmed nor disproved.
  // Neutral, not alarmed: it is a gap in what could be checked, not a
  // finding about the claim.
  unsupported: {
    label: "Not verified",
    meaning: "No source was found to check this against. Not disproved - not confirmed either.",
    text: "inkSecondary",
  },
  // Zero evidence is correct and expected here - it was never claimed to be
  // sourced - so this reads as neutral disclosure, not a failed check, and
  // deliberately does not share fabricated's alarm styling.
  opinion: {
    label: "Stated as an opinion",
    meaning: "Clardentity AI's own view, not a sourced fact.",
    text: "inkSecondary",
  },
};

function supportPhrase(e: Evidence): string {
  if (e.entailment_label === "full") return "Backs this directly";
  if (e.entailment_label === "partial") return "Partly backs this";
  if (e.entailment_label === "none") return "Doesn't back this";
  return "Bearing unclear";
}

const SUPPORT_BANDS: [number, ToneKey][] = [
  [0.76, "bandHigh"],
  [0.51, "bandModerate"],
  [0.26, "bandMid"],
  [0, "bandLow"],
];
function supportTone(score: number | null): ToneKey {
  if (score === null) return "inkMuted";
  return SUPPORT_BANDS.find(([min]) => score >= min)?.[1] ?? "bandLow";
}

function relevancePhrase(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 0.75) return "closely on topic";
  if (score >= 0.5) return "related";
  return "loosely related";
}

function credibilityPhrase(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 0.8) return "source looks reliable";
  if (score >= 0.6) return "source looks reasonable";
  return "source is questionable";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ExternalLinkIcon({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <Path d="M15 3h6v6M10 14 21 3" />
    </Svg>
  );
}

/* The marker sits inside the answer's own <Text>, so it is a nested Text
 * with onPress rather than a Pressable - a View inside running text would
 * break the line. The web's popover was a portal positioned by measuring the
 * marker (and a long history of getting that wrong inside ResponseFlip's 3D
 * transform); natively the card is a bottom sheet, which needs no position
 * and renders in its own window above everything, flip card included. */
export function CitationPopover({
  marker,
  evidence,
  claimScore,
  entailmentLabel,
}: {
  marker: number;
  evidence: Evidence | null;
  /** The owning claim's overall score (0-100) and tier - a verdict on the
   *  claim as a whole, shown alongside this one source's own detail. */
  claimScore?: number | null;
  entailmentLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const c = useColors();
  const s = useThemedStyles(styles);

  if (!evidence) {
    return <Text style={s.markerDead}>{` [${marker}]`}</Text>;
  }

  const tier = entailmentLabel ? TIERS[entailmentLabel] : undefined;
  const isWeb = evidence.source_type === "web" && Boolean(evidence.url);
  const secondary = isWeb ? evidence.credibility_score : evidence.relevance_score;
  const facts = [
    supportPhrase(evidence),
    isWeb ? credibilityPhrase(evidence.credibility_score) : relevancePhrase(evidence.relevance_score),
  ].filter((f): f is string => Boolean(f));

  return (
    <>
      <Text
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Source ${marker}: ${evidence.document_filename}`}
        suppressHighlighting={false}
        style={s.marker}
      >
        {` ${marker} `}
      </Text>
      {/* A Modal renders nothing while hidden, so the running text holds no
          extra inline node until the marker is tapped. */}
      <PopoverSheet open={open} onClose={() => setOpen(false)} label={`Source: ${evidence.document_filename}`}>
        {isWeb ? (
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(evidence.url!)}
            accessibilityRole="link"
            style={s.linkRow}
          >
            {({ pressed }) => (
              <>
                <Text style={[s.linkText, pressed && { textDecorationLine: "underline" }]}>
                  {evidence.document_filename}
                </Text>
                <ExternalLinkIcon color={c.brand} />
              </>
            )}
          </Pressable>
        ) : (
          <Text style={s.title}>{evidence.document_filename}</Text>
        )}
        {isWeb && <Text style={[s.small, s.muted]}>{hostOf(evidence.url!)}</Text>}

        {tier && (
          <View style={s.section}>
            <Text style={s.small}>
              <Text style={{ fontFamily: fonts.semibold, color: c[tier.text] }}>{tier.label}</Text>
              {claimScore !== null && claimScore !== undefined && entailmentLabel !== "opinion" && (
                <Text style={[s.muted, s.nums]}>{`  ${factualEvidence(claimScore / 100)}`}</Text>
              )}
            </Text>
            <Text style={[s.small, s.muted]}>{tier.meaning}</Text>
          </View>
        )}

        {evidence.excerpt ? (
          <View style={s.excerpt}>
            <Text numberOfLines={4} style={[s.small, s.excerptText]}>
              {evidence.excerpt}
            </Text>
          </View>
        ) : null}

        <Text style={[s.small, s.muted, s.section]}>
          <Text style={[s.nums, { fontFamily: fonts.semibold, color: c[supportTone(evidence.support_score)] }]}>
            {evidence.support_score !== null
              ? `${factualEvidence(evidence.support_score)} to support this`
              : "Not yet measured"}
          </Text>
          {facts.length > 0 && <Text>{`  ${facts.join(" · ")}`}</Text>}
          {/* Only shown when it was actually measured - a bare "credibility
              ?" advertised a gap in the pipeline as if it were a property
              of the source. */}
          {secondary !== null && (
            <Text style={s.nums}>{`  (${isWeb ? "credibility" : "relevance"} ${Math.round(secondary * 100)}%)`}</Text>
          )}
        </Text>

        {evidence.credibility_note ? (
          <Text style={[s.small, s.muted, s.note]}>{evidence.credibility_note}</Text>
        ) : null}
      </PopoverSheet>
    </>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    markerDead: { color: c.inkMuted, fontSize: fontSize.xs, fontFamily: fonts.regular },
    marker: {
      color: c.brand,
      backgroundColor: c.brandSoft,
      fontSize: fontSize.xs,
      fontFamily: fonts.semibold,
      borderRadius: 4,
    },
    linkRow: { flexDirection: "row", alignItems: "center", gap: space(1), alignSelf: "flex-start" },
    linkText: { color: c.brand, fontFamily: fonts.medium, fontSize: fontSize.sm, flexShrink: 1 },
    title: { color: c.ink, fontFamily: fonts.medium, fontSize: fontSize.sm },
    small: { fontSize: fontSize.xs, fontFamily: fonts.regular, lineHeight: fontSize.xs * 1.5, color: c.ink },
    muted: { color: c.inkMuted },
    nums: { fontVariant: ["tabular-nums"] },
    section: { marginTop: space(2) },
    excerpt: {
      marginTop: space(2),
      borderLeftWidth: 2,
      borderLeftColor: c.hairline,
      paddingLeft: space(2),
    },
    excerptText: { lineHeight: fontSize.xs * 1.625, color: c.inkSecondary },
    note: { marginTop: space(1), fontStyle: "italic", lineHeight: fontSize.xs * 1.625 },
  });
