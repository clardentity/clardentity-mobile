import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { AppText } from "@/components/ui/primitives";
import { fonts, fontSize, px, radius, space, useColors } from "@/lib/theme";

/* The admin screens' <select>: a field that shows the current choice, and a
 * sheet from the bottom of the screen to change it. */

export type PickerOption<T extends string> = { value: T; label: string; disabled?: boolean };

export function PickerSheet<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: PickerOption<T>[];
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? value;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ? `${accessibilityLabel}: ${current}` : current}
        style={({ pressed }) => ({
          height: px(36),
          flexDirection: "row",
          alignItems: "center",
          gap: space(1.5),
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.hairlineStrong,
          backgroundColor: pressed ? c.surfaceHover : c.surface,
          paddingHorizontal: space(2.5),
        })}
      >
        <AppText numberOfLines={1} style={{ flexShrink: 1 }}>
          {current}
        </AppText>
        <Svg viewBox="0 0 24 24" width={px(14)} height={px(14)} fill="none" stroke={c.inkMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m6 9 6 6 6-6" />
        </Svg>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityLabel="Close"
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}
        >
          <Pressable
            // Swallows taps so the sheet itself does not close the sheet.
            onPress={() => {}}
            style={{
              backgroundColor: c.surfaceRaised,
              borderTopLeftRadius: radius["2xl"],
              borderTopRightRadius: radius["2xl"],
              paddingTop: space(2),
              paddingBottom: insets.bottom + space(2),
              maxHeight: "70%",
            }}
          >
            <ScrollView>
              {options.map((o) => {
                const selected = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    disabled={o.disabled}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: o.disabled }}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({
                      minHeight: px(48),
                      justifyContent: "center",
                      paddingHorizontal: space(5),
                      backgroundColor: pressed ? c.surfaceHover : "transparent",
                      opacity: o.disabled ? 0.4 : 1,
                    })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <AppText
                        style={{ fontFamily: selected ? fonts.medium : fonts.regular, fontSize: fontSize.base, color: selected ? c.brand : c.ink }}
                      >
                        {o.label}
                      </AppText>
                      {selected && (
                        <Svg viewBox="0 0 24 24" width={px(18)} height={px(18)} fill="none" stroke={c.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M20 6 9 17l-5-5" />
                        </Svg>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
