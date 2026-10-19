import { Link, Slot, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { ScrollView, View, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wordmark } from "@/components/system/Wordmark";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { fonts, fontSize, px, space, useColors } from "@/lib/theme";

/* Legal pages sit outside the app shell: they have to be readable by someone
   who has not signed up yet - that is the entire point of showing them at the
   sign-up form - so no RequireAuth, no sidebar, just the document. The header
   stays put above the scrolling document, as the web's sticky one does. */
export default function LegalLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const scrollRef = useRef<ScrollViewInstance | null>(null);

  // One scroll view serves both documents, so moving between them starts the
  // next one at its top rather than wherever the last one was left.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [pathname]);

  const linkStyle = (href: string) => ({
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: pathname === href ? c.ink : c.inkSecondary,
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <View
        style={{
          paddingTop: insets.top,
          borderBottomWidth: 1,
          borderBottomColor: c.hairline,
          backgroundColor: c.canvas,
        }}
      >
        {/* flex-wrap: on the narrowest phones (a folded Galaxy, 280px) the links
            drop under the wordmark instead of pushing the theme toggle off
            the side of the screen. */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            rowGap: space(1),
            paddingHorizontal: space(4),
            paddingVertical: space(3),
          }}
        >
          <Wordmark />
          {/* replace: switching between the two documents swaps the page, so
              Back still returns to wherever they were opened from (the
              sign-up form) instead of stepping through each one read. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(4) }}>
            <Link href="/privacy" replace style={linkStyle("/privacy")}>
              Privacy
            </Link>
            <Link href="/terms" replace style={linkStyle("/terms")}>
              Terms
            </Link>
            <ThemeToggle />
          </View>
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          width: "100%",
          maxWidth: px(768),
          alignSelf: "center",
          paddingHorizontal: space(4),
          paddingTop: space(10),
          paddingBottom: insets.bottom + space(10),
        }}
      >
        <Slot />
      </ScrollView>
    </View>
  );
}
