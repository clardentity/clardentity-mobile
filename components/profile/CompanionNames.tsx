import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { COGNITIVE_MODES } from "@/lib/modes";
import { saveCompanionNames, useCompanionNames } from "@/lib/companionNames";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { AppText } from "@/components/ui/primitives";
import { fonts, fontSize, px, space, useColors } from "@/lib/theme";

/* Name your companion, per mode.
 *
 * One name each rather than one overall: the modes behave differently enough
 * that people think of them separately, and naming them separately is what
 * makes "this suits Nick" mean something in the mode nudge.
 *
 * Blank is a real answer, not an incomplete form - an unnamed mode goes by its
 * own label, which is what the row shows as "(Default)".
 *
 * The design draws this as a read-only table with a pencil on each row rather
 * than eight open text boxes, and that is the right shape: seven of the eight
 * rows are almost never touched, and a page of empty inputs asks to be filled
 * in. A row becomes a field only when its pencil is used, and commits on
 * the keyboard's Done or on leaving it.
 */

const MAX = 24;

export function CompanionNames() {
  const c = useColors();
  const saved = useCompanionNames();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  // Done and the blur that follows it both commit, from the same render; the
  // ref lets only the first one count.
  const editingRef = useRef<string | null>(null);

  function open(mode: string) {
    setState("idle");
    setDraft(saved[mode] ?? "");
    editingRef.current = mode;
    setEditing(mode);
  }

  async function commit(mode: string) {
    if (editingRef.current !== mode) return;
    editingRef.current = null;
    const value = draft.trim();
    setEditing(null);
    if (value === (saved[mode] ?? "")) return;

    // The store takes the whole set, so the untouched rows are sent back as
    // they are and only this one changes.
    const next: Record<string, string> = {};
    for (const m of COGNITIVE_MODES) {
      const current = m.value === mode ? value : saved[m.value] ?? "";
      if (current) next[m.value] = current;
    }
    setState("saving");
    try {
      await saveCompanionNames(next);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  const text = { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.25 };

  return (
    <View>
      <View style={{ maxWidth: px(569), gap: space(5) }}>
        {COGNITIVE_MODES.map((mode) => {
          const name = saved[mode.value] ?? "";
          const isEditing = editing === mode.value;
          const action = name ? `Rename ${mode.label}` : `Name ${mode.label}`;
          return (
            // Rows at least a finger apart, so each pencil's tap area is its
            // own rather than shared with the row above.
            <View key={mode.value} style={{ flexDirection: "row", alignItems: "center", gap: space(4), minHeight: 44 }}>
              <View style={{ width: px(200), maxWidth: "45%", flexShrink: 0, flexDirection: "row", alignItems: "center", gap: space(2) }}>
                <MaskIcon src={mode.icon} size={px(24)} />
                <Text style={[text, { color: c.ink, flexShrink: 1 }]} numberOfLines={1}>
                  {mode.label}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space(2) }}>
                {isEditing ? (
                  <TextInput
                    autoFocus
                    value={draft}
                    maxLength={MAX}
                    onChangeText={setDraft}
                    onBlur={() => void commit(mode.value)}
                    onSubmitEditing={() => void commit(mode.value)}
                    returnKeyType="done"
                    accessibilityLabel={`Name for ${mode.label}`}
                    placeholder={`${mode.label} (Default)`}
                    placeholderTextColor={c.inkMuted}
                    style={[
                      text,
                      {
                        flex: 1,
                        minWidth: 0,
                        color: c.ink,
                        borderBottomWidth: 1,
                        borderBottomColor: c.brandBorder,
                        paddingVertical: 0,
                        paddingBottom: px(2),
                        paddingHorizontal: 0,
                      },
                    ]}
                  />
                ) : (
                  <Text style={[text, { flex: 1, minWidth: 0, color: name ? c.ink : c.inkSecondary }]} numberOfLines={1}>
                    {name || `${mode.label} (Default)`}
                  </Text>
                )}
                <Pressable
                  onPress={() => (isEditing ? void commit(mode.value) : open(mode.value))}
                  accessibilityRole="button"
                  accessibilityLabel={action}
                  hitSlop={10}
                  style={{ flexShrink: 0, padding: px(2) }}
                >
                  {({ pressed }) => (
                    <Svg
                      viewBox="0 0 24 24"
                      width={px(24)}
                      height={px(24)}
                      fill="none"
                      stroke={pressed ? c.brand : c.inkSecondary}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
                      <Path d="M13.5 6.5l4 4" />
                    </Svg>
                  )}
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      {state === "error" && (
        <AppText tone="low" style={{ marginTop: space(4) }}>
          Could not save that name. Try again.
        </AppText>
      )}
    </View>
  );
}
