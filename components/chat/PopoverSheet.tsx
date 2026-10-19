import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { px, radius, space, useThemedStyles, type Colors } from "@/lib/theme";

/* The native stand-in for the chat's small popovers (the citation card, the
 * confidence breakdown). On the web those were measured, absolutely placed
 * boxes beside the thing tapped; on a phone the same content reads better as
 * a short sheet from the bottom edge, which also needs no measuring and
 * cannot run off the screen. Tapping outside or the back button closes it,
 * as a click outside / Escape did on the web. */

export function PopoverSheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Read by screen readers, as the popover's aria-label was. */
  label?: string;
  children: ReactNode;
}) {
  const s = useThemedStyles(styles);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, space(4)) }]}
          accessibilityViewIsModal
          accessibilityLabel={label}
        >
          <View style={s.grabber} />
          <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: space(4) }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.32)" },
    sheet: {
      maxHeight: "70%",
      backgroundColor: c.surfaceRaised,
      borderTopLeftRadius: radius["2xl"],
      borderTopRightRadius: radius["2xl"],
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: c.hairline,
      paddingTop: space(2),
    },
    grabber: {
      alignSelf: "center",
      width: px(36),
      height: 4,
      borderRadius: 2,
      backgroundColor: c.hairlineStrong,
      marginBottom: space(3),
    },
  });
