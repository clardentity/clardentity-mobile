/** The modes of the single cognitive companion, in the order the pickers
 *  show them (the client's sequence: the checked modes from most to least
 *  common, then the roadmap).
 *
 *  One definition shared by the landing page and the composer, so the words a
 *  visitor reads before signing up are the same ones they see when choosing a
 *  mode. Wording follows the client's linguistic recommendations.
 *
 *  `label` is the short name on the composer pill; `companion` is the full
 *  name the marketing copy uses ("Knowing Companion"); `hint` is the promise;
 *  `when` tells someone which to reach for; `cta` is the invitation on the
 *  landing page.
 */
export const COGNITIVE_MODES = [
  {
    value: "knowing",
    /** The design's own mark for this companion, used by the mode rail. */
    icon: "/ui/mode-finder.svg",
    // "Finder" (the client's name, after "Knowing", "Verified Knowing" and
    // "Tailored"): it goes and finds the answer - in your documents and on
    // the web - and every claim in it is checked against a source.
    label: "Finder",
    companion: "Finder Companion",
    hint: "Finds and checks the facts",
    when: "When you need an answer fitted to your documents and checked claim by claim.",
    cta: "Explore the unknown.",
    detail:
      "Answers stay close to your documents, and every claim carries its source. When the answer isn't in what you've given it, it says so instead of filling the gap.",
  },
  {
    value: "decision",
    /** The design's own mark for this companion, used by the mode rail. */
    icon: "/ui/mode-decision.svg",
    label: "Decision-making",
    companion: "Decision-making Companion",
    hint: "Make wise choices",
    when: "When you want to choose between unbiased and biased decisions.",
    cta: "Try making the correct decision.",
    detail:
      "Lays out the real options and what each one costs you, then makes a recommendation. It also flags the cognitive biases that tend to distort this kind of decision - before you commit, not after.",
  },
  {
    value: "thinking",
    /** The design's own mark for this companion, used by the mode rail. */
    icon: "/ui/mode-thought.svg",
    // "Thought coach", per the client (was "Thinking-trainer").
    label: "Thought coach",
    companion: "Thought coach Companion",
    hint: "Think correctly",
    when: "When you want to improve your thinking skills, not just the conclusion.",
    cta: "Try thinking it through.",
    detail:
      "Works through a problem in visible steps you can follow and challenge. Choose a reasoning lens - critical, creative, step-by-step - to change how it approaches the problem.",
  },
  {
    value: "learning",
    /** The design's own mark for this companion, used by the mode rail. */
    icon: "/ui/mode-learning.svg",
    label: "Learning",
    companion: "Learning Companion",
    hint: "Expand your knowledge and skills",
    when: "When you want to acquire knowledge and skills, not just be informed.",
    cta: "Try learning something new.",
    detail:
      "Meets you at your level and builds from there, drawing on established learning science. Ends by checking you've actually got it.",
  },
  {
    value: "creative",
    /** The design's own mark for this companion, used by the mode rail. */
    icon: "/ui/mode-cocreative.svg",
    // "Co-Creative": it works *with* you on a document, it doesn't produce
    // one unasked - the client's preferred framing over plain "Creative".
    label: "Co-Creative",
    companion: "Co-Creative Companion",
    hint: "Make something together",
    when: "When you want help writing, coding, or building a document from scratch.",
    cta: "Try making something.",
    detail:
      "Writes, codes, and builds structured documents - reports, presentations, spreadsheets - offered as an actual file, not just described in chat.",
  },
  {
    value: "guidance",
    /** Compass: direction, the thing both halves of this companion help with. */
    icon: "/ui/mode-guidance.svg",
    // Mentoring and Reflect & Relieve, merged 2026-10-16: one companion for
    // where you are going and for how you are doing. Never "therapy" or
    // "counselling" - see docs/modes/guidance.md.
    label: "Guidance",
    companion: "Guidance Companion",
    hint: "Find your direction, and your footing",
    when: "When you want a mentor for your goals, or a steady listener when things are hard.",
    cta: "Try getting guidance.",
    detail:
      "Mentors you toward a goal - honest about what's hard and how long it really takes - and listens when life gets heavy, with practical steps you can try today. An AI companion, not a therapist: it says so, and points you to a person when that's what you need.",
  },
  {
    value: "healthcare",
    /** Heartbeat. */
    icon: "/ui/mode-healthcare.svg",
    // Added 2026-10-16, under the regulation suite (backend services/
    // regulations): consent first, local rules, local emergency numbers.
    label: "Healthcare",
    companion: "Healthcare Companion",
    hint: "Understand your health",
    when: "When you want a symptom, condition, test result or medicine explained, and to know when to see a doctor.",
    cta: "Try asking about your health.",
    detail:
      "Explains symptoms, conditions, lab results and medicines in plain language, checks every claim against trusted health sources, and tells you how urgently to get care. General information under your country's health-data rules - not diagnosis or treatment.",
  },
  {
    value: "legal",
    /** The design's own mark for this companion, used by the mode rail. */
    icon: "/ui/mode-legal.svg",
    // "Legal", not "Legal Companion": no other pill carries the word.
    label: "Legal",
    companion: "Legal Companion",
    hint: "Understand where you stand",
    when: "When you need a legal situation explained in plain language before you speak to a professional.",
    cta: "Try understanding your position.",
    detail:
      "Explains the rules that apply, the questions a lawyer will ask, and what to gather beforehand. Orientation, not legal advice - it says so, and points you to a professional for anything that turns on your specific facts.",
  },
] as const;

/** Mode values that no longer exist, and what a remembered one now means:
 *  Mentoring and Reflect & Relieve became Guidance on 2026-10-16. Read
 *  wherever a mode comes back out of the browser's storage. */
export const LEGACY_MODES: Record<string, string> = { mentoring: "guidance", therapy: "guidance" };

export function currentMode<T extends string | null | undefined>(value: T): T | string {
  return value && LEGACY_MODES[value] ? LEGACY_MODES[value] : value;
}

/** A mode the user can pick. */
export type PickableMode = (typeof COGNITIVE_MODES)[number]["value"];

/** Any mode a message can carry. `rapid` is the one that isn't in the
 *  picker: the server's no-gates, no-checking path, reached only through the
 *  "Quick answer" button while a slow answer is being written. */
export type CognitiveMode = PickableMode | "rapid";

export type ModeEntry = (typeof COGNITIVE_MODES)[number];

export const MODE_BY_VALUE: { [mode: string]: ModeEntry | undefined } = Object.fromEntries(
  COGNITIVE_MODES.map((m) => [m.value, m]),
);

/** The name shown for a mode wherever a message or chat carries one - the
 *  picker's label, or "Quick answer" for the unpickable quick path. */
export function modeLabel(value: string | null | undefined): string {
  if (!value) return "";
  if (value === "rapid") return "Quick answer";
  return MODE_BY_VALUE[value]?.label ?? value;
}

/** Visible in every picker, selectable in none of them yet - shown grayed
 *  out with a "Soon" badge rather than hidden outright, so the announcement
 *  (the landing page carousel) and the composer agree on what exists. The
 *  backend already answers requests in these modes; this is purely about
 *  when the UI lets someone start one. */
export const COMING_SOON_MODES: readonly PickableMode[] = [
  "guidance",
  "healthcare",
  "creative",
  // Announced, not built: no prompt behind it yet, and the backend's mode
  // validator doesn't accept it. It exists here so the pickers show the
  // roadmap the client asked for; it can't be started.
  "legal",
];

/** What a new chat opens in when nothing else has been chosen: the checked,
 *  cited mode the product is built around. The composer never waits on a
 *  mode pick - there is always one selected. */
export const DEFAULT_MODE: PickableMode = "knowing";
