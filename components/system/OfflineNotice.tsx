import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnline } from "@/lib/useOnline";
import { fonts, fontSize, radius, space, useColors } from "@/lib/theme";
import { TOPBAR_HEIGHT } from "@/components/system/shellMetrics";

/** A quiet pill under the top bar while the device has no network. Nothing
 *  on the page is taken away - what's loaded stays readable - it only says
 *  that what you do now won't reach the server, before an action fails and
 *  says it louder. Goes away by itself when the connection comes back. */
export function OfflineNotice() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const c = useColors();
  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: insets.top + TOPBAR_HEIGHT + 8,
        zIndex: 30,
        alignItems: "center",
        paddingHorizontal: space(4),
      }}
    >
      {!online && (
        <Text
          testID="offline-notice"
          accessibilityRole="alert"
          style={{
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: c.hairlineStrong,
            backgroundColor: c.surfaceRaised,
            paddingHorizontal: space(4),
            paddingVertical: space(2),
            fontFamily: fonts.regular,
            fontSize: fontSize.sm,
            color: c.ink,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          You're offline. Nothing new will be saved until you reconnect.
        </Text>
      )}
    </View>
  );
}
