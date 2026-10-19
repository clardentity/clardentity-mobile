import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, fontSize, px, space, useColors } from "@/lib/theme";

/* The Clar tiers, as plans.
 *
 * These used to be a chip on the composer - "Auto · Free" with Clar Pro, Max
 * and Ultra in a menu above it - in every mode. That made a plan look like a
 * per-message setting, which it is not: you do not choose a deeper reasoner
 * for one question and a cheaper one for the next, you are on a plan. So
 * they live under Upgrade in the account menu now, next to Profile and
 * Settings, which is where an account's plan belongs.
 *
 * Named by capability rather than by vendor, for the reasons that were on
 * the old picker and still hold: vendor names on the tiers announce the
 * whole vendor set, contradict the identity rules the backend enforces, and
 * turn published API prices into a public cost sheet. Clar is Clardentity's
 * own model family, so the tiers describe what you get.
 *
 * The free tier is "Clar Basic" rather than "Auto": as a plan it needs a
 * name of its own, and "Auto" described routing, not what you have. The
 * "PRO" pill that sat on every paid row is gone too - three rows each
 * labelled Pro, one of which is called Pro, said nothing.
 */

export type PlanTier = {
  id: string;
  label: string;
  blurb: string;
  detail: string;
  /** Not open to this account yet - the row opens the plans dialog. */
  locked: boolean;
};

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "clar-basic",
    label: "Clar Basic",
    blurb: "Clardentity picks for each question.",
    detail:
      "Routes every question to whichever Clar model suits it, so simple questions stay fast and hard ones get the depth they need. Your plan today, and the right one for most work.",
    locked: false,
  },
  {
    id: "clar-pro",
    label: "Clar Pro",
    blurb: "For advanced, specialist work.",
    detail:
      "Holds longer chains of reasoning than Clar Basic and stays precise on technical and domain-specific questions. For work where the answer has to be right in the details, not just broadly correct.",
    locked: true,
  },
  {
    id: "clar-max",
    label: "Clar Max",
    blurb: "Wider context, deeper checking.",
    detail:
      "Reads further into your attachments, searches more widely, and pushes each claim through more verification before it reaches you. For research, long documents, and questions with a lot of ground to cover.",
    locked: true,
  },
  {
    id: "clar-ultra",
    label: "Clar Ultra",
    blurb: "Our most intelligent reasoner.",
    detail:
      "The most capable Clar tier, for problems where getting it right matters more than getting it quickly: ambiguous tradeoffs, novel analysis, and decisions you only make once.",
    locked: true,
  },
];

/** A gem, not a padlock: a locked tier is a plan you can move to, and the
 *  same mark sits on the Upgrade item, so the two read as the same thing.
 *  `size` and `color` replace the web's className (h-3 w-3, text-brand). */
export function GemIcon({ size = px(12), color, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color ?? c.brand}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <Path d="M6 3h12l4 6-10 12L2 9z" />
      <Path d="M2 9h20M9 3l3 18M15 3l-3 18" />
    </Svg>
  );
}

function Check() {
  const c = useColors();
  return (
    <Svg
      viewBox="0 0 24 24"
      width={px(14)}
      height={px(14)}
      fill="none"
      stroke={c.brand}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

/** The four rows. A locked row calls `onLocked` with its name, which the
 *  account menu turns into the plans dialog; the current plan just says so.
 *
 *  The web's side card with each tier's longer description appeared on
 *  hover, and only on a screen wide enough to put it beside the sidebar;
 *  on a phone the one-line blurb was the whole story, as it is here. */
export function PlanTiers({ onLocked }: { onLocked: (label: string) => void }) {
  const c = useColors();
  return (
    <View>
      {PLAN_TIERS.map((tier) => (
        <Pressable
          key={tier.id}
          accessibilityRole="menuitem"
          accessibilityState={{ selected: !tier.locked }}
          accessibilityHint={tier.detail}
          onPress={() => {
            if (tier.locked) onLocked(tier.label);
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "flex-start",
            gap: space(2),
            borderRadius: 8,
            paddingHorizontal: space(2.5),
            paddingVertical: space(2),
            backgroundColor: pressed && tier.locked ? c.surfaceHover : "transparent",
          })}
        >
          <View style={{ marginTop: space(0.5), width: px(14), height: px(14), alignItems: "center", justifyContent: "center" }}>
            {tier.locked ? <GemIcon /> : <Check />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.ink }}>{tier.label}</Text>
              {!tier.locked && (
                <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted }}>Your plan</Text>
              )}
            </View>
            <Text
              style={{
                marginTop: space(0.5),
                fontFamily: fonts.regular,
                fontSize: fontSize.xs,
                lineHeight: fontSize.xs * 1.625,
                color: tier.locked ? c.inkMuted : c.inkSecondary,
              }}
            >
              {tier.blurb}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
