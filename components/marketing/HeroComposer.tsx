import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { fonts, px, useColors } from "@/lib/theme";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

/* The composer on the stage, demonstrating itself.
 *
 * It used to type a rotating list of questions into a box while the eight
 * mode pills sat underneath, all identical and all inert. That showed what
 * you can ask but not the thing the product is actually about - that the
 * question picks the companion. A question about a tenancy agreement with
 * none of the eight lit is a search box with decoration under it.
 *
 * Now the mode and the question arrive together: a pill lights, its question
 * types itself out, both clear, and another mode takes over. One full pass
 * covers all eight, so anyone who watches long enough has seen the range.
 *
 * The order is shuffled rather than left to right. Left to right reads as a
 * list being recited, and whichever mode happened to be eighth would almost
 * never be seen - a visitor watches three or four of these, not a minute of
 * them.
 *
 * Drawn at the web's phone size (globals.css, the hero-* rules under 640px):
 * the question wraps instead of running off, and the eight modes are one row
 * that scrolls sideways.
 */

type HeroMode = { name: string; value: string; heroIcon: string };

/* One question per mode, chosen so that the pairing is self-evident - the
 * point is for someone to read the question, see which pill is lit, and
 * understand the relationship without a line of copy explaining it. */
const QUESTION_BY_MODE: Record<string, string> = {
  // The design's own question, and the mode that answers it. First, so the
  // first paint is the design.
  Finder: "Are we alone in this universe?",
  "Decision-making": "Should I take the job in Singapore or stay?",
  "Thought Coach": "Help me think through whether to go back to study.",
  Learning: "Explain the Krebs cycle for a Class 10 student.",
  "Co-Creative": "Draft a one-page proposal for a community library.",
  Guidance: "How do I get from junior to lead in two years?",
  Healthcare: "What does a high LDL on my blood test mean?",
  Legal: "What does my tenancy agreement actually oblige me to do?",
};

/* Quicker than a single question on its own needed to be. There are eight of
 * these now, and a loop nobody reaches the end of is a loop that may as well
 * hold three modes. */
const TYPE_MS = 38; // per character, typing
const DELETE_MS = 18; // per character, clearing - faster, as it always is
const HOLD_MS = 1100; // applied twice: once on the full line, once before clearing
const BETWEEN_MS = 260; // on an empty box, before the next mode takes over
const BLINK_MS = 550; // the caret's half-cycle while the line sits finished

type Phase = "typing" | "holding" | "deleting";

/** Fisher-Yates on a copy. */
function shuffle(items: number[]): number[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function HeroComposer({
  modes,
  accent,
  onOpen,
}: {
  modes: readonly HeroMode[];
  accent: string;
  /** Tapping the box hands over whichever companion was lit at that moment,
   *  so the demo opens in the mode the visitor was actually watching. */
  onOpen?: (mode: HeroMode) => void;
}) {
  const c = useColors();
  const reducedMotion = usePrefersReducedMotion();

  /* Which mode sits in each slot of the current pass, and how far through it
     we are. Both in one piece of state because they only ever change
     together, and state rather than a ref because the render reads them.
     It starts in declaration order so the first paint is the design. */
  const [cycle, setCycle] = useState<{ order: number[]; step: number; shuffled: boolean }>(() => ({
    order: modes.map((_, i) => i),
    step: 0,
    shuffled: false,
  }));
  const [length, setLength] = useState(() => QUESTION_BY_MODE[modes[0]?.name ?? ""]?.length ?? 0);
  const [phase, setPhase] = useState<Phase>("holding");

  const active = cycle.order[cycle.step] ?? 0;
  const question = QUESTION_BY_MODE[modes[active]?.name ?? ""] ?? "";

  useEffect(() => {
    if (reducedMotion) return;

    if (phase === "typing") {
      if (length >= question.length) {
        const t = setTimeout(() => setPhase("holding"), HOLD_MS);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setLength((n) => n + 1), TYPE_MS);
      return () => clearTimeout(t);
    }

    if (phase === "holding") {
      const t = setTimeout(() => setPhase("deleting"), HOLD_MS);
      return () => clearTimeout(t);
    }

    if (length <= 0) {
      const t = setTimeout(() => {
        const next = cycle.step + 1;
        /* shuffle() is called here, in the timeout, and never inside a state
           updater - an updater has to be pure, and React may run it twice. */
        if (next >= modes.length) {
          // A fresh pass in a fresh order, including which mode opens it, so
          // a second loop does not replay the first.
          setCycle({ order: shuffle(modes.map((_, i) => i)), step: 0, shuffled: true });
        } else if (!cycle.shuffled) {
          // The first pass keeps Finder in front for the design's sake and
          // shuffles only what follows it.
          setCycle({
            order: [cycle.order[0], ...shuffle(cycle.order.slice(1))],
            step: next,
            shuffled: true,
          });
        } else {
          setCycle({ ...cycle, step: next });
        }
        setPhase("typing");
      }, BETWEEN_MS);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => setLength((n) => n - 1), DELETE_MS);
    return () => clearTimeout(t);
  }, [reducedMotion, phase, length, cycle, question, modes]);

  // The caret blinks only while the line sits finished; steady while
  // characters are moving, which is how a caret behaves in a real text box.
  const [caretOn, setCaretOn] = useState(true);
  useEffect(() => {
    if (reducedMotion || phase !== "holding") {
      setCaretOn(true);
      return;
    }
    const t = setInterval(() => setCaretOn((on) => !on), BLINK_MS);
    return () => clearInterval(t);
  }, [reducedMotion, phase]);

  const text = reducedMotion ? question : question.slice(0, length);

  /* The pills are one row that scrolls sideways, so the lit one is brought
     into view as the demo moves on - by moving the row, never the page. */
  const pillsRef = useRef<ScrollViewInstance>(null);
  const pillFrames = useRef<Record<number, { x: number; width: number }>>({});
  const [rowWidth, setRowWidth] = useState(0);
  useEffect(() => {
    const frame = pillFrames.current[active];
    if (!frame || rowWidth === 0) return;
    const left = frame.x - (rowWidth - frame.width) / 2;
    pillsRef.current?.scrollTo({ x: Math.max(0, left), animated: !reducedMotion });
  }, [active, reducedMotion, rowWidth]);

  const fontSize = px(16);
  return (
    <View style={{ gap: px(10) }}>
      {/* A button, not a picture of one. The box has been typing questions
          at the visitor; the least surprising thing it can do when tapped
          is let them type their own. */}
      <Pressable
        onPress={() => onOpen?.(modes[active])}
        accessibilityRole="button"
        accessibilityLabel={`Try Clardentity in ${modes[active]?.name ?? "Finder"} mode`}
        style={({ pressed }) => ({
          minHeight: px(92),
          borderRadius: px(18.05),
          borderWidth: 1,
          borderColor: pressed ? "rgba(255,255,255,0.4)" : c.hairline,
          backgroundColor: "rgba(255,255,255,0.1)",
          overflow: "hidden",
        })}
      >
        <Text
          style={{
            paddingTop: px(13),
            paddingRight: px(54),
            paddingBottom: px(14),
            paddingLeft: px(14),
            fontFamily: fonts.regular,
            fontSize,
            lineHeight: fontSize * 1.35,
            color: "#ffffff",
          }}
        >
          {text}
          {!reducedMotion && (
            <Text style={{ color: caretOn ? "#ffffff" : "transparent", fontFamily: fonts.regular }}>{" |"}</Text>
          )}
        </Text>
        <View
          style={{
            position: "absolute",
            bottom: px(10),
            right: px(10),
            width: px(32),
            height: px(32),
            borderRadius: px(19.855),
            backgroundColor: accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaskIcon src="/landing/arrow-up.svg" size={px(18.05)} color="#ffffff" />
        </View>
      </Pressable>

      <ScrollView
        ref={pillsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        contentContainerStyle={{ gap: px(6), alignItems: "center" }}
      >
        {modes.map((mode, i) => {
          const lit = i === active;
          return (
            <View
              key={mode.name}
              onLayout={(e) => {
                pillFrames.current[i] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
              }}
              style={{
                alignItems: "center",
                justifyContent: "center",
                gap: px(3),
                paddingHorizontal: px(11),
                paddingVertical: px(5),
                borderRadius: px(7.22),
                borderWidth: 1,
                // The lit pill is the design's pill; the others are the same
                // pill turned down. Dimming the rest rather than brightening
                // one keeps the row looking like the drawing when a pill is
                // selected, which is the state it was drawn in.
                backgroundColor: lit ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.07)",
                borderColor: lit ? "rgba(255,255,255,0.6)" : c.hairline,
                opacity: lit ? 1 : 0.5,
              }}
            >
              <MaskIcon src={mode.heroIcon} size={px(17)} color="#ffffff" />
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: px(13), color: "#ffffff" }}>
                {mode.name}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
