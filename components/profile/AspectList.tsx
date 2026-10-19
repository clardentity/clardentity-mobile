import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { AppText, Badge, Button, Input, Spinner } from "@/components/ui/primitives";
import { fonts, fontSize, px, radius, space, useColors } from "@/lib/theme";

/* The profile as a list of separate facts rather than one document.
 *
 * A Markdown blob was readable but not correctable: fixing one wrong sentence
 * meant editing a whole document, and the moment you did, the old `user_edited`
 * latch froze the entire profile against future inference - one correction
 * cost you every future improvement. Aspects are individually removable and
 * individually addable, so a wrong one can be deleted on its own and anything
 * you write yourself survives the next rebuild.
 */

export type Aspect = {
  id: string;
  label: string;
  value: string;
  source: "inferred" | "user";
};

/* Starting points, not a schema. The list exists because "add an aspect" with
   an empty box is a harder question than it looks - these name the kinds of
   thing worth recording. Anything else can be typed. */
const SUGGESTED_LABELS = [
  "Work",
  "Studying",
  "Current focus",
  "How I like explanations",
  "Decisions I'm weighing",
  "Tools I use",
  "Constraints",
  "Things to avoid",
];

const CUSTOM = "__custom__";

export function AspectList({
  aspects,
  onAdd,
  onRemove,
  busy,
  adding,
  onAddingChange,
}: {
  aspects: Aspect[];
  onAdd: (label: string, value: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  busy?: boolean;
  /** The design puts "Add Aspect" in the section header, so the form it
   *  opens is controlled from outside this list. */
  adding?: boolean;
  onAddingChange?: (open: boolean) => void;
}) {
  const c = useColors();
  const [label, setLabel] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const usingCustom = label === CUSTOM;
  const resolvedLabel = usingCustom ? customLabel.trim() : label;
  const canSubmit = Boolean(resolvedLabel && value.trim()) && !saving && !busy;

  async function handleAdd() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onAdd(resolvedLabel, value.trim());
      setLabel("");
      setCustomLabel("");
      setValue("");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await onRemove(id);
    } finally {
      setRemovingId(null);
    }
  }

  // A label already in the list would be an edit, not a new entry, so it is
  // dropped from the menu rather than offered twice.
  const taken = new Set(aspects.map((a) => a.label.toLowerCase()));
  const available = SUGGESTED_LABELS.filter((l) => !taken.has(l.toLowerCase()));

  const lh = { lineHeight: fontSize.sm * 1.25 };

  return (
    <View>
      {aspects.length === 0 && !adding ? (
        <AppText tone="secondary" style={lh}>
          Nothing here yet. This fills in as you use Clardentity, and Add Aspect puts in anything you
          want it to know from the start.
        </AppText>
      ) : (
        // The design's rows: the fact's name, the fact underneath, and the
        // cross that removes it at the right end of the first line.
        <View style={{ gap: space(5) }}>
          {aspects.map((aspect) => (
            <View key={aspect.id}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space(3) }}>
                <View style={{ flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(2) }}>
                  <AppText weight="medium" style={lh}>
                    {aspect.label}
                  </AppText>
                  {aspect.source === "user" && <Badge tone="brand">yours</Badge>}
                </View>
                <Pressable
                  onPress={() => void handleRemove(aspect.id)}
                  disabled={removingId === aspect.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${aspect.label}`}
                  hitSlop={10}
                  style={{ flexShrink: 0, padding: px(2) }}
                >
                  {({ pressed }) =>
                    removingId === aspect.id ? (
                      <Spinner />
                    ) : (
                      <Svg
                        viewBox="0 0 24 24"
                        width={px(24)}
                        height={px(24)}
                        fill="none"
                        stroke={pressed ? c.bandLow : c.inkSecondary}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                      >
                        <Path d="M18 6 6 18M6 6l12 12" />
                      </Svg>
                    )
                  }
                </Pressable>
              </View>
              <AppText tone="secondary" style={[lh, { marginTop: space(1) }]}>
                {aspect.value}
              </AppText>
            </View>
          ))}
        </View>
      )}

      {adding && (
        <View
          style={{
            marginTop: space(8),
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: space(2),
            borderRadius: px(12),
            borderWidth: 1,
            borderColor: c.hairline,
            padding: space(4),
          }}
        >
          {/* The web's <select>: a field that opens a sheet of the choices. */}
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            accessibilityLabel="Aspect"
            accessibilityValue={{ text: label ? (usingCustom ? "Something else" : label) : "What kind of thing?" }}
            style={({ pressed }) => ({
              height: px(40),
              flexDirection: "row",
              alignItems: "center",
              gap: space(2),
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: pressed ? c.brandBorder : c.hairlineStrong,
              backgroundColor: c.surface,
              paddingHorizontal: space(2),
            })}
          >
            <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.ink }}>
              {label ? (usingCustom ? "Something else…" : label) : "What kind of thing?"}
            </Text>
            <Svg viewBox="0 0 16 16" width={px(14)} height={px(14)} fill="none" stroke={c.inkMuted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 6l4 4 4-4" />
            </Svg>
          </Pressable>

          {usingCustom && (
            <Input
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder="Label"
              accessibilityLabel="Custom aspect label"
              style={{ width: px(144) }}
            />
          )}

          {label !== "" && (
            <>
              <Input
                value={value}
                onChangeText={setValue}
                placeholder="What should it know?"
                accessibilityLabel="Aspect value"
                returnKeyType="done"
                onSubmitEditing={() => void handleAdd()}
                style={{ minWidth: px(192), flex: 1, width: undefined }}
              />
              <Button variant="primary" onPress={() => void handleAdd()} disabled={!canSubmit}>
                {saving ? <Spinner color="#ffffff" /> : "Add"}
              </Button>
            </>
          )}
          <Pressable onPress={() => onAddingChange?.(false)} accessibilityRole="button" hitSlop={10}>
            {({ pressed }) => <AppText style={{ color: pressed ? c.ink : c.inkSecondary }}>Cancel</AppText>}
          </Pressable>
        </View>
      )}

      <LabelPicker
        visible={picking}
        options={available}
        selected={label}
        onClose={() => setPicking(false)}
        onPick={(next) => {
          setLabel(next);
          setPicking(false);
        }}
      />
    </View>
  );
}

/** The choices the web's <select> offered, as a sheet from the bottom. */
function LabelPicker({
  visible,
  options,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean;
  options: string[];
  selected: string;
  onClose: () => void;
  onPick: (label: string) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const rows = [...options.map((o) => ({ value: o, text: o })), { value: CUSTOM, text: "Something else…" }];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "70%",
          borderTopLeftRadius: radius["2xl"],
          borderTopRightRadius: radius["2xl"],
          backgroundColor: c.surfaceRaised,
          borderTopWidth: 1,
          borderColor: c.hairline,
          paddingTop: space(3),
          paddingBottom: insets.bottom + space(3),
        }}
      >
        <AppText size="xs" tone="muted" style={{ paddingHorizontal: space(5), paddingBottom: space(2) }}>
          What kind of thing?
        </AppText>
        <ScrollView>
          {rows.map((row) => {
            const isSelected = row.value === selected;
            return (
              <Pressable
                key={row.value}
                onPress={() => onPick(row.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => ({
                  minHeight: 48,
                  justifyContent: "center",
                  paddingHorizontal: space(5),
                  backgroundColor: pressed ? c.surfaceHover : "transparent",
                })}
              >
                <Text
                  style={{
                    fontFamily: isSelected ? fonts.medium : fonts.regular,
                    fontSize: fontSize.base,
                    color: isSelected ? c.brand : c.ink,
                  }}
                >
                  {row.text}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
