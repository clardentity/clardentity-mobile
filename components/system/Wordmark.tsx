import { router } from "expo-router";
import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { fonts, px, useColors } from "@/lib/theme";

/** The name with its mark, for the pages outside the app shell: sign in, sign
 *  up, the password flows, the welcome questions, the legal pages.
 *
 *  Those all showed the word on its own, which is the one place the product
 *  introduces itself to someone who has not seen it before - and introduced
 *  itself without its face. The mark is painted from the accent, so it is the
 *  same mark the sidebar and the marketing page draw. */
export function Wordmark({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
      <Pressable onPress={() => router.push("/")}
        accessibilityRole="link"
        accessibilityLabel="Clardentity"
        style={[{ flexDirection: "row", alignItems: "center", gap: px(3.7), alignSelf: "flex-start" }, style]}
      >
        <MaskIcon src="/ui/logo-dots.svg" width={px(23.029)} height={px(22.275)} color={c.brand} />
        <Text style={{ fontFamily: fonts.regular, fontSize: px(18.563), color: c.ink }}>Clardentity</Text>
      </Pressable>
  );
}
