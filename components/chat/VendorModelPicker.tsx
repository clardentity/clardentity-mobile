import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { ChatSheet, afterSheetCloses } from "@/components/chat/ChatSheet";
import { track } from "@/lib/analytics";
import {
  getChoice,
  getModels,
  getServerSnapshot,
  loadModels,
  setChoice,
  subscribe,
  type PickableModel,
} from "@/lib/pickableModels";
import { fonts, fontSize, px, radius, space, useThemedStyles, type Colors } from "@/lib/theme";

/* Pick the model by name.
 *
 * Shown in every mode since 2026-10-16, but only Co-Creative lets you pick:
 * there the user is choosing a tool rather than consulting a companion, so
 * the real names are live and the system prompt is relaxed to match.
 * Everywhere else the list is shown `locked` - Auto selectable, every named
 * model greyed - because choosing one there is part of a paid plan, and a
 * greyed row says so where hiding the menu said nothing. Tapping one opens
 * the plans (`onLocked`). The companion itself still never names its model
 * in those modes; the server ignores a model sent from them.
 *
 * Grouped by vendor, the way Cursor does it, because the vendor is most of
 * what the name means to someone choosing. "Auto" leads and is the default:
 * the point is to allow a choice, not to require one.
 *
 * The web's menu opened above the chip; here it is a sheet from the bottom
 * edge, closed by the backdrop or Android's back button.
 */

export function VendorModelPicker({
  mode,
  disabled,
  locked = false,
  onLocked,
}: {
  mode: string;
  disabled?: boolean;
  /** Named models are shown greyed and cannot be chosen here. */
  locked?: boolean;
  onLocked?: (label: string) => void;
}) {
  const s = useThemedStyles(styles);
  const version = useSyncExternalStore(subscribe, () => getModels(), getServerSnapshot);
  const models = version ?? [];
  const chosen = useSyncExternalStore(subscribe, () => getChoice(mode), getServerSnapshot);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void loadModels(mode);
  }, [mode]);

  // Nothing configured on this deployment: say nothing rather than show an
  // empty menu.
  if (!models.length) return null;

  // A choice remembered from before a mode was locked does not count.
  const current = locked ? undefined : models.find((m) => m.id === chosen);
  const byVendor = models.reduce<Record<string, PickableModel[]>>((acc, m) => {
    (acc[m.vendor] ??= []).push(m);
    return acc;
  }, {});

  function choose(id: string | null) {
    setChoice(mode, id);
    setOpen(false);
    track("model_picked", { mode, model: id ?? "auto" });
  }

  return (
    <View style={{ flexShrink: 0 }}>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: Boolean(disabled) }}
        accessibilityHint={
          locked
            ? "Clardentity picks the model in this mode - choosing one comes with a paid plan"
            : "Choose which model answers in this mode"
        }
        onPress={() => setOpen((v) => !v)}
        hitSlop={{ top: 6, bottom: 6 }}
        style={({ pressed }) => [s.chip, pressed && { backgroundColor: s.colors.surfaceHover }, disabled && { opacity: 0.5 }]}
      >
        <Text style={s.chipText} numberOfLines={1}>
          {current ? current.label : "Auto"}
        </Text>
        <Svg
          viewBox="0 0 24 24"
          width={px(14)}
          height={px(14)}
          fill="none"
          style={open ? { transform: [{ rotate: "180deg" }] } : undefined}
        >
          <Path d="m6 9 6 6 6-6" stroke={s.colors.inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      <ChatSheet open={open} onClose={() => setOpen(false)} title="Model" accessibilityLabel="Model">
        <Row label="Auto" blurb="Clardentity picks for each question." selected={!current} onClick={() => choose(null)} />
        {locked && (
          <Text style={s.lockedNote}>
            Choosing a model yourself is part of Co-Creative today, and comes to the other companions with a paid
            plan.
          </Text>
        )}
        {Object.entries(byVendor).map(([vendor, entries]) => (
          <View key={vendor}>
            <Text style={s.vendor}>{vendor.toUpperCase()}</Text>
            {entries.map((m) => (
              <Row
                key={m.id}
                label={m.label}
                blurb={m.blurb}
                selected={!locked && chosen === m.id}
                locked={locked}
                onClick={() => {
                  if (locked) {
                    setOpen(false);
                    track("locked_mode_tapped", { mode, via: "model_picker" });
                    afterSheetCloses(() => onLocked?.(m.label));
                    return;
                  }
                  choose(m.id);
                }}
              />
            ))}
          </View>
        ))}
      </ChatSheet>
    </View>
  );
}

function Row({
  label,
  blurb,
  selected,
  locked = false,
  onClick,
}: {
  label: string;
  blurb: string;
  selected: boolean;
  /** Shown, greyed, and a door to the plans rather than a choice. */
  locked?: boolean;
  onClick: () => void;
}) {
  const s = useThemedStyles(styles);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: locked }}
      accessibilityHint={locked ? `${label} - included in a paid plan` : undefined}
      onPress={onClick}
      style={({ pressed }) => [
        s.row,
        (selected || (pressed && !locked)) && { backgroundColor: s.colors.surfaceHover },
        locked && { opacity: pressed ? 0.6 : 0.45 },
      ]}
    >
      <View style={s.rowHead}>
        <Text style={s.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        {locked && (
          <Svg viewBox="0 0 24 24" width={px(14)} height={px(14)} fill="none">
            <Rect x="5" y="11" width="14" height="10" rx="2" stroke={s.colors.inkMuted} strokeWidth="2" />
            <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={s.colors.inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
        {selected && (
          <Svg viewBox="0 0 24 24" width={px(16)} height={px(16)} fill="none">
            <Path d="M20 6 9 17l-5-5" stroke={s.colors.brand} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
      <Text style={s.rowBlurb}>{blurb}</Text>
    </Pressable>
  );
}

const styles = (c: Colors) => ({
  colors: c,
  ...StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(1),
      borderRadius: radius.md,
      paddingHorizontal: space(2),
      paddingVertical: space(1),
    },
    chipText: { maxWidth: px(144), fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.inkMuted },
    lockedNote: {
      marginHorizontal: space(2.5),
      marginBottom: space(1),
      marginTop: space(1.5),
      borderRadius: radius.md,
      backgroundColor: c.surfaceMuted,
      paddingHorizontal: space(2),
      paddingVertical: space(1.5),
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.375,
      color: c.inkMuted,
    },
    vendor: {
      paddingHorizontal: space(2.5),
      paddingBottom: space(1),
      paddingTop: space(2),
      fontFamily: fonts.medium,
      fontSize: fontSize.xs,
      letterSpacing: 0.6,
      color: c.inkMuted,
    },
    row: { borderRadius: px(8), paddingHorizontal: space(2.5), paddingVertical: space(2) },
    rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(2) },
    rowLabel: { flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.ink },
    rowBlurb: { fontFamily: fonts.regular, fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.375, color: c.inkMuted },
  }),
});
