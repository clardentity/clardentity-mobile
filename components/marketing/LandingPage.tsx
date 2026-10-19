import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
  type ViewInstance,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { CurtainShimmer } from "@/components/marketing/CurtainShimmer";
import { GuestDemo, type DemoOrigin } from "@/components/marketing/GuestDemo";
import { HeroComposer } from "@/components/marketing/HeroComposer";
import { Reveal, RevealScope, useRevealScope } from "@/components/marketing/Reveal";
import { CardEmboss } from "@/components/marketing/CardEmboss";
import { track } from "@/lib/analytics";
import { fonts, px, useColors, type Colors } from "@/lib/theme";

/* The landing page, built from the Figma design (file mTefBk432edigQvPwag6mK,
 * node 69:7). Every measurement, colour and asset here came from the design
 * over the Figma connector rather than from a screenshot, so the layout is
 * the design's own numbers.
 *
 * Three things about how it is built:
 *
 * The design is a fixed 1728px canvas. Each section keeps the design's
 * intrinsic sizes and centres them in flow, and this app is the web's phone
 * layout of it: the display type at the bottom of each of the web's clamps,
 * the grids reflowed to one card across, and every number through px() -
 * the 0.92 the web's phone layout zoomed the whole page by.
 *
 * The revision this is built from took the whole page down to 90.25% - every
 * box, to the digit: the content column from 1110 to 1001.775, the mode
 * cards from 300x400 to 270.75x361, the stage from 1144 to 1032.46 - so the
 * page sits in more of its own margin. The nav is the exception; it was
 * added at full size, and keeps the wordmark the rest of the page has
 * stepped down from.
 *
 * The palette reads through to the app's tokens rather than being written out
 * here. The hexes these used to hold were the burgundy's, to the digit - but
 * an account that has chosen another accent should find this page in it once
 * they are signed in, and a page holding its own copy of the colour can only
 * ever be burgundy. The one exception is the curtain, which is a photograph
 * of burgundy fabric and stays what it is.
 */

function palette(c: Colors) {
  return {
    INK: c.ink, // headings
    INK_BODY: c.inkSecondary, // body copy under a heading
    MUTED: c.inkMuted, // captions, eyebrow text, footer wordmark
    PLUM: c.brand, // accent: send button, "Ask./Check./See.", emphasis
    CANVAS: c.surfaceMuted,
    HAIRLINE: c.hairlineStrong, // card borders
    OUTLINE: c.nav, // the nav pill
  };
}

/* The curtain, and a twenty-pixel-wide copy of it as the blur-up
 * placeholder. The stage is the first thing on the page: without this the
 * hero is an empty dark box until the image is decoded. */
const CURTAIN = require("@/assets/landing/curtain-stage.webp");
const CURTAIN_RATIO = 1909 / 824;
const CURTAIN_BLUR =
  "data:image/jpeg;base64,/9j/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAAJABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAEFBv/EAB4QAAEEAgMBAAAAAAAAAAAAAAEAAgQRAxIFQVGx/8QAFgEBAQEAAAAAAAAAAAAAAAAABAAB/8QAGREAAgMBAAAAAAAAAAAAAAAAAAIBBBFB/9oADAMBAAIRAxEAPwDAw87cUgOyXrrrfio8hNiujFmADZzQ0gfVFQrBKWXRJSOjJJq+hSEkLQ+n/9k=";

/* Where the curtain sits inside the stage, shared by the base image and the
 * shimmer laid over it so the two can never drift apart. The phone stage is
 * taller than the picture, so the picture covers it - full height, centred,
 * cropped at the sides - rather than stretching, and the shimmer must stay
 * on its folds. */
function curtainGeometry(width: number, height: number) {
  const w = Math.max(width, height * CURTAIN_RATIO);
  const h = w / CURTAIN_RATIO;
  return { position: "absolute" as const, left: (width - w) / 2, top: 0, width: w, height: Math.max(h, height) };
}

type Mode = {
  name: string;
  /** What the backend calls this mode. Not derivable from the label - the
   *  pill says "Thought Coach" and the API says `thinking`. */
  value: string;
  blurb: string;
  icon: string;
  /** The white-on-dark variant used inside the hero composer. */
  heroIcon: string;
  /** The design gives every blurb its own text box rather than a shared
   *  column, and the wrapping is part of the look - "Facts, sources," breaks
   *  before "fast." because its box is 81px wide, not 227px. Carried here so
   *  the cards read exactly as drawn. */
  blurbWidth: number;
  /** Where that box starts. Two-line blurbs sit lower than three-line ones so
   *  that every card's text ends on the same baseline. */
  blurbTop: number;
};

/* Names and one-liners are the design's. Guidance (Mentoring and Reflect &
 * Relieve, merged 2026-10-16) and Healthcare (new that day) are written to
 * the same pattern - a few words on what it is for. */
const MODES: Mode[] = [
  {
    name: "Finder",
    value: "knowing",
    blurb: "Facts, sources, fast.",
    icon: "/landing/icon-card-finder.svg",
    heroIcon: "/landing/icon-hero-finder.svg",
    blurbWidth: 81.177,
    blurbTop: 258.48,
  },
  {
    name: "Decision-making",
    value: "decision",
    blurb: "Weigh options against what matters to you.",
    icon: "/landing/icon-card-decision.svg",
    heroIcon: "/landing/icon-hero-decision.svg",
    blurbWidth: 208.853,
    blurbTop: 258.48,
  },
  {
    name: "Thought Coach",
    value: "thinking",
    blurb: "Sort out a half-formed idea.",
    icon: "/landing/icon-card-thought.svg",
    heroIcon: "/landing/icon-hero-thought.svg",
    blurbWidth: 221.329,
    blurbTop: 285.56,
  },
  {
    name: "Learning",
    value: "learning",
    blurb: "Learn it from the ground up.",
    icon: "/landing/icon-card-learning.svg",
    heroIcon: "/landing/icon-hero-learning.svg",
    blurbWidth: 221.329,
    blurbTop: 285.56,
  },
  {
    name: "Co-Creative",
    value: "creative",
    blurb: "Make something together, draft by draft.",
    icon: "/landing/icon-card-cocreative.svg",
    heroIcon: "/landing/icon-hero-cocreative.svg",
    blurbWidth: 221.329,
    blurbTop: 258.48,
  },
  {
    name: "Guidance",
    value: "guidance",
    blurb: "Direction for your goals, support when it's hard.",
    icon: "/landing/icon-card-guidance.svg",
    heroIcon: "/landing/icon-hero-guidance.svg",
    blurbWidth: 176,
    blurbTop: 258.48,
  },
  {
    name: "Healthcare",
    value: "healthcare",
    blurb: "Understand your health, and when to get care.",
    icon: "/landing/icon-card-healthcare.svg",
    heroIcon: "/landing/icon-hero-healthcare.svg",
    blurbWidth: 176,
    blurbTop: 258.48,
  },
  {
    name: "Legal",
    value: "legal",
    blurb: "Plain-language help with legal questions.",
    icon: "/landing/icon-card-legal.svg",
    heroIcon: "/landing/icon-hero-legal.svg",
    blurbWidth: 161.768,
    blurbTop: 258.48,
  },
];

const STEPS = [
  {
    word: "Ask.",
    blurb: "Your question goes to the models best suited for it.",
    blurbWidth: 256,
    blurbLeft: 25.68,
  },
  {
    word: "Check.",
    blurb: "The answer is split into claims & checked against sources.",
    blurbWidth: 276.894,
    blurbLeft: 25.27,
  },
  // Narrower in the design than the other two, which is what gives this one
  // its own line break rather than the shared column's.
  {
    word: "See.",
    blurb: "You get the answer and the facts audited.",
    blurbWidth: 240.634,
    blurbLeft: 25.27,
  },
];

/* Text in the design's type. The design sets every text node to CSS
 * `normal` line height - about 1.26 for Outfit - and the fixed-width text
 * boxes wrap the way they were drawn only at that number. Sizes are design
 * px; px() zooms them. */
function T({
  size,
  color,
  weight = "regular",
  style,
  children,
}: {
  size: number;
  color: string;
  weight?: "regular" | "medium" | "semibold";
  style?: StyleProp<TextStyle>;
  children: ReactNode;
}) {
  return (
    <Text style={[{ fontFamily: fonts[weight], fontSize: px(size), lineHeight: px(size) * 1.26, color }, style]}>
      {children}
    </Text>
  );
}

/* One mark, painted. There used to be four copies of this file with four
 * different fills baked in, which meant the mark was the one part of the page
 * that could not follow an accent.
 *
 * The whole lockup is driven by one number. The design draws it twice - 32px
 * with a 33.083 x 32 mark and a 12px gap in the nav, 28.88px with a 29.857 x
 * 28.88 mark and a 10.83px gap everywhere else - and those are the same
 * shape: 1.0338 and 0.375 of the type size, both times. */
function Wordmark({
  size,
  tone,
  mark,
}: {
  /** The type size, in points. */
  size: number;
  tone: string;
  /** The dots, which are not always the colour of the word beside them. */
  mark: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.375, flexShrink: 0 }}>
      <MaskIcon src="/landing/logo-dots.svg" width={size * 1.0338} height={size} color={mark} />
      <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: size, lineHeight: size * 1.15, color: tone }}>
        Clardentity
      </Text>
    </View>
  );
}

/* The nav was added at full size; the rest of the page stepped down to
 * 90.25%. On a phone both sit at the bottom of the web's clamps. */
const NAV_WORDMARK = px(22);
const PAGE_WORDMARK = px(20);

/** A card that lifts when pressed, as the web's did under a finger: 6px,
 *  and a glow in the accent. */
function LandingCard({
  width,
  height,
  rounded,
  border,
  children,
}: {
  width: number;
  height: number;
  rounded: number;
  border: number;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <Pressable
      accessible={false}
      style={({ pressed }) => ({
        width,
        maxWidth: "100%",
        height,
        borderRadius: rounded,
        borderWidth: border,
        borderColor: pressed ? c.brandBorder : c.hairlineStrong,
        backgroundColor: c.surfaceMuted,
        transform: [{ translateY: pressed ? -px(6) : 0 }],
        shadowColor: c.brand,
        shadowOpacity: pressed ? 0.3 : 0,
        shadowRadius: px(20),
        shadowOffset: { width: 0, height: px(18) },
        elevation: pressed ? 6 : 0,
      })}
    >
      {children}
    </Pressable>
  );
}

function StepCard({ step }: { step: (typeof STEPS)[number] }) {
  const c = useColors();
  const { MUTED, PLUM, HAIRLINE } = palette(c);
  const height = px(439.515);
  // The mark sits midway between the blurb and the word, measured: a
  // two-line blurb and a three-line one leave different gaps.
  const [above, setAbove] = useState<number | null>(null);
  const below = height - px(24.72) - px(36) * 1.26;
  const center = above === null ? px(249) : (above + below) / 2;
  return (
    <LandingCard width={px(329.636)} height={height} rounded={px(13.185)} border={1.099}>
      {/* a small outlined mark in the empty middle */}
      <CardEmboss shape={step.word} center={center} size={px(86)} />
      <View
        onLayout={(e: LayoutChangeEvent) => setAbove(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
        style={{ position: "absolute", left: px(step.blurbLeft), top: px(28.94), width: px(step.blurbWidth) }}
      >
        <T size={24} color={MUTED}>
          {step.blurb}
        </T>
      </View>
      <View
        style={{
          position: "absolute",
          bottom: px(24.72),
          left: "50%",
          width: px(276.894),
          marginLeft: -px(276.894) / 2,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <T size={36} weight="semibold" color={PLUM}>
          {step.word}
        </T>
        <MaskIcon src="/landing/logo-dots.svg" width={px(36.351)} height={px(35.161)} color={HAIRLINE} />
      </View>
    </LandingCard>
  );
}

function ModeCard({ mode }: { mode: Mode }) {
  const c = useColors();
  const { INK, MUTED } = palette(c);
  // Midway between the name row and the blurb. Both are placed by the
  // design's numbers, so the gap is known without measuring.
  const above = px(23.47) + px(28.88);
  const center = (above + px(mode.blurbTop)) / 2;
  return (
    <LandingCard width={px(270.75)} height={px(361)} rounded={px(10.83)} border={0.902}>
      {/* a small outlined mark in the empty middle */}
      <CardEmboss shape={mode.value} center={center} size={px(70)} />
      <View
        style={{
          position: "absolute",
          left: px(20.76),
          top: px(23.47),
          width: px(227.43),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <T size={18} weight="semibold" color={INK} style={{ flexShrink: 1 }}>
          {mode.name}
        </T>
        <MaskIcon src={mode.icon} size={px(28.88)} color={c.nav} />
      </View>
      <View style={{ position: "absolute", left: px(20.76), top: px(mode.blurbTop), width: px(mode.blurbWidth) }}>
        <T size={21.66} color={MUTED}>
          {mode.blurb}
        </T>
      </View>
    </LandingCard>
  );
}

/** A Link drawn as text. */
function TextLink({ href, children, style }: { href: string; children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Link href={href} style={style} accessibilityRole="link">
      {children}
    </Link>
  );
}

export function LandingPage({ signedIn }: { signedIn: boolean }) {
  const c = useColors();
  const { INK, INK_BODY, MUTED, PLUM, CANVAS, OUTLINE } = palette(c);
  const insets = useSafeAreaInsets();
  const enter = signedIn ? "/start" : "/register";

  /* The try-it-here demo, and the rectangle it grows out of. Held here
     rather than inside the composer because the panel covers the page, not
     the stage - it is a sibling of the whole layout, mounted only while it
     is open so none of its state outlives a close. */
  const stageRef = useRef<ViewInstance>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [demo, setDemo] = useState<{ mode: string; label: string; origin: DemoOrigin | null } | null>(null);

  /* The page scrolls itself, and reports where it is to the reveals. The
     "See how it works" link scrolls it to that section. */
  const scrollRef = useRef<ScrollViewInstance>(null);
  const howItWorksY = useRef(0);
  const { scope, report } = useRevealScope();
  const seeHowItWorks = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, howItWorksY.current - px(32)), animated: true });
  }, []);

  /* The web painted the document body in the page's canvas, so an
     overscroll bounce showed the page rather than the app's colour behind
     it. Here the ScrollView is the page, and its own background is what a
     bounce shows. */
  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <RevealScope scope={scope}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: CANVAS }}
          scrollEventThrottle={32}
          onLayout={(e) => report(scope.current().scrollY, e.nativeEvent.layout.height)}
          onScroll={(e) => report(e.nativeEvent.contentOffset.y, e.nativeEvent.layoutMeasurement.height)}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        >
          {/* ---------------------------------------------------------------- */}
          {/* Hero (69:8) */}
          {/* ---------------------------------------------------------------- */}
          <View style={{ paddingHorizontal: px(16), paddingTop: insets.top + px(48), paddingBottom: px(40) }}>
            {/* The nav (116:1908): the name on the left, the door on the
                right - the ends of one row. */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: px(16),
              }}
            >
                <Pressable onPress={() => router.push("/")} accessibilityLabel="Clardentity">
                  <Wordmark size={NAV_WORDMARK} tone={INK} mark={PLUM} />
                </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: px(16) }}>
                {/* The way back, for someone who already has an account. Only
                    when they are signed out: offering "Log in" to a signed-in
                    visitor reads as having been signed out. Quiet, and to the
                    left, because the page is addressed to people who have not
                    signed up yet - this is for the minority who have. */}
                {!signedIn && (
                  <TextLink href="/login" style={{ fontFamily: fonts.regular, color: OUTLINE, fontSize: px(15) }}>
                    Log in
                  </TextLink>
                )}
                {/* Someone who is already signed in and lands here must not
                    be offered a login button. The design's wording is the way
                    out of that: "Start exploring" is true of both, and goes
                    wherever that person's next step actually is. */}
                  <Pressable onPress={() => router.push(enter)}
                    accessibilityRole="link"
                    style={({ pressed }) => ({
                      borderRadius: px(37),
                      borderWidth: 1,
                      borderColor: OUTLINE,
                      paddingHorizontal: px(12),
                      paddingVertical: px(4),
                      backgroundColor: pressed ? "rgba(0,0,0,0.03)" : "transparent",
                    })}
                  >
                    <Text style={{ fontFamily: fonts.regular, color: OUTLINE, fontSize: px(16) }}>Start exploring</Text>
                  </Pressable>
              </View>
            </View>

            <View style={{ marginTop: px(96), alignItems: "center" }}>
              <T size={20} color={INK} style={{ textAlign: "center", width: "100%" }}>
                Every answer, checked claim by claim.
              </T>

              {/* The stage. On the phone it grows to fit a composer drawn at a
                  readable size - the web scaled the composer with the stage,
                  and on a phone that put its text at about 7px - and the
                  curtain covers it. */}
              <View
                ref={stageRef}
                collapsable={false}
                onLayout={(e) => setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
                style={{
                  marginTop: px(14.44),
                  width: "100%",
                  borderRadius: px(14.44),
                  overflow: "hidden",
                  backgroundColor: "#1a0710",
                  justifyContent: "flex-end",
                  paddingTop: px(150),
                  paddingHorizontal: px(12),
                  paddingBottom: px(12),
                }}
              >
                {stage.width > 0 && (
                  <>
                    <Image
                      source={CURTAIN}
                      placeholder={{ uri: CURTAIN_BLUR }}
                      contentFit="cover"
                      priority="high"
                      accessible={false}
                      style={curtainGeometry(stage.width, stage.height)}
                    />
                    {/* Under the design's own darkening gradient, so the light
                        behaves like part of the photograph rather than
                        something painted over the finished frame. */}
                    <CurtainShimmer style={curtainGeometry(stage.width, stage.height)} />
                  </>
                )}
                {/* The design's 110.13deg gradient, as a start and end point
                    across the box. */}
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0)"]}
                  locations={[0, 0.27018, 0.83189]}
                  start={{ x: 0, y: 0.32 }}
                  end={{ x: 1, y: 0.68 }}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />

                <HeroComposer
                  modes={MODES}
                  accent={PLUM}
                  onOpen={(mode) => {
                    track("guest_demo_opened", { mode: mode.value });
                    const open = (origin: DemoOrigin | null) => setDemo({ mode: mode.value, label: mode.name, origin });
                    const node = stageRef.current;
                    if (!node) return open(null);
                    node.measureInWindow((x, y, width, height) =>
                      open(width > 0 ? { top: y, left: x, width, height } : null),
                    );
                  }}
                />
              </View>

              <Text
                style={{
                  marginTop: px(36),
                  width: "100%",
                  textAlign: "center",
                  textTransform: "uppercase",
                  fontFamily: fonts.semibold,
                  fontSize: px(14),
                  lineHeight: px(14) * 1.26,
                  color: MUTED,
                }}
              >
                <TextLink href={enter} style={{ color: MUTED }}>
                  Start asking
                </TextLink>
                {" · "}
                <Text onPress={seeHowItWorks} accessibilityRole="link" style={{ color: MUTED }}>
                  See how it works
                </Text>
              </Text>
            </View>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* How it works (69:132) */}
          {/* ---------------------------------------------------------------- */}
          {/* Second, not fourth. The design stacks it directly under the hero,
              which is also where the hero's own "See how it works" points. */}
          <View
            onLayout={(e) => {
              howItWorksY.current = e.nativeEvent.layout.y;
            }}
            style={{ paddingHorizontal: px(16), paddingVertical: px(72) }}
          >
            <View style={{ alignItems: "center", gap: px(26.371) }}>
              <Reveal>
                <T size={25} color={INK} style={{ textAlign: "center", textTransform: "capitalize" }}>
                  How it works
                </T>
              </Reveal>

              {/* As many across as fit, the rest centred: the cards are a fixed
                  size, so on a phone that is one. */}
              <View
                style={{
                  width: "100%",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: px(35.161),
                }}
              >
                {STEPS.map((step, i) => (
                  // Ask, then Check, then See - in that order, which is the
                  // point the three cards are making.
                  <Reveal key={step.word} delay={i * 110} style={{ maxWidth: "100%" }}>
                    <StepCard step={step} />
                  </Reveal>
                ))}
              </View>

              <Reveal delay={160} style={{ alignSelf: "flex-end" }}>
                <T size={14} color={MUTED} style={{ textAlign: "right", textTransform: "uppercase" }}>
                  Clardentity uses multiple AI models, not just one.
                </T>
              </Reveal>
            </View>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* The audit (69:66) */}
          {/* ---------------------------------------------------------------- */}
          {/* The phone layout: the design's 3.6px gaps between the label row,
              the headline and the two sentences are sized for an 86px
              headline on a wide screen, so here each part gets room - wider
              side margins, the headline and sentences well below the label
              row, the sentences one justified block under the centred
              headline, and the lines given air. */}
          <View style={{ paddingHorizontal: px(28), paddingVertical: px(96) }}>
            <Reveal
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: px(40),
              }}
            >
              <Wordmark size={PAGE_WORDMARK} tone={INK} mark={PLUM} />
              <T size={13} weight="semibold" color={MUTED} style={{ textTransform: "uppercase" }}>
                The audit
              </T>
            </Reveal>

            <Reveal delay={90}>
              <Text
                style={{
                  textAlign: "center",
                  fontFamily: fonts.regular,
                  fontSize: px(36),
                  lineHeight: px(36) * 1.15,
                  color: INK,
                }}
              >
                An answer is many claims.
              </Text>
            </Reveal>
            <Reveal delay={180} style={{ marginTop: px(28), alignSelf: "center", maxWidth: px(544) }}>
              {/* One flowing paragraph on a phone: justified, a
                  one-line-and-a-bit sentence stretched its first line into
                  wide gaps. */}
              <Text
                style={{
                  textAlign: "justify",
                  fontFamily: fonts.regular,
                  fontSize: px(16),
                  lineHeight: px(16) * 1.55,
                  color: INK_BODY,
                }}
              >
                Clardentity splits every answer into individual claims. Each one is checked against sources. You see
                what holds up and what doesn&apos;t.
              </Text>
            </Reveal>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* Modes (69:77) */}
          {/* ---------------------------------------------------------------- */}
          <View style={{ paddingHorizontal: px(16), paddingVertical: px(60) }}>
            <View style={{ alignItems: "flex-end", gap: px(16) }}>
              <Reveal style={{ width: "100%", maxWidth: px(330.315) }}>
                <T size={20} color={INK} style={{ textAlign: "right", textTransform: "capitalize" }}>
                  <Text style={{ color: PLUM }}>Different questions</Text> need{" "}
                  <Text style={{ color: PLUM }}>different thinking.</Text>
                </T>
              </Reveal>

              {/* The cards keep their 270.75 x 361 shape, so the wall of them
                  reads the same at every width - one across on a phone. */}
              <View
                style={{
                  width: "100%",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  columnGap: px(28.88),
                  rowGap: px(36.1),
                }}
              >
                {MODES.map((mode, i) => (
                  // Staggered across the row, capped so the second row does
                  // not wait most of a second behind the first.
                  <Reveal key={mode.name} delay={(i % 4) * 70} style={{ maxWidth: "100%" }}>
                    <ModeCard mode={mode} />
                  </Reveal>
                ))}
              </View>

              <Reveal delay={120} style={{ width: "100%" }}>
                <T size={13} weight="semibold" color={MUTED} style={{ textAlign: "right", textTransform: "uppercase" }}>
                  Switch modes yourself, or let Clardentity pick.
                </T>
              </Reveal>
            </View>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* Closing call to action (69:153) */}
          {/* ---------------------------------------------------------------- */}
          <View style={{ paddingHorizontal: px(16), paddingVertical: px(90) }}>
            <Reveal style={{ alignItems: "flex-start", gap: px(40) }}>
              <View style={{ width: "100%", gap: px(10.83) }}>
                <T size={36} weight="semibold" color={INK}>
                  See what holds up.
                </T>
                  <Pressable onPress={() => router.push(enter)} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "flex-start", alignSelf: "flex-start" }}>
                    {({ pressed }) => (
                      <>
                        <T
                          size={18}
                          weight="medium"
                          color={pressed ? PLUM : MUTED}
                          style={{ textTransform: "uppercase", textDecorationLine: "underline", textDecorationStyle: "dotted" }}
                        >
                          Start asking
                        </T>
                        <MaskIcon src="/landing/arrow-up-right.svg" size={px(36.1)} color={c.nav} />
                      </>
                    )}
                  </Pressable>
              </View>
              <Wordmark size={PAGE_WORDMARK} tone={MUTED} mark={MUTED} />
            </Reveal>
          </View>

          {/* The legal pages are a requirement of the terms people accept at
              sign-up, so they need a route from the public page. Not in the
              design; kept quiet at the very bottom rather than added to it. */}
          <View style={{ paddingHorizontal: px(16), paddingBottom: px(40) }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: px(16), color: MUTED }}>
              <TextLink href="/privacy" style={{ color: MUTED }}>
                Privacy
              </TextLink>
              {" · "}
              <TextLink href="/terms" style={{ color: MUTED }}>
                Terms
              </TextLink>
            </Text>
          </View>
        </ScrollView>
      </RevealScope>

      {demo && (
        <GuestDemo origin={demo.origin} modes={MODES} initialMode={demo.mode} onClose={() => setDemo(null)} />
      )}
    </View>
  );
}
