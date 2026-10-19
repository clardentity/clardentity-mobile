import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { DecisionReviewData } from "@/lib/sse";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* A verdict on each option the user brought.
 *
 * Distinct from the answer above it, which compares the options on their
 * merits. This asks a different question - is each one even a fair candidate -
 * and it is the half people don't think to ask for. Shown as a panel rather
 * than folded into the prose because it is a checklist against their own
 * words, and prose is the wrong shape for that.
 *
 * Rebuilt onto the app's own scale. It used to be 12px from its heading to
 * its smallest footnote, with the bias names set in uppercase amber, and it
 * sat directly above a 20px gist - so the analysis read as small print
 * attached to the answer rather than as the other half of it. There are three
 * steps now: the option you are being told about, why, and the footnote that
 * defines the bias. The bias name is a chip rather than a shout.
 */

const ICON = px(20);

function Tick({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.25}
      strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

function Warn({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 9v4M12 17h.01" />
      <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </Svg>
  );
}

/** The named bias, or the verdict on a suggestion. A chip, in the colour of
 *  what it is saying - which is enough emphasis for a phrase that is often a
 *  dozen words of Latin. */
function Chip({ tone, children }: { tone: "sound" | "flagged"; children: ReactNode }) {
  const c = useColors();
  const [border, bg, text] =
    tone === "sound" ? [c.bandHighBorder, c.bandHighBg, c.bandHigh] : [c.cautionBorder, c.cautionBg, c.caution];
  return (
    <View
      style={{
        flexShrink: 0,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        paddingHorizontal: space(2),
        paddingVertical: 1,
      }}
    >
      <Text style={{ fontSize: fontSize.xs, fontFamily: fonts.regular, color: text }}>{children}</Text>
    </View>
  );
}

function Heading({ children, note }: { children: ReactNode; note?: string }) {
  const s = useThemedStyles(styles);
  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
      {note ? <Text style={s.headingNote}>{`  ${note}`}</Text> : null}
    </Text>
  );
}

export function DecisionReview({ review }: { review: DecisionReviewData }) {
  const c = useColors();
  const s = useThemedStyles(styles);
  const hasOptions = Boolean(review.options?.length);
  const hasSuggestions = Boolean(review.suggestions?.length);
  if (!hasOptions && !hasSuggestions) return null;

  const unsound = review.options.filter((o) => !o.sound).length;

  return (
    // The card the rest of the app is built from: white, a hairline, a 12px
    // radius. The old inset grey made it look like a quoted aside.
    <View style={s.card}>
      {hasOptions && (
        <>
          <Heading
            note={
              unsound === 0
                ? "all sound"
                : unsound === review.options.length
                  ? "all flagged"
                  : `${unsound} flagged`
            }
          >
            Your options, checked
          </Heading>

          <View style={s.list}>
            {review.options.map((option, i) => (
              <View key={i} style={s.row}>
                <View style={s.icon}>
                  {option.sound ? <Tick color={c.bandHigh} /> : <Warn color={c.caution} />}
                </View>
                <View style={s.rowBody}>
                  <View style={s.titleLine}>
                    <Text style={s.label}>{option.label}</Text>
                    {/* The bias is named here and only here. It is the reader's
                        own reasoning being described, which is the one place the
                        taxonomy label earns its keep. */}
                    {option.bias_name ? <Chip tone="flagged">{option.bias_name}</Chip> : null}
                  </View>
                  <Text style={s.why}>{option.why}</Text>
                  {option.bias_definition ? <Text style={s.definition}>{option.bias_definition}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {review.alternative ? (
        // Only ever present when every option was flagged. Telling someone all
        // their choices are compromised and stopping there is a criticism
        // rather than help.
        <View style={s.alternative}>
          <Heading>None of these are correct. Consider instead</Heading>
          <Text style={[s.why, { marginTop: space(2), fontFamily: fonts.medium, color: c.ink }]}>
            {review.alternative}
          </Text>
          {review.alternative_why ? <Text style={s.why}>{review.alternative_why}</Text> : null}
        </View>
      ) : null}

      {hasSuggestions && (
        // Decision mode's replacement for the evidence panel. Present whether
        // or not they brought options of their own: the useful output of a
        // decision question is decisions, and there is nothing to cite.
        <View style={hasOptions ? s.suggestionsDivided : undefined}>
          <Heading>One decision that&apos;s correct, and the ones that aren&apos;t</Heading>
          {/* Not numbered. A numbered list of decisions reads as a ranking,
              and three of these are things not to do - the reader has to be
              able to tell which is which at a glance, before reading a word
              of the reasoning. Tick or warning, colour, and the chip do that
              job; position does not. */}
          <View style={s.list}>
            {review.suggestions.map((sg, i) => (
              <View key={i} style={s.row}>
                <View style={s.icon}>{sg.sound ? <Tick color={c.bandHigh} /> : <Warn color={c.caution} />}</View>
                <View style={s.rowBody}>
                  <View style={s.titleLine}>
                    <Text
                      style={[
                        s.label,
                        // A struck-through decision cannot be misread as advice
                        // if someone skims only the bold line.
                        !sg.sound && {
                          color: c.inkSecondary,
                          textDecorationLine: "line-through",
                          textDecorationColor: c.caution,
                        },
                      ]}
                    >
                      {sg.decision}
                    </Text>
                    <Chip tone={sg.sound ? "sound" : "flagged"}>
                      {sg.sound ? "Correct" : (sg.bias_name ?? "Incorrect")}
                    </Chip>
                  </View>
                  <Text style={s.why}>{sg.why}</Text>
                  {!sg.sound && sg.bias_definition ? <Text style={s.definition}>{sg.bias_definition}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    card: {
      marginBottom: space(3),
      borderRadius: px(12),
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      padding: space(4),
    },
    heading: { fontSize: fontSize.sm, fontFamily: fonts.medium, color: c.ink },
    headingNote: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.inkMuted },
    list: { marginTop: space(4), gap: space(4) },
    row: { flexDirection: "row", gap: space(3) },
    icon: { marginTop: 1, flexShrink: 0 },
    rowBody: { flex: 1, minWidth: 0 },
    titleLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space(2), rowGap: space(1) },
    label: { fontSize: fontSize.sm, fontFamily: fonts.medium, color: c.ink, flexShrink: 1 },
    why: {
      marginTop: space(1),
      fontSize: fontSize.sm,
      lineHeight: fontSize.sm * 1.625,
      fontFamily: fonts.regular,
      color: c.inkSecondary,
    },
    definition: {
      marginTop: space(1),
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.625,
      fontFamily: fonts.regular,
      color: c.inkMuted,
    },
    alternative: {
      marginTop: space(4),
      borderRadius: px(12),
      borderWidth: 1,
      borderColor: c.brandBorder,
      backgroundColor: c.brandSoft,
      padding: space(4),
    },
    suggestionsDivided: {
      marginTop: space(5),
      borderTopWidth: 1,
      borderTopColor: c.hairline,
      paddingTop: space(5),
    },
  });
