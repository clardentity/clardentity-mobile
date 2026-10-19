import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, useFonts } from "@expo-google-fonts/outfit";
import { Stack, usePathname, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { AccentScope, ThemeProvider, useTheme } from "@/lib/theme";
import { TourProvider } from "@/lib/tour";
import { hydrateStorage } from "@/lib/storage";
import { setErrorReportRoute } from "@/lib/errorReport";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { Analytics } from "@/components/system/Analytics";
import { ConsentBanner } from "@/components/system/ConsentBanner";
import { ServerWakingNotice } from "@/components/system/ServerWakingNotice";
import { FullScreenError } from "@/components/system/FullScreenError";

/* The web's app/layout.tsx. The document head (fonts, theme init script,
 * service worker, manifest) became: fonts loaded through expo-font, the
 * stored theme and session read from disk before the first frame (the job
 * the theme init script did - no flash of the wrong palette), and app.json
 * for what the manifest declared. The providers and the always-mounted
 * overlays are the same, in the same order. */

void SplashScreen.preventAutoHideAsync().catch(() => {});

/** app/error.tsx and app/global-error.tsx: the whole-app fallback. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <FullScreenError error={error} reset={retry} />;
}

function Frame() {
  const { theme, colors } = useTheme();
  const pathname = usePathname();
  useEffect(() => setErrorReportRoute(pathname), [pathname]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <TourProvider>
        <AccentScope />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: "fade" }} />
        <TourOverlay />
        <Analytics />
        <ConsentBanner />
        <ServerWakingNotice />
      </TourProvider>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, GeistMono_400Regular });
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    void hydrateStorage().finally(() => setStorageReady(true));
  }, []);

  const ready = fontsLoaded && storageReady;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <Frame />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
