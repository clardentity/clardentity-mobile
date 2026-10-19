import { router } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { isFirstRun, welcomeBackFor } from "@/lib/greeting";
import {
  importStashedTranscript,
  importedServerSnapshot,
  importedSnapshot,
  markImportAnnounced,
  subscribeImported,
} from "@/lib/guestHandoff";
import { sessionStorage } from "@/lib/storage";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import { fonts, fontSize, px, radius, space, useColors } from "@/lib/theme";
import { TOPBAR_HEIGHT } from "@/components/system/shellMetrics";

/* The two things the app says to you on arrival, in one strip above
 * everything else.
 *
 * They are together because they can happen in the same second - someone
 * who tried the landing demo, signed up, and is now here for the first
 * time - and two separately-positioned floating cards would overlap. One
 * strip stacks them.
 */

export function AppNotices() {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      // Below the top bar, not over it: the saved-conversation notice stays
      // until it is dismissed, so over the bar it would cover the title for
      // as long as the user ignored it.
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: insets.top + TOPBAR_HEIGHT + 12,
        zIndex: 40,
        alignItems: "center",
        gap: space(2),
        paddingHorizontal: space(4),
      }}
    >
      <WelcomeBack />
      <SavedFromDemo />
    </View>
  );
}

/** Shown once per time the app is opened.
 *
 *  Per *opening*, not per screen: sessionStorage (lib/storage) is memory
 *  that lasts as long as the process, so moving between chats does not
 *  re-greet anyone, and coming back after the app was closed does.
 */
const SEEN_KEY = "clardentity.greetedThisSession";
const VISIBLE_MS = 4500;

/** Whether this opening has been greeted yet, answered once and then
 *  remembered.
 *
 *  Cached in the module rather than re-read, because the read has a side
 *  effect - it also writes the flag - and React renders a component twice
 *  in development. Without the cache the second render would be told the
 *  app had already been greeted, by the first render, and nobody would ever
 *  see it.
 */
let claimed: boolean | undefined;

function claimTheGreeting(): boolean {
  if (claimed !== undefined) return claimed;
  const seen = sessionStorage.getItem(SEEN_KEY);
  claimed = !seen;
  if (!seen) sessionStorage.setItem(SEEN_KEY, "1");
  return claimed;
}

function subscribe(): () => void {
  return () => {};
}

function WelcomeBack() {
  const { user } = useAuth();
  const c = useColors();
  const reducedMotion = usePrefersReducedMotion();
  // A brand-new account is being welcomed properly on /welcome; saying
  // "welcome back" to someone who has never been here is the kind of detail
  // that makes an app feel automated.
  //
  // "Has finished onboarding" was the wrong test for that, because finishing
  // onboarding is the last thing a brand-new account does before arriving
  // here - the gate was open for precisely the person it was meant to stop.
  // How long ago it finished is the test that works.
  const eligible = !!user && !isFirstRun(user.onboarding_completed_at);
  const show = useSyncExternalStore(
    subscribe,
    () => eligible && claimTheGreeting(),
    () => false,
  );
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!show) return;
    // setState in the timer's callback, not in the effect body - the body
    // running setState is what turns a changing dependency into a render loop.
    const timer = setTimeout(() => setHidden(true), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [show]);

  const text = show && !hidden ? welcomeBackFor(user?.display_name) : null;
  if (!text) return null;
  return (
    <Animated.View
      accessibilityRole="alert"
      entering={reducedMotion ? undefined : FadeIn.duration(300)}
      style={{
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.surfaceRaised,
        paddingHorizontal: space(4),
        paddingVertical: space(2),
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.ink }}>{text}</Text>
    </Animated.View>
  );
}

/** The demo conversation, now that there is an account to put it in.
 *
 *  The import runs here rather than at the moment of signing up, because
 *  this is the first component that is certainly mounted with a token in
 *  hand however the account was reached - the register form, Google, or
 *  coming back tomorrow and signing in. It is a storage read when there is
 *  nothing waiting, which is almost always.
 */
function SavedFromDemo() {
  const { user } = useAuth();
  const c = useColors();
  const reducedMotion = usePrefersReducedMotion();
  // Read from the store rather than from the promise: on the sign-up path
  // the shell mounts and unmounts around /welcome and /start, and awaiting
  // the import inside an effect made "was the user told" depend on which
  // side of a redirect the response landed. It landed on the wrong side,
  // three times, in production.
  const saved = useSyncExternalStore(subscribeImported, importedSnapshot, importedServerSnapshot);

  useEffect(() => {
    // Starting it is all this does now; the store carries the answer.
    if (user) void importStashedTranscript();
  }, [user]);

  if (!saved) return null;
  return (
    <Animated.View
      accessibilityRole="alert"
      entering={reducedMotion ? undefined : FadeIn.duration(300)}
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: space(3),
        rowGap: space(1),
        alignSelf: "stretch",
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: c.brandBorder,
        backgroundColor: c.brandSoft,
        paddingHorizontal: space(4),
        paddingVertical: space(2.5),
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.ink }}>
        Your demo conversation is saved
        <Text style={{ color: c.inkMuted }}> · {saved.message_count} messages</Text>
      </Text>
      <Pressable
        accessibilityRole="link"
        hitSlop={8}
        onPress={() => {
          markImportAnnounced();
          router.push(`/chat/${saved.conversation_id}`);
        }}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.brand }}>Open it</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={markImportAnnounced}
        hitSlop={10}
        style={({ pressed }) => ({
          marginLeft: "auto",
          width: px(24),
          height: px(24),
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? c.surfaceHover : "transparent",
        })}
      >
        <Svg viewBox="0 0 24 24" width={px(14)} height={px(14)} fill="none" stroke={c.inkMuted} strokeWidth={1.8} strokeLinecap="round">
          <Path d="M18 6 6 18M6 6l12 12" />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}
