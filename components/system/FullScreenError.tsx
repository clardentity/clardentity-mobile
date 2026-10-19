import { reloadAppAsync } from "expo";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { AvatarPanel } from "@/components/avatar/AvatarPanel";
import { fonts, fontSize, px, radius, space, useColors } from "@/lib/theme";

/* The screen for when the app itself has fallen over - the shell, the menu,
 * the page all at once - so there is nothing left to keep. Used as the root
 * layout's ErrorBoundary (the web's app/error.tsx and app/global-error.tsx).
 *
 * The companion, a sentence that doesn't blame anyone, Reload first and a
 * way back to the start. `error` is taken to match Expo Router's boundary
 * props; nothing about it is shown. */
export function FullScreenError({ error: _error, reset }: { error: Error; reset: () => void }) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.canvas,
        paddingHorizontal: space(6),
      }}
    >
      <View testID="app-error" style={{ maxWidth: px(320), alignItems: "center" }}>
        <AvatarPanel state="idle" gesture="none" expression="concerned" size={px(112)} />
        <Text
          accessibilityRole="header"
          style={{ marginTop: space(4), fontFamily: fonts.medium, fontSize: fontSize.lg, color: c.ink, textAlign: "center" }}
        >
          Something tripped me up
        </Text>
        <Text
          style={{
            marginTop: space(1.5),
            fontFamily: fonts.regular,
            fontSize: fontSize.sm,
            color: c.inkSecondary,
            textAlign: "center",
          }}
        >
          Nothing you did. Your chats are saved - reloading usually sorts it.
        </Text>
        <Pressable
          accessibilityRole="button"
          // A full reload, not just a re-render: whatever broke the whole app
          // is best cleared by starting it fresh. reset() is the fallback
          // where a reload isn't available (Expo Go on some hosts).
          onPress={() => {
            reset();
            void reloadAppAsync("FullScreenError").catch(() => {});
          }}
          hitSlop={8}
          style={({ pressed }) => ({
            marginTop: space(6),
            borderRadius: radius.full,
            backgroundColor: pressed ? c.brandDark : c.brand,
            paddingHorizontal: space(6),
            paddingVertical: space(2.5),
          })}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: "#ffffff" }}>Reload</Text>
        </Pressable>
        {/* far enough below Reload that the two tap areas don't overlap */}
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            reset();
            router.replace("/start");
          }}
          hitSlop={8}
          style={{ marginTop: space(6) }}
        >
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: fontSize.sm,
              color: c.inkMuted,
              textDecorationLine: "underline",
            }}
          >
            Back to start
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
