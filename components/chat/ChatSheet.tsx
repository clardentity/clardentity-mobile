import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui/primitives";
import { px, radius, space, useThemedStyles, type Colors } from "@/lib/theme";

/* The bottom sheet the chat's menus open in.
 *
 * On the web these were popovers anchored to their button - the model menu
 * above the composer, the chat row's "..." under its row - closed by a click
 * outside or Escape. A phone has no room to anchor a popover beside a thumb,
 * so each becomes a sheet from the bottom edge: a tap on the dimmed backdrop
 * closes it, and so does Android's back button (onRequestClose). Native
 * only; no PWA counterpart. */

/** Run `fn` once a sheet that is closing has gone. iOS refuses to present a
 *  second modal (the plans dialog, say) while the first is still animating
 *  out, so the hand-off waits for the slide; Android has no such rule. */
export function afterSheetCloses(fn: () => void) {
  setTimeout(fn, Platform.OS === "ios" ? 350 : 0);
}

export function ChatSheet({
  open,
  onClose,
  title,
  children,
  maxHeightRatio = 0.7,
  accessibilityLabel,
}: {
  open: boolean;
  onClose: () => void;
  /** The small uppercase heading over the rows, when there is one. */
  title?: string;
  children: ReactNode;
  /** How much of the screen the sheet may take before it scrolls. */
  maxHeightRatio?: number;
  accessibilityLabel?: string;
}) {
  const s = useThemedStyles(styles);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[s.sheet, { maxHeight: height * maxHeightRatio, paddingBottom: Math.max(insets.bottom, space(3)) }]}
        >
          <View style={s.handle} />
          {title ? (
            <AppText size="xs" weight="semibold" tone="muted" style={s.title}>
              {title.toUpperCase()}
            </AppText>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
      backgroundColor: c.surfaceRaised,
      borderTopLeftRadius: radius["2xl"],
      borderTopRightRadius: radius["2xl"],
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: c.hairline,
      paddingTop: space(2),
    },
    handle: {
      alignSelf: "center",
      width: px(36),
      height: 4,
      borderRadius: 2,
      backgroundColor: c.hairlineStrong,
      marginBottom: space(2),
    },
    title: { paddingHorizontal: space(4), paddingBottom: space(1), letterSpacing: 0.6 },
    content: { paddingHorizontal: space(2), paddingBottom: space(1) },
  });
