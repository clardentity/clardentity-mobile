import { type StyleProp, type TextStyle, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { AppText } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { greetingFor, invitationFor, isFirstRun } from "@/lib/greeting";
import { space } from "@/lib/theme";

/* What an empty chat says.
 *
 * On the web the greeting had to wait for hydration - the clock on the server
 * is not the clock in the browser - so the first paint was empty and the
 * greeting faded in. There is no server render here, so it is simply read in
 * render, but the fade is kept: a greeting that fades in reads as the room
 * noticing you walked in, and one that is simply already there reads as a
 * heading.
 *
 * The value is re-read on every render, which is when the name can change.
 */

/** Width of the web's max-w-md measure. */
const MEASURE = 448;

export function ChatGreeting({ seed }: { seed?: string | null }) {
  const { user } = useAuth();
  const name = user?.display_name ?? null;
  // Someone who signed up a minute ago is not coming back, and the night
  // band is the one that would tell them they were.
  const firstRun = isFirstRun(user?.onboarding_completed_at);
  const text = greetingFor(name, { firstRun }).text;

  if (!text) return null;
  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: "center" }}>
      {/* Large and quiet. It is the only thing on the screen above the
          composer, so it can afford the size, and it must not look like a
          question waiting to be answered. */}
      <AppText size="2xl" weight="medium" tone="secondary" style={{ textAlign: "center" }}>
        {text}
      </AppText>
      {/* The invitation under the greeting. The greeting says the app
          noticed you; this says what it is for. Quieter and smaller, so the
          pair reads as one thought rather than two headings. One of twenty,
          per chat - some run to two lines, hence the measure. */}
      <AppText tone="muted" style={{ marginTop: space(2), maxWidth: MEASURE, textAlign: "center" }}>
        {invitationFor(seed)}
      </AppText>
    </Animated.View>
  );
}

/** What an empty temporary chat says instead of the greeting: what the
 *  header's dashed bubble did, in the words the chat is held to. The server
 *  keeps every one of these promises (app/services/temporary_chats.py). */
export function TemporaryChatIntro() {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: "center" }}>
      <AppText size="2xl" weight="medium" tone="secondary" style={{ textAlign: "center" }}>
        Temporary chat
      </AppText>
      <AppText tone="muted" style={{ marginTop: space(2), maxWidth: MEASURE, textAlign: "center" }}>
        This chat won&apos;t appear in your history or shape your profile, and it&apos;s deleted when you
        leave it.
      </AppText>
    </Animated.View>
  );
}

/** The line Guidance and Healthcare open with, under the greeting: that this
 *  is an AI, and what it is not. Said once, plainly, before anything is
 *  asked - which is what California's companion-chatbot law (SB 243) and
 *  the EU AI Act's transparency duty ask for, and what anyone would want to
 *  know before telling a machine about their health or their worst week. */
export const MODE_DISCLOSURE: Record<string, string> = {
  guidance:
    "Guidance is an AI companion - not a therapist, counsellor or crisis service. If you're in danger, call your local emergency number.",
  healthcare:
    "Healthcare is an AI giving general health information - not a doctor or a diagnosis, it can be wrong, and it is not for emergencies.",
};

/** `style` replaces the web's `className`: given, it replaces the default
 *  spacing (centred, small, muted stays). */
export function ModeDisclosure({ mode, style }: { mode: string | null; style?: StyleProp<TextStyle> }) {
  const text = mode ? MODE_DISCLOSURE[mode] : undefined;
  if (!text) return null;
  return (
    <View style={{ alignItems: "center" }}>
      <AppText
        size="xs"
        tone="muted"
        style={[{ textAlign: "center" }, style ?? { marginTop: space(3), maxWidth: MEASURE }]}
      >
        {text}
      </AppText>
    </View>
  );
}
