import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useColors } from "@/lib/theme";

/* The small mark in the empty middle of each landing card - on phones and
 * desktop alike. One symmetrical shape per card that says what the card says, drawn
 * as a fine outline in a slightly pink hairline (the card border's colour
 * with a touch of the accent: plum in light, pink in dark).
 *
 * Centred in the space the card's text leaves. On the web the mark measured
 * its siblings itself; React Native has no DOM to walk, so the card measures
 * its text blocks (onLayout) and passes the midpoint in as `center` - see
 * the cards in LandingPage. Nothing else on the card moves - the mark sits
 * behind the text. */

// Each colour theme's own mark colour, from the Card_design files (1 default,
// 2 teal, 3 indigo, 4 plum velvet): the theme's accent, with plum velvet's
// drawn a touch lighter. In lib/theme as `cardMark`.
const LINE = 2.6; // in the 100-unit box: about 1.8px at the card's mark size

/** A four-point sparkle with long, thin arms. */
function spark(cx: number, cy: number, r: number): string {
  const a = r * 0.08, b = r * 0.14, w = r * 0.55;
  return `M${cx} ${cy - r} C${cx + a} ${cy - b} ${cx + b} ${cy - a} ${cx + w} ${cy} C${cx + b} ${cy + a} ${cx + a} ${cy + b} ${cx} ${cy + r} C${cx - a} ${cy + b} ${cx - b} ${cy + a} ${cx - w} ${cy} C${cx - b} ${cy - a} ${cx - a} ${cy - b} ${cx} ${cy - r}Z`;
}

type Ink = { edge: string; behind: string };

function shapes({ edge, behind }: Ink): Record<string, ReactNode> {
  const line = { fill: "none", stroke: edge } as const;
  const round = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

  const Spark = ({ cx, cy, r, w = LINE, back = false }: { cx: number; cy: number; r: number; w?: number; back?: boolean }) => (
    <Path d={spark(cx, cy, r)} fill={back ? behind : "none"} stroke={edge} strokeWidth={w} strokeLinejoin="round" />
  );
  const Ring = ({ cx, cy, r, w = LINE }: { cx: number; cy: number; r: number; w?: number }) => (
    <Circle cx={cx} cy={cy} r={r} {...line} strokeWidth={w} />
  );

  return {
    // Ask: one question, sent out to the three models best suited for it -
    // round dots, each line starting well clear of the star (so the three
    // don't bunch where they meet) and stopping clear of each model.
    "Ask.": (
      <>
        <Spark cx={50} cy={80} r={16} />
        <Path d="M42.5 54.6 L24.9 32.6 M50.0 52.0 L50.0 27.0 M57.5 54.6 L75.1 32.6" {...line} strokeWidth={2.8} strokeDasharray={[0.1, 7]} strokeLinecap="round" />
        <Ring cx={18} cy={24} r={6} />
        <Ring cx={50} cy={16} r={6} />
        <Ring cx={82} cy={24} r={6} />
      </>
    ),
    // Check: a ring of sources around the answer, and a check.
    "Check.": (
      <>
        <Ring cx={50} cy={50} r={40} />
        <Path d="M50 10 V22 M50 78 V90 M10 50 H22 M78 50 H90" {...line} strokeWidth={LINE} {...round} />
        <Path d="M36 51 L46 61 L65 40" {...line} strokeWidth={3} {...round} />
      </>
    ),
    // See: an eye, with a star for what it sees.
    "See.": (
      <>
        <Path d="M8 50 Q50 12 92 50 Q50 88 8 50Z" {...line} strokeWidth={LINE} strokeLinejoin="round" />
        <Spark cx={50} cy={50} r={17} w={2.4} />
      </>
    ),
    // Finder: a tall four-point star with the ace of spades at its heart -
    // the card that finds it (after Aditya's sketch; the ace is filled).
    knowing: (
      <>
        <Path d="M50 4 Q55 40 75 50 Q55 60 50 96 Q45 60 25 50 Q45 40 50 4Z" {...line} strokeWidth={LINE} strokeLinejoin="round" />
        {/* the ace at about two-thirds size, so it sits inside the star's
            waist with room around it - 0.62 about the centre, written out as
            the single translate it comes to */}
        <Path
          d="M50 38 C47 43 40.5 46.5 40.5 51.5 C40.5 55.6 44.6 57.4 47.8 55.4 L46.2 62 H53.8 L52.2 55.4 C55.4 57.4 59.5 55.6 59.5 51.5 C59.5 46.5 53 43 50 38Z"
          transform="translate(19 19) scale(0.62)"
          fill={edge}
        />
      </>
    ),
    // Decision-making - weigh options: a dotted path forking into two
    // options, every line stopping short of what it joins.
    decision: (
      <>
        <Path d="M50 94 L50 67 M46.0 54.2 L33.6 36.0 M54.0 54.2 L66.4 36.0" {...line} strokeWidth={2.8} strokeDasharray={[0.1, 6]} strokeLinecap="round" />
        <Spark cx={24} cy={22} r={13} w={2.4} />
        <Spark cx={76} cy={22} r={13} w={2.4} />
        <Ring cx={50} cy={60} r={3.5} w={2.2} />
      </>
    ),
    // Thought Coach - a half-formed idea: half drawn, half still dotted.
    thinking: (
      <>
        <Path d="M50 12 A38 38 0 0 1 50 88" {...line} strokeWidth={LINE} />
        <Path d="M50 12 A38 38 0 0 0 50 88" {...line} strokeWidth={2.4} strokeDasharray={[3, 5]} strokeLinecap="round" />
        <Spark cx={50} cy={50} r={15} w={2.4} />
      </>
    ),
    // Learning - from the ground up: a tree of what you know, branching from
    // a star, 1 - 2 - 3 - 6 (after Aditya's sketch: the lines stop short of
    // each node).
    learning: (
      <>
        <Spark cx={50} cy={10} r={10} w={2.4} />
        <Path d="M43.1 19.1 L37.5 26.4 M56.9 19.1 L62.5 26.4 M30.4 35.6 L19.6 49.4 M37.3 35.8 L46.7 49.2 M62.7 35.8 L53.3 49.2 M69.6 35.6 L80.4 49.4 M13.9 59.4 L7.9 75.1 M18.1 59.4 L24.1 75.1 M47.9 59.4 L41.9 75.1 M52.1 59.4 L58.1 75.1 M81.9 59.4 L75.9 75.1 M86.1 59.4 L92.1 75.1" {...line} strokeWidth={2} strokeLinecap="round" />
        <Ring cx={34} cy={31} r={3.4} w={2.2} />
        <Ring cx={66} cy={31} r={3.4} w={2.2} />
        <Ring cx={16} cy={54} r={3.4} w={2.2} />
        <Ring cx={50} cy={54} r={3.4} w={2.2} />
        <Ring cx={84} cy={54} r={3.4} w={2.2} />
        <Ring cx={6} cy={80} r={2.8} w={2} />
        <Ring cx={26} cy={80} r={2.8} w={2} />
        <Ring cx={40} cy={80} r={2.8} w={2} />
        <Ring cx={60} cy={80} r={2.8} w={2} />
        <Ring cx={74} cy={80} r={2.8} w={2} />
        <Ring cx={94} cy={80} r={2.8} w={2} />
      </>
    ),
    // Co-Creative - made together: two circles overlapping, a small spark
    // where they meet.
    creative: (
      <>
        <Ring cx={36} cy={50} r={26} />
        <Ring cx={64} cy={50} r={26} />
        <Spark cx={50} cy={50} r={7} w={2} />
      </>
    ),
    // Guidance (Mentoring's mark, kept when it became Guidance): a guiding
    // star, and a path down to you.
    guidance: (
      <>
        <Spark cx={50} cy={24} r={18} />
        <Path d="M50 48 V80" {...line} strokeWidth={2.4} strokeDasharray={[2, 6]} strokeLinecap="round" />
        <Ring cx={50} cy={86} r={4.5} w={2.4} />
      </>
    ),
    // Healthcare: a heart with a pulse running through it.
    healthcare: (
      <>
        <Path d="M50 84C22 64 10 49 10 34C10 21 19 13 30 13C39 13 46 18 50 26C54 18 61 13 70 13C81 13 90 21 90 34C90 49 78 64 50 84Z" {...line} strokeWidth={LINE} strokeLinejoin="round" />
        <Path d="M17 46H35L41 34L51 60L58 46H83" {...line} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    // Legal: balanced scales, with a small star at the top.
    legal: (
      <>
        <Path d="M50 14 V86 M30 86 H70 M18 30 H82" {...line} strokeWidth={LINE} strokeLinecap="round" />
        <Path d="M18 30 L8 56 H28 Z M82 30 L72 56 H92 Z" {...line} strokeWidth={2.2} strokeLinejoin="round" />
        <Spark cx={50} cy={14} r={8} w={2} back />
      </>
    ),
  };
}

/** Drawn in a 111 x 100 box rather than a square. */
const WIDE = new Set<string>([]);

/** `shape`: a mode value ("knowing", "decision"...) or a step word ("Ask.").
 *  `center`: where the mark's middle sits, in card px from the card's top.
 *  `size`: the mark's size in card px. */
export function CardEmboss({ shape, center, size }: { shape: string; center: number; size: number }) {
  const c = useColors();
  // the card's own colour, where an outline must hide what passes behind it
  const art = shapes({ edge: c.cardMark, behind: c.surfaceMuted })[shape];
  if (!art) return null;
  // a row of shapes needs width more than height
  const wide = WIDE.has(shape);
  const width = wide ? size * 1.11 : size;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="card-emboss"
      style={{ position: "absolute", left: "50%", top: center, width, height: size, marginLeft: -width / 2, marginTop: -size / 2 }}
    >
      <Svg viewBox={wide ? "0 0 111 100" : "0 0 100 100"} width={width} height={size}>
        {art}
      </Svg>
    </View>
  );
}
