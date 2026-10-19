import { Pressable, Text, View } from "react-native";
import { ACCENTS, setAccent, setTheme, useAppearance, fonts, fontSize, px, space, useColors } from "@/lib/theme";
import { track } from "@/lib/analytics";
import { AppText } from "@/components/ui/primitives";

/* Light or dark, and which accent.
 *
 * Both are subscribed to rather than held here: the theme store is the
 * source of truth everywhere else in the app, and the topbar's own toggle
 * writes one of them from somewhere else entirely. A copy in state would go
 * stale the moment it was used.
 */
export function Appearance() {
  const { accent, theme } = useAppearance();

  return (
    <View style={{ gap: space(8) }}>
      <View>
        <AppText tone="secondary" style={{ marginBottom: space(4) }}>
          Colour
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(3) }}>
          {ACCENTS.map((option) => (
            <Pill
              key={option.value}
              selected={accent === option.value}
              label={option.label}
              swatch={option.swatch}
              onPress={() => {
                setAccent(option.value);
                track("accent_picked", { accent: option.value });
              }}
            />
          ))}
        </View>
      </View>

      <View>
        <AppText tone="secondary" style={{ marginBottom: space(4) }}>
          Light or dark
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(3) }}>
          {(["light", "dark"] as const).map((option) => (
            <Pill
              key={option}
              selected={theme === option}
              label={option === "light" ? "Light" : "Dark"}
              onPress={() => {
                setTheme(option);
                track("theme_picked", { theme: option });
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function Pill({
  selected,
  label,
  swatch,
  onPress,
}: {
  selected: boolean;
  label: string;
  swatch?: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space(2),
        borderRadius: px(34),
        borderWidth: 1,
        borderColor: selected ? c.brandBorder : c.hairlineStrong,
        backgroundColor: selected ? c.brandSoft : pressed ? c.surfaceHover : "transparent",
        paddingVertical: space(2),
        paddingLeft: swatch ? space(2) : space(4),
        paddingRight: space(4),
      })}
    >
      {swatch ? (
        // The accent itself, not a token: this dot has to show what you
        // would be switching to, so it cannot follow the theme that is
        // currently on.
        <View style={{ height: px(24), width: px(24), borderRadius: 9999, backgroundColor: swatch }} />
      ) : null}
      <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: selected ? c.ink : c.inkSecondary }}>{label}</Text>
    </Pressable>
  );
}
