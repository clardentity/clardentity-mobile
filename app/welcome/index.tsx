import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth";
import { resetTours } from "@/lib/tour";
import { AuthCard, AuthScreen, ErrorNotice } from "@/components/auth/AuthScreen";
import { AppText, Button, Spinner, Textarea } from "@/components/ui/primitives";
import { fontSize, px, space, useColors } from "@/lib/theme";

/* Three open-ended questions, shown once, right after sign-up (or on the
 * first sign-in after this shipped). Every one is optional and the whole
 * thing can be skipped - what's typed here is evidence for the same profile
 * inference that reads the user's conversations, not a form that fills
 * fields, so nothing depends on it being answered. Finishing or skipping this
 * page also resets the coachmark tours, so they play on the screens that
 * follow. */

const QUESTIONS = [
  {
    title: "What brings you to Clardentity?",
    hint: "A sentence or two about what you're hoping to get done here.",
    placeholder: "e.g. I keep making big decisions on gut feel and want a second opinion that shows its evidence.",
  },
  {
    title: "What are you working on, studying, or deciding right now?",
    hint: "Whatever's actually on your plate - work, study, a decision you're weighing.",
    placeholder: "e.g. Comparing two job offers, and revising for a statistics exam in November.",
  },
  {
    title: "How do you like information delivered?",
    hint: "Short and direct? Step by step? Evidence up front? Anything that helps match your pace.",
    placeholder: "e.g. Give me the bottom line first, then the reasoning if I ask.",
  },
] as const;

export default function WelcomePage() {
  const { user, loading, refresh } = useAuth();
  const c = useColors();
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => QUESTIONS.map(() => ""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed-out users go to login; already-onboarded ones have no business
  // here and go straight in. `=== null` for the same reason as RequireAuth:
  // an older backend omits the field, and that must not trap anyone.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.onboarding_completed_at !== null) router.replace("/start");
  }, [loading, user]);

  async function finish() {
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/profile/onboarding", {
        method: "POST",
        body: {
          // Whatever they actually typed, on both paths. "Skip for now"
          // used to send an empty answer for every question, including the
          // ones already filled in - so someone who answered the first and
          // skipped the rest had what they wrote silently thrown away, and
          // the profile started empty despite them having told it who they
          // were. Skip means skip the remaining questions, not discard the
          // answered ones; a question nobody answered is an empty string
          // either way.
          answers: QUESTIONS.map((q, i) => ({
            question: q.title,
            answer: answers[i].trim(),
          })),
        },
      });
      // Re-read the user so RequireAuth sees the stamp and stops sending
      // people back here, then hand over to the tour.
      await refresh();
      // An account-level reset must re-show the tours even on a device
      // that dismissed them before; the chat they land in starts the first.
      resetTours();
      router.replace("/start");
    } catch {
      setError("That didn't save. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (loading || !user || user.onboarding_completed_at !== null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.canvas }}>
        <Spinner />
      </View>
    );
  }

  const q = QUESTIONS[page];
  const isLast = page === QUESTIONS.length - 1;
  const firstName = (user.display_name || "").trim().split(/\s+/)[0];

  function next() {
    if (isLast) void finish();
    else setPage((p) => p + 1);
  }

  return (
    <AuthScreen wide>
      <AuthCard>
        <View style={{ gap: space(1) }}>
          <AppText size="xs" weight="semibold" tone="brand" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
            {page === 0
              ? `Welcome to Clardentity${firstName ? `, ${firstName}` : ""}`
              : `Question ${page + 1} of ${QUESTIONS.length}`}
          </AppText>
          <AppText size="xl" weight="semibold" accessibilityRole="header">
            {q.title}
          </AppText>
          <AppText tone="muted">{q.hint}</AppText>
        </View>

        <Textarea
          // Remounted per page (key), so autoFocus lands the caret in each
          // new question without a ref/effect dance.
          key={page}
          autoFocus
          numberOfLines={4}
          style={{ minHeight: fontSize.sm * 1.5 * 4 + space(4) }}
          value={answers[page]}
          onChangeText={(text) => setAnswers((prev) => prev.map((a, i) => (i === page ? text : a)))}
          placeholder={q.placeholder}
          maxLength={2000}
          accessibilityLabel={q.title}
        />

        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2) }}
          accessibilityLabel={`Progress: question ${page + 1} of ${QUESTIONS.length}`}
        >
          {QUESTIONS.map((_, i) => (
            <View
              key={i}
              style={{
                height: px(6),
                width: i === page ? px(24) : px(6),
                borderRadius: 9999,
                backgroundColor: i === page ? c.brand : c.hairlineStrong,
              }}
            />
          ))}
        </View>

        {error && <ErrorNotice>{error}</ErrorNotice>}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(3) }}>
          <Pressable
            onPress={() => void finish()}
            disabled={submitting}
            accessibilityRole="button"
            hitSlop={12}
            style={{ opacity: submitting ? 0.5 : 1 }}
          >
            {({ pressed }) => (
              <AppText size="xs" style={{ color: pressed ? c.ink : c.inkMuted }}>
                Skip for now
              </AppText>
            )}
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
            {page > 0 && (
              <Button variant="ghost" onPress={() => setPage((p) => p - 1)} disabled={submitting}>
                Back
              </Button>
            )}
            <Button variant="primary" onPress={next} disabled={submitting}>
              {submitting ? "Saving…" : isLast ? "Finish" : "Continue"}
            </Button>
          </View>
        </View>

        <AppText size="xs" tone="muted" style={{ textAlign: "center" }}>
          All optional. This is only used to give your profile a head start - it keeps learning from
          how you actually use Clardentity.
        </AppText>
      </AuthCard>
    </AuthScreen>
  );
}
