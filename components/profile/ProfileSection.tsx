import { useState, type ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "@/components/ui/primitives";
import { fonts, fontSize, px, space, useColors } from "@/lib/theme";

/** One band of the profile page: a heading over a line of explanation,
 *  whatever control belongs to the band on the right of that row, the band's
 *  own content underneath, and a hairline closing it off. No cards - the rule
 *  is the only separation on this page.
 *
 *  The sizes are a step below the design's, which drew this page on its own
 *  and set it 28px over 20px. Next to the sidebar - 16px for every nav row -
 *  that read as a different app, so the ladder is 20 over 16: the explanation
 *  now matches the navigation exactly, and the heading is the one thing on the
 *  row that is bigger than it. */
export function ProfileSection({
  title,
  description,
  action,
  children,
  style,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children?: ReactNode;
  /** The web's className; the last band passes { borderBottomWidth: 0 }. */
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View
      style={[
        { borderBottomWidth: 1, borderBottomColor: c.hairline, paddingVertical: space(9) },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: space(4) }}>
        {/* flex-1 as well as min-w-0: without it the description sets this
            block's width, and pushes the button onto its own line. */}
        <View style={{ minWidth: px(200), flex: 1 }}>
          <AppText size="xl" weight="medium" accessibilityRole="header" style={{ lineHeight: fontSize.xl * 1.2 }}>
            {title}
          </AppText>
          <AppText tone="secondary" style={{ lineHeight: fontSize.sm * 1.25 }}>
            {description}
          </AppText>
        </View>
        {action ? <View style={{ flexDirection: "row", flexShrink: 0, alignItems: "center", gap: space(2) }}>{action}</View> : null}
      </View>
      {children ? <View style={{ marginTop: space(9) }}>{children}</View> : null}
    </View>
  );
}

/** The design's one button shape outside the brand pills: 42px tall, a
 *  hairline, no fill, with 16px text to match the bands it sits in. Used for Rebuild, Add Aspect and Delete Account, which
 *  is the only one that wears the warning colour. */
export function OutlineButton({
  children,
  onClick,
  disabled,
  danger,
  title,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Natively there is no tooltip; used as the accessibility hint. */
  title?: string;
  ariaLabel?: string;
}) {
  const c = useColors();
  const [pressed, setPressed] = useState(false);
  const color = danger ? c.bandLow : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      accessibilityHint={title}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onClick}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={{ top: 1, bottom: 1 }}
      style={{
        height: px(42),
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: space(2),
        borderRadius: px(34),
        borderWidth: 1,
        borderColor: danger ? c.bandLowBorder : c.hairlineStrong,
        backgroundColor: pressed && !disabled ? (danger ? c.bandLowBg : c.surfaceHover) : "transparent",
        paddingHorizontal: px(21),
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {typeof children === "string" ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color }} numberOfLines={1}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
