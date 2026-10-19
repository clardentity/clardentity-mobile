import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* The web's components/ui/primitives.tsx, in React Native. Same names, same
 * variants and sizes; Tailwind classes became StyleSheet values read from
 * the theme tokens. Hover states became pressed states. */

/** Kept for parity with the web: joins class names. Native code passes style
 *  arrays instead, so this only ever sees strings ported verbatim. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ text -- */

type Tone = "ink" | "secondary" | "muted" | "brand" | "low" | "high" | "mid" | "inverse";
type Size = keyof typeof fontSize;
type Weight = "regular" | "medium" | "semibold";

function toneColor(c: Colors, tone: Tone): string {
  switch (tone) {
    case "secondary":
      return c.inkSecondary;
    case "muted":
      return c.inkMuted;
    case "brand":
      return c.brand;
    case "low":
      return c.bandLow;
    case "high":
      return c.bandHigh;
    case "mid":
      return c.bandMid;
    case "inverse":
      return c.inkInverse;
    default:
      return c.ink;
  }
}

/** Text in the app's type: Outfit, a size from the web's scale, a tone from
 *  the palette. Every string on screen goes through this or a Text styled
 *  from the same tokens. */
export function AppText({
  size = "sm",
  weight = "regular",
  tone = "ink",
  style,
  children,
  ...rest
}: TextProps & { size?: Size; weight?: Weight; tone?: Tone; style?: StyleProp<TextStyle> }) {
  const colors = useColors();
  return (
    <Text
      style={[
        { fontFamily: fonts[weight], fontSize: fontSize[size], lineHeight: fontSize[size] * 1.45, color: toneColor(colors, tone) },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ card -- */

export function Card({
  children,
  style,
  padded = true,
  tourId,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** Marks this card as a coachmark target. */
  tourId?: string;
}) {
  const s = useThemedStyles(cardStyles);
  return (
    <View nativeID={tourId ? `tour-${tourId}` : undefined} style={[s.card, padded && s.padded, style]}>
      {children}
    </View>
  );
}

const cardStyles = (c: Colors) =>
  StyleSheet.create({
    card: { borderRadius: radius.xl, borderWidth: 1, borderColor: c.hairline, backgroundColor: c.surface },
    padded: { padding: space(5) },
  });

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View style={{ marginBottom: space(4), flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space(4) }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText weight="semibold">{title}</AppText>
        {description ? (
          <AppText tone="muted" style={{ marginTop: space(0.5) }}>
            {description}
          </AppText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

/* ---------------------------------------------------------------- button -- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

export function Button({
  variant = "secondary",
  size = "md",
  style,
  textStyle,
  children,
  disabled,
  icon,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** A string is drawn in the button's own text style; anything else as is. */
  children?: ReactNode;
  icon?: ReactNode;
}) {
  const c = useColors();
  const v = {
    primary: { bg: c.brand, pressed: c.brandDark, border: "transparent", text: "#ffffff" },
    secondary: { bg: c.surface, pressed: c.surfaceHover, border: c.hairlineStrong, text: c.ink },
    ghost: { bg: "transparent", pressed: c.surfaceHover, border: "transparent", text: c.inkSecondary },
    danger: { bg: c.surface, pressed: c.bandLowBg, border: c.bandLowBorder, text: c.bandLow },
  }[variant];
  const height = size === "sm" ? px(32) : px(36);
  const padX = size === "sm" ? space(2.5) : space(3.5);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      // 44pt tap area without changing what is drawn - the web's .tap-area.
      hitSlop={{ top: Math.max(0, (44 - height) / 2), bottom: Math.max(0, (44 - height) / 2), left: 4, right: 4 }}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: padX,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: v.border,
          backgroundColor: pressed && !disabled ? v.pressed : v.bg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: size === "sm" ? space(1.5) : space(2),
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {icon}
      {typeof children === "string" || typeof children === "number" ? (
        <Text
          style={[{ color: v.text, fontFamily: fonts.medium, fontSize: size === "sm" ? fontSize.xs : fontSize.sm }, textStyle]}
          numberOfLines={1}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

/* ----------------------------------------------------------------- input -- */

function useFieldStyle(): TextStyle {
  const c = useColors();
  return {
    width: "100%",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
    backgroundColor: c.surface,
    paddingHorizontal: space(3),
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: c.ink,
  };
}

export function Input({ style, editable, ...rest }: TextInputProps) {
  const base = useFieldStyle();
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.inkMuted}
      editable={editable}
      style={[base, { height: px(44) }, editable === false && { backgroundColor: c.surfaceMuted, color: c.inkMuted }, style]}
      {...rest}
    />
  );
}

export function Textarea({ style, ...rest }: TextInputProps) {
  const base = useFieldStyle();
  const c = useColors();
  return (
    <TextInput
      multiline
      textAlignVertical="top"
      placeholderTextColor={c.inkMuted}
      style={[base, { paddingVertical: space(2), minHeight: px(88) }, style]}
      {...rest}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** Unused natively; kept so web call sites port unchanged. */
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space(1.5) }}>
      <AppText weight="medium">{label}</AppText>
      {children}
      {hint ? (
        <AppText size="xs" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ misc -- */

export function Badge({
  children,
  tone = "neutral",
  style,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "high" | "mid" | "low" | "caution";
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const tones = {
    neutral: [c.surfaceSunken, c.inkSecondary, c.hairline],
    brand: [c.brandSoft, c.brand, c.brandBorder],
    high: [c.bandHighBg, c.bandHigh, c.bandHighBorder],
    mid: [c.bandMidBg, c.bandMid, c.bandMidBorder],
    low: [c.bandLowBg, c.bandLow, c.bandLowBorder],
    caution: [c.cautionBg, c.caution, c.cautionBorder],
  } as const;
  const [bg, fg, border] = tones[tone];
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space(1),
          alignSelf: "flex-start",
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: bg,
          paddingHorizontal: space(1.5),
          paddingVertical: space(0.5),
        },
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text style={{ color: fg, fontFamily: fonts.medium, fontSize: fontSize.xs }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <View style={{ marginBottom: space(6), gap: space(3) }}>
      <View>
        <AppText size="xl" weight="semibold" style={{ letterSpacing: -0.3 }}>
          {title}
        </AppText>
        {description ? (
          <AppText tone="muted" style={{ marginTop: space(1) }}>
            {description}
          </AppText>
        ) : null}
      </View>
      {actions ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(2) }}>{actions}</View> : null}
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={{
        borderRadius: radius.xl,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: c.hairlineStrong,
        backgroundColor: c.surfaceMuted,
        paddingHorizontal: space(6),
        paddingVertical: space(10),
        alignItems: "center",
      }}
    >
      <AppText weight="medium" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      {description ? (
        <AppText tone="muted" style={{ marginTop: space(1), textAlign: "center", maxWidth: 384 }}>
          {description}
        </AppText>
      ) : null}
      {action ? <View style={{ marginTop: space(4) }}>{action}</View> : null}
    </View>
  );
}

export function Spinner({ color, size = "small" }: { color?: string; size?: "small" | "large" }) {
  const c = useColors();
  return <ActivityIndicator accessibilityLabel="Loading" color={color ?? c.inkMuted} size={size} />;
}
