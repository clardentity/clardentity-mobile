import { Component, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeErrorRef, sendErrorReport } from "@/lib/errorReport";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* When one part of a screen throws, only that part gives way.
 *
 * The design for this is a quiet inline box where the part was - "Try
 * again" first, and a small "Report" link that opens a sheet and only shows
 * a reference once a report has actually gone. (On the web these boundaries
 * stepped aside on desktop; this app is only ever the phone layout, so they
 * always catch.)
 *
 * `variant="part"` is a single piece (an answer, a question card, a chart,
 * the recent-chats list); `variant="page"` sits around a whole screen inside
 * the shell, so the drawer and top bar stay usable. */

type Props = {
  /** Which part this is, for the report - never shown, never user text. */
  where: string;
  /** What the person reads when it fails. */
  label: string;
  variant?: "part" | "page";
  children: ReactNode;
};

export class ErrorBoundary extends Component<Props, { error: Error | null; attempt: number }> {
  state = { error: null as Error | null, attempt: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    const { error, attempt } = this.state;
    if (!error) return <ErrorAttempt key={attempt}>{this.props.children}</ErrorAttempt>;
    return (
      <InlineError
        error={error}
        where={this.props.where}
        label={this.props.label}
        variant={this.props.variant ?? "part"}
        onRetry={this.retry}
      />
    );
  }
}

/** Keyed by attempt, so "Try again" remounts the part from scratch rather
 *  than re-rendering whatever half-state it threw from. */
function ErrorAttempt({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function InlineError({
  error,
  where,
  label,
  variant,
  onRetry,
}: {
  error: Error;
  where: string;
  label: string;
  variant: "part" | "page";
  onRetry: () => void;
}) {
  const [sheet, setSheet] = useState(false);
  const c = useColors();
  const s = useThemedStyles(styles);
  const page = variant === "page";
  return (
    <View
      accessibilityRole="alert"
      testID="part-error"
      style={[s.box, page ? { marginHorizontal: space(5), marginVertical: space(10), padding: space(5) } : { marginVertical: space(2), padding: space(3) }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), justifyContent: page ? "center" : "flex-start" }}>
        <Svg viewBox="0 0 24 24" width={px(16)} height={px(16)} fill="none" stroke={page ? c.ink : c.inkSecondary} strokeWidth={1.8} strokeLinecap="round">
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7.5v5.5M12 16.5h.01" />
        </Svg>
        <Text style={[s.text, { flexShrink: 1 }, page && { fontSize: fontSize.base, color: c.ink }]}>{label}</Text>
      </View>
      {page && (
        <Text style={[s.text, { marginTop: space(1), color: c.inkMuted, textAlign: "center" }]}>
          Your chats are safe. Try again, or use the menu.
        </Text>
      )}
      <View
        style={{
          marginTop: page ? space(4) : space(2.5),
          flexDirection: "row",
          alignItems: "center",
          gap: space(3),
          justifyContent: page ? "center" : "flex-start",
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          hitSlop={8}
          style={({ pressed }) => [s.retry, pressed && { backgroundColor: c.surfaceHover }]}
        >
          <Text style={s.retryText}>Try again</Text>
        </Pressable>
        {/* Deliberately small: most people only want the retry. */}
        <Pressable accessibilityRole="button" onPress={() => setSheet(true)} hitSlop={8} style={!page && { marginLeft: "auto" }}>
          <Text style={s.link}>Report</Text>
        </Pressable>
      </View>
      {sheet && <ReportSheet error={error} where={where} onClose={() => setSheet(false)} />}
    </View>
  );
}

/** Ask, send, and only then show the reference. A Modal, so it is never
 *  clipped into whatever scroll box the failed part lived in. */
function ReportSheet({ error, where, onClose }: { error: Error; where: string; onClose: () => void }) {
  const [state, setState] = useState<"ask" | "sending" | "sent" | "unsent">("ask");
  const [ref] = useState(makeErrorRef);
  const [copied, setCopied] = useState(false);
  const insets = useSafeAreaInsets();
  const c = useColors();
  const s = useThemedStyles(styles);
  const sending = state === "sending";

  async function send() {
    setState("sending");
    setState((await sendErrorReport(ref, where, error)) ? "sent" : "unsent");
  }

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={sending ? () => {} : onClose}>
      <Pressable style={s.scrim} onPress={sending ? undefined : onClose} accessibilityLabel="Close" accessibilityRole="button">
        <Pressable
          accessibilityViewIsModal
          accessibilityLabel="Report this error"
          onPress={() => {}}
          style={[s.sheet, { paddingBottom: space(5) + insets.bottom }]}
        >
          {state === "ask" || sending ? (
            <>
              <Text style={s.heading}>Send a report?</Text>
              <Text style={[s.text, { marginTop: space(1) }]}>We&apos;ll get the technical details of this error - not your messages.</Text>
              <View style={{ marginTop: space(4), flexDirection: "row", gap: space(3) }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void send()}
                  disabled={sending}
                  hitSlop={8}
                  style={({ pressed }) => [s.primary, { backgroundColor: pressed ? c.brandDark : c.brand, opacity: sending ? 0.6 : 1 }]}
                >
                  <Text style={s.primaryText}>{sending ? "Sending…" : "Send report"}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={onClose} disabled={sending} hitSlop={8} style={s.plain}>
                  <Text style={[s.text, { color: c.inkSecondary }]}>Cancel</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              {state === "sent" ? (
                <>
                  <Text style={s.heading}>Report sent</Text>
                  <Text style={[s.text, { marginTop: space(1) }]}>If you contact support, quote this reference:</Text>
                  <View style={{ marginTop: space(3), flexDirection: "row", alignItems: "center", gap: space(3) }}>
                    <Text testID="error-ref" selectable style={s.code}>
                      {ref}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => {
                        void Clipboard.setStringAsync(ref).then(() => setCopied(true), () => undefined);
                      }}
                    >
                      <Text style={s.link}>{copied ? "Copied" : "Copy"}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                // Nothing reached us, so there's no reference worth quoting.
                <>
                  <Text style={s.heading}>Couldn&apos;t send the report</Text>
                  <Text style={[s.text, { marginTop: space(1) }]}>
                    Nothing was sent. Try again later, or tell support what you were doing when this happened.
                  </Text>
                </>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [s.done, pressed && { backgroundColor: c.surfaceHover }]}
              >
                <Text style={[s.text, { color: c.ink }]}>Done</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    box: { borderRadius: radius.xl, borderWidth: 1, borderStyle: "dashed", borderColor: c.hairlineStrong },
    text: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.inkSecondary },
    heading: { fontFamily: fonts.medium, fontSize: fontSize.base, color: c.ink },
    link: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted, textDecorationLine: "underline" },
    retry: {
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: c.hairlineStrong,
      paddingHorizontal: space(3.5),
      paddingVertical: space(1.5),
    },
    retryText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.ink },
    scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
      width: "100%",
      borderTopLeftRadius: radius["2xl"],
      borderTopRightRadius: radius["2xl"],
      borderTopWidth: 1,
      borderColor: c.hairlineStrong,
      backgroundColor: c.surfaceRaised,
      padding: space(5),
    },
    primary: { borderRadius: radius.full, paddingHorizontal: space(4), paddingVertical: space(2) },
    primaryText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: "#ffffff" },
    plain: { borderRadius: radius.full, paddingHorizontal: space(4), paddingVertical: space(2) },
    code: {
      borderRadius: radius.md,
      backgroundColor: c.surfaceSunken,
      paddingHorizontal: space(2.5),
      paddingVertical: space(1),
      fontFamily: fonts.mono,
      fontSize: fontSize.sm,
      color: c.ink,
      overflow: "hidden",
    },
    done: {
      marginTop: space(4),
      alignSelf: "flex-start",
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: c.hairlineStrong,
      paddingHorizontal: space(4),
      paddingVertical: space(2),
    },
  });
