import { View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { AppText } from "@/components/ui/primitives";
import { px, radius, space, useColors } from "@/lib/theme";

/* Charts drawn as SVG by hand.
 *
 * A charting library is a lot of weight for three shapes on one screen that
 * only the administrator opens. These are a pie, a bar row and a sparkline;
 * they take numbers and theme tokens and nothing else, so they theme with
 * the rest of the app and ship no dependency.
 */

/** The first colour is the accent, which only the theme knows - pass it in
 *  as `brand`. */
const PALETTE = [
  null,
  "#34c759",
  "#ff9f0a",
  "#af52de",
  "#5ac8fa",
  "#ff375f",
  "#ffd60a",
  "#64d2ff",
];

export function paletteColor(i: number, brand = "#6b2d5c"): string {
  return PALETTE[i % PALETTE.length] ?? brand;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export type Slice = { label: string; value: number };

const TABULAR = { fontVariant: ["tabular-nums" as const] };

/** A donut rather than a pie: the hole carries the total, which is the number
 *  someone actually came to read. */
export function DonutChart({ slices, total }: { slices: Slice[]; total: number }) {
  const c = useColors();
  const sum = slices.reduce((acc, s) => acc + s.value, 0);
  if (sum <= 0) {
    return (
      <View style={{ height: px(176), alignItems: "center", justifyContent: "center" }}>
        <AppText size="xs" tone="muted">
          Nothing recorded yet
        </AppText>
      </View>
    );
  }
  const r = 70;
  const circumference = 2 * Math.PI * r;
  // Offsets computed up front rather than accumulated while rendering: a
  // variable mutated inside JSX is a render with a memory, which React's
  // rules (rightly) refuse.
  const arcs: { slice: Slice; dash: number; offset: number }[] = [];
  slices.reduce((running, slice) => {
    const dash = (slice.value / sum) * circumference;
    arcs.push({ slice, dash, offset: running });
    return running + dash;
  }, 0);

  const size = px(176);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(5) }}>
      <Svg
        viewBox="0 0 180 180"
        width={size}
        height={size}
        accessibilityLabel={slices
          .map((s) => `${s.label}: ${formatTokens(s.value)} (${Math.round((s.value / sum) * 100)}%)`)
          .join(", ")}
      >
        {/* Started at twelve o'clock, as the web's -rotate-90 did. */}
        <G rotation={-90} origin="90, 90">
          {arcs.map(({ slice, dash, offset }, i) => (
            <Circle
              key={slice.label}
              cx={90}
              cy={90}
              r={r}
              fill="none"
              stroke={paletteColor(i, c.brand)}
              strokeWidth={26}
              strokeDasharray={[dash, circumference - dash]}
              strokeDashoffset={-offset}
            />
          ))}
        </G>
      </Svg>
      <View style={{ flex: 1, minWidth: px(160), gap: space(1.5) }}>
        <AppText size="xs" tone="muted" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          Total
        </AppText>
        <AppText size="2xl" weight="semibold">
          {formatTokens(total)}
        </AppText>
        <View style={{ gap: space(1), paddingTop: space(1) }}>
          {slices.map((s, i) => (
            // flex-wrap: on the narrowest phones the figures drop under the
            // label rather than running off the side of the card.
            <View key={s.label} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space(2) }}>
              <View
                style={{ width: px(10), height: px(10), borderRadius: radius.sm, backgroundColor: paletteColor(i, c.brand) }}
              />
              <AppText size="xs" tone="secondary" numberOfLines={1} style={{ flex: 1, flexBasis: px(80), minWidth: 0 }}>
                {s.label}
              </AppText>
              <AppText size="xs" style={TABULAR}>
                {formatTokens(s.value)}
              </AppText>
              <AppText size="xs" tone="muted" style={[{ width: px(40), textAlign: "right" }, TABULAR]}>
                {Math.round((s.value / sum) * 100)}%
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function BarChart({ slices }: { slices: Slice[] }) {
  const c = useColors();
  const max = Math.max(1, ...slices.map((s) => s.value));
  if (slices.length === 0) {
    return (
      <AppText size="xs" tone="muted" style={{ paddingVertical: space(6), textAlign: "center" }}>
        Nothing to show
      </AppText>
    );
  }
  return (
    <View style={{ gap: space(2) }}>
      {slices.map((s, i) => (
        <View key={s.label} style={{ gap: space(1) }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space(3) }}>
            <AppText size="xs" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {s.label}
            </AppText>
            <AppText size="xs" style={TABULAR}>
              {formatTokens(s.value)}
            </AppText>
          </View>
          <View style={{ height: px(8), width: "100%", overflow: "hidden", borderRadius: radius.full, backgroundColor: c.surfaceMuted }}>
            <View
              style={{
                height: "100%",
                width: `${(s.value / max) * 100}%`,
                borderRadius: radius.full,
                backgroundColor: paletteColor(i, c.brand),
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function LineChart({ points }: { points: Slice[] }) {
  const c = useColors();
  if (points.length < 2) {
    return (
      <AppText size="xs" tone="muted" style={{ paddingVertical: space(6), textAlign: "center" }}>
        Not enough days yet
      </AppText>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = 100 / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${30 - (p.value / max) * 28}`)
    .join(" ");
  return (
    <View style={{ gap: space(1.5) }}>
      <Svg viewBox="0 0 100 30" preserveAspectRatio="none" width="100%" height={px(80)}>
        <Path d={path} fill="none" stroke={c.brand} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText size="xs" tone="muted">
          {points[0].label}
        </AppText>
        <AppText size="xs" tone="muted">
          {formatTokens(max)} peak
        </AppText>
        <AppText size="xs" tone="muted">
          {points[points.length - 1].label}
        </AppText>
      </View>
    </View>
  );
}
