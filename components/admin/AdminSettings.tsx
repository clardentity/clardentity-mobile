import { useEffect, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage } from "@/lib/auth";
import { MODE_BY_VALUE, type CognitiveMode } from "@/lib/modes";
import { space, radius, useColors } from "@/lib/theme";
import {
  AppText,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Spinner,
} from "@/components/ui/primitives";
import { PickerSheet } from "@/components/admin/PickerSheet";

type ScoringWeights = {
  claim_score_weight: number;
  citation_coverage_weight: number;
  relevance_weight: number;
  distortion_penalty: number;
  likely_fact_cutoff: number;
  plausible_cutoff: number;
};

type AvatarGestureMap = {
  knowing: string;
  thinking: string;
  decision: string;
  learning: string;
  creative: string;
  guidance: string;
  healthcare: string;
  legal: string;
};

type FeatureFlags = {
  tts_enabled: boolean;
  image_input_enabled: boolean;
  bias_screening_enabled: boolean;
};

const FLAG_LABELS: Record<keyof FeatureFlags, { label: string; hint: string }> = {
  tts_enabled: {
    label: "Text to speech",
    hint: "Adds a Listen control to assistant messages.",
  },
  image_input_enabled: {
    label: "Image input",
    hint: "Allows images to be attached to a message as vision context.",
  },
  bias_screening_enabled: {
    label: "Decision-domain bias screening",
    hint: "Classifies the decision to scope bias screening and surface a bias watch-list. Screening still runs when off, just unscoped.",
  },
};

type Settings = {
  openai_model: string | null;
  openai_temperature: number | null;
  retrieval_top_k: number;
  scoring_weights: ScoringWeights;
  avatar_gesture_map: AvatarGestureMap;
  feature_flags: FeatureFlags;
};

const GESTURE_OPTIONS = ["presenting", "chin_stroke", "weighing_scales", "open_hand_explaining", "none"];
const MODES: (keyof AvatarGestureMap)[] = [
  "knowing",
  "thinking",
  "decision",
  "learning",
  "creative",
  "guidance",
  "healthcare",
  "legal",
];

/** The web's <input type="number">. The field keeps its own text, so a
 *  half-typed "0." stays on screen instead of snapping back to "0", and
 *  reports a number whenever the text is one. Empty is null where the field
 *  allows it ("Blank omits the parameter entirely"). */
function NumberInput({
  value,
  onChange,
  decimal = true,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  decimal?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <Input
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      value={text}
      onChangeText={(next) => {
        setText(next);
        if (next.trim() === "") return onChange(null);
        const n = Number(next.replace(",", "."));
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export function AdminSettings() {
  const c = useColors();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ settings: Settings }>("/admin/settings")
      .then((data) => {
        if (!cancelled) setSettings(data.settings);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateScoringWeight<K extends keyof ScoringWeights>(key: K, value: number) {
    setSettings((prev) =>
      prev ? { ...prev, scoring_weights: { ...prev.scoring_weights, [key]: value } } : prev,
    );
  }

  function updateGesture(mode: keyof AvatarGestureMap, gesture: string) {
    setSettings((prev) =>
      prev ? { ...prev, avatar_gesture_map: { ...prev.avatar_gesture_map, [mode]: gesture } } : prev,
    );
  }

  function updateFlag(key: keyof FeatureFlags, value: boolean) {
    setSettings((prev) => (prev ? { ...prev, feature_flags: { ...prev.feature_flags, [key]: value } } : prev));
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      // FR14: each key is its own admin_settings row server-side, so persist
      // them independently rather than requiring one combined shape.
      for (const [key, value] of Object.entries(settings)) {
        await apiFetch("/admin/settings", { method: "PUT", body: { key, value } });
      }
      setSavedAt(Date.now());
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const errorBox = (message: string) => (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.bandLowBorder,
        backgroundColor: c.bandLowBg,
        paddingHorizontal: space(3),
        paddingVertical: space(2),
      }}
    >
      <AppText tone="low">{message}</AppText>
    </View>
  );

  if (error && !settings) {
    return <View style={{ paddingHorizontal: space(4), paddingVertical: space(8) }}>{errorBox(error)}</View>;
  }

  if (!settings) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space(24) }}>
        <Spinner />
      </View>
    );
  }

  const divider = { borderTopWidth: 1, borderTopColor: c.hairline };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: space(4), paddingVertical: space(8) }}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader
        title="Admin settings"
        description="Model parameters, scoring weights, avatar gestures, and feature flags. Changes take effect on the next request."
        actions={
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
            {savedAt && <AppText tone="high">Saved</AppText>}
            <Button variant="primary" onPress={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </View>
        }
      />

      <View style={{ gap: space(5) }}>
        <Card>
          <CardHeader title="Model" description="Overrides applied to every generation request." />
          <View style={{ gap: space(4) }}>
            <Field label="OpenAI model" hint="Blank uses the server default.">
              <Input
                value={settings.openai_model ?? ""}
                onChangeText={(text) => update("openai_model", text || null)}
                placeholder="e.g. gpt-5"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
            <Field label="Temperature" hint="Blank omits the parameter entirely.">
              <NumberInput value={settings.openai_temperature} onChange={(n) => update("openai_temperature", n)} />
            </Field>
            <Field label="Retrieval top-k" hint="Chunks retrieved per query.">
              <NumberInput
                decimal={false}
                value={settings.retrieval_top_k}
                onChange={(n) => update("retrieval_top_k", n ?? 0)}
              />
            </Field>
          </View>
        </Card>

        <Card>
          <CardHeader
            title="Scoring weights"
            description="How per-claim scores roll up into a message confidence band (SRS §9.3)."
          />
          <View style={{ gap: space(4) }}>
            {(Object.keys(settings.scoring_weights) as (keyof ScoringWeights)[]).map((key) => (
              <Field key={key} label={key.replace(/_/g, " ")}>
                <NumberInput
                  value={settings.scoring_weights[key]}
                  onChange={(n) => updateScoringWeight(key, n ?? 0)}
                />
              </Field>
            ))}
          </View>
        </Card>

        <Card>
          <CardHeader
            title="Avatar gestures"
            description="Which gesture the companion performs for each cognitive mode."
          />
          <View>
            {MODES.map((mode, i) => (
              <View
                key={mode}
                style={[
                  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(4), paddingVertical: space(2.5) },
                  i === 0 ? { paddingTop: 0 } : divider,
                  i === MODES.length - 1 && { paddingBottom: 0 },
                ]}
              >
                {/* The real label, not the raw enum key - "therapy" alone
                    rendered as "Therapy" here even after the mode's
                    user-facing name changed to "Reflect & Relieve". */}
                <AppText style={{ flexShrink: 1 }}>{MODE_BY_VALUE[mode as CognitiveMode]?.label ?? mode}</AppText>
                <PickerSheet
                  value={settings.avatar_gesture_map[mode]}
                  options={GESTURE_OPTIONS.map((g) => ({ value: g, label: g }))}
                  onChange={(g) => updateGesture(mode, g)}
                  accessibilityLabel={`Gesture for ${MODE_BY_VALUE[mode as CognitiveMode]?.label ?? mode}`}
                />
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <CardHeader title="Feature flags" />
          <View>
            {(Object.keys(FLAG_LABELS) as (keyof FeatureFlags)[]).map((key, i, all) => (
              <View
                key={key}
                style={[
                  { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space(4), paddingVertical: space(3) },
                  i === 0 ? { paddingTop: 0 } : divider,
                  i === all.length - 1 && { paddingBottom: 0 },
                ]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText weight="medium">{FLAG_LABELS[key].label}</AppText>
                  <AppText size="xs" tone="muted" style={{ marginTop: space(0.5) }}>
                    {FLAG_LABELS[key].hint}
                  </AppText>
                </View>
                <Switch
                  value={settings.feature_flags?.[key] ?? true}
                  onValueChange={(on) => updateFlag(key, on)}
                  trackColor={{ true: c.brand, false: c.hairlineStrong }}
                  accessibilityLabel={FLAG_LABELS[key].label}
                />
              </View>
            ))}
          </View>
        </Card>

        {error && errorBox(error)}
      </View>
    </ScrollView>
  );
}
