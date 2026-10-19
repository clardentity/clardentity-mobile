import type { ReactNode, Ref } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wordmark } from "@/components/system/Wordmark";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { AppText } from "@/components/ui/primitives";
import { px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* The frame the PWA repeats on every page outside the app shell - sign in,
 * sign up, the password flows, the welcome questions: a centred column with
 * the wordmark over a card, and the theme toggle in the top corner.
 *
 * Natively it is also where the keyboard is handled: the column scrolls, and
 * on iOS it is pushed up by the keyboard (Android resizes the window itself,
 * app.json softwareKeyboardLayoutMode). Taps on a button land while the
 * keyboard is up instead of only dismissing it. */
export function AuthScreen({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: space(4),
          paddingTop: insets.top + space(12),
          paddingBottom: insets.bottom + space(12),
        }}
      >
        {/* max-w-sm on the forms, max-w-lg on the welcome questions. */}
        <View style={{ width: "100%", maxWidth: wide ? px(512) : px(384) }}>
          <View style={{ marginBottom: space(6), alignItems: "center" }}>
            <Wordmark />
          </View>
          {children}
        </View>
      </ScrollView>
      <View style={{ position: "absolute", top: insets.top + space(4), right: space(4) }}>
        <ThemeToggle />
      </View>
    </KeyboardAvoidingView>
  );
}

/** The bordered card the form sits in (`space-y-5 rounded-xl border p-6`). */
export function AuthCard({ children, gap = 5, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  const s = useThemedStyles(styles);
  return <View style={[s.card, { gap: space(gap) }, style]}>{children}</View>;
}

/** The card's title and the line under it. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <View style={{ gap: space(1) }}>
      <AppText size="xl" weight="semibold" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? <AppText tone="muted">{subtitle}</AppText> : null}
    </View>
  );
}

/** Hands a ref to the primitives' Input, which spreads its props onto the
 *  TextInput (React 19 passes `ref` as a prop) but does not declare one in its
 *  type yet. Lets a form move the caret to the next field on "next".
 *  TODO: drop once components/ui/primitives types `ref` on Input. */
export function inputRef(ref: Ref<TextInputInstance> | undefined): TextInputProps {
  return (ref ? { ref } : {}) as unknown as TextInputProps;
}

/** The red box every form in the PWA shows an error in. */
export function ErrorNotice({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useThemedStyles(styles);
  return (
    <View style={[s.error, style]} accessibilityRole="alert">
      <AppText tone="low">{children}</AppText>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      padding: space(6),
    },
    error: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.bandLowBorder,
      backgroundColor: c.bandLowBg,
      paddingHorizontal: space(3),
      paddingVertical: space(2),
    },
  });
