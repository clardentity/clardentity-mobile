import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { px, radius, space, toggleTheme, useColors, useTheme } from "@/lib/theme";
import { TourTarget } from "@/components/tour/TourOverlay";

/** Sun/moon switch. Shows the theme you'd switch *to*, which is the convention
 *  people read correctly - a moon means "go dark", not "you are dark".
 *
 *  The web rendered both icons and let CSS keyed on [data-theme] pick one, so
 *  the server-rendered first paint was right. Natively the theme is known
 *  before the first frame (storage is hydrated first), so it simply picks. */
export function ThemeToggle({ style, tourId }: { style?: StyleProp<ViewStyle>; tourId?: string }) {
  const c = useColors();
  const { theme } = useTheme();
  return (
    <TourTarget id={tourId} style={style}>
      <Pressable
        onPress={toggleTheme}
        accessibilityRole="button"
        accessibilityLabel="Toggle light and dark theme"
        // 44pt tap area around a 28pt control - the web's .tap-target.
        hitSlop={8}
        style={({ pressed }) => ({
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.md,
          padding: space(1.5),
          backgroundColor: pressed ? c.surfaceHover : "transparent",
        })}
      >
        {({ pressed }) => (
          <Svg
            viewBox="0 0 24 24"
            width={px(16)}
            height={px(16)}
            fill="none"
            stroke={pressed ? c.ink : c.inkMuted}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {theme === "light" ? (
              <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            ) : (
              <G>
                <Circle cx="12" cy="12" r="4" />
                <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </G>
            )}
          </Svg>
        )}
      </Pressable>
    </TourTarget>
  );
}
