import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";
import { UpgradeDialog } from "@/components/chat/UpgradeDialog";
import { GemIcon, PlanTiers } from "@/components/system/PlanTiers";
import { TourTarget } from "@/components/tour/TourOverlay";

/* The account card's menu.
 *
 * The foot of the sidebar used to be a card you clicked to reach the profile
 * with a log-out icon bolted to its right - a door-with-an-arrow glyph that
 * means "exit" to people who already know it means exit. Everything the
 * account can do now lives behind the card itself: where you are, what the
 * app does, and the way out, named in words.
 *
 * Upgrade sits beside Profile and Settings because a plan is a fact about
 * the account, like the other two. It opens the Clar tiers in place - the
 * menu turns into the list, with a way back - rather than a second popup
 * stacked on the first, and a locked tier opens the plans dialog.
 *
 * It opens upwards because the card is the last thing in the drawer, and
 * grows from that corner rather than fading in the middle of the screen - a
 * menu should look like it came from the thing you pressed. Natively the
 * panel sits in the drawer's flow just above the card (the recents list
 * gives up the room), rather than floating over it: a view drawn outside its
 * parent's bounds doesn't receive touches on Android.
 */

function MenuIcon({ children, color }: { children: ReactNode; color: string }) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={px(20)}
      height={px(20)}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

function PersonIcon({ color }: { color: string }) {
  return (
    <MenuIcon color={color}>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </MenuIcon>
  );
}

function GearIcon({ color }: { color: string }) {
  return (
    <MenuIcon color={color}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </MenuIcon>
  );
}

function LeaveIcon({ color }: { color: string }) {
  return (
    <MenuIcon color={color}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="M16 17l5-5-5-5M21 12H9" />
    </MenuIcon>
  );
}

/* Mounted with the route as its key, so a navigation by any other means -
 * the back button, a link elsewhere in the shell - takes the open menu with
 * it. Closing it in an effect would be a setState the render could have done
 * by simply not existing. */
export function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const c = useColors();
  const s = useThemedStyles(styles);
  const reducedMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  // Which face of the menu is showing: the account's verbs, or its plans.
  const [view, setView] = useState<"account" | "plans">("account");
  const [upsell, setUpsell] = useState<string | null>(null);

  const name = user?.display_name || "Signed in";
  const initial = (user?.display_name || user?.email || "?").slice(0, 1).toUpperCase();

  function close() {
    setOpen(false);
    setView("account");
  }

  function go(href: string) {
    close();
    onNavigate?.();
    router.push(href);
  }

  return (
    <View>
      {open && (
        <Animated.View
          accessibilityRole="menu"
          accessibilityLabel="Account"
          // Grown from the card's corner: a short rise and fade, as the web's
          // account-menu-in, and none at all under Reduce Motion.
          entering={reducedMotion ? undefined : FadeIn.duration(140).easing(Easing.bezier(0.2, 0.8, 0.3, 1))}
          style={s.panel}
        >
          {view === "plans" ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to account menu"
                onPress={() => setView("account")}
                style={({ pressed }) => [s.back, pressed && { backgroundColor: c.surfaceHover }]}
              >
                <Svg
                  viewBox="0 0 24 24"
                  width={px(14)}
                  height={px(14)}
                  fill="none"
                  stroke={c.inkMuted}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="m15 18-6-6 6-6" />
                </Svg>
                <Text style={s.backText}>Plans</Text>
              </Pressable>
              <View style={s.rule} />
              <PlanTiers
                onLocked={(label) => {
                  track("locked_mode_tapped", { mode: label, via: "plans_menu" });
                  close();
                  setUpsell(label);
                }}
              />
            </>
          ) : (
            <>
              <Text numberOfLines={1} style={s.email}>
                {user?.email}
              </Text>
              <View style={s.rule} />
              <Item icon={<PersonIcon color={c.ink} />} label="Profile" onPress={() => go("/profile")} />
              <Item icon={<GearIcon color={c.ink} />} label="Settings" onPress={() => go("/settings")} />
              <Item
                icon={<GemIcon size={px(20)} />}
                label="Upgrade"
                onPress={() => {
                  track("plans_opened", { via: "account_menu" });
                  setView("plans");
                }}
              />
              <View style={s.rule} />
              <Item
                icon={<LeaveIcon color={c.ink} />}
                label="Log out"
                onPress={() => {
                  close();
                  // Only sign out; RequireAuth (which this menu always sits
                  // inside) sees the user go and replaces the screen with
                  // /login - replace, so Back does not return to the shell.
                  // Navigating here as well issued a second identical
                  // replace() in the same tick, which the router could drop.
                  logout();
                }}
              />
            </>
          )}
        </Animated.View>
      )}

      <TourTarget id="nav-profile">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Account: ${name}`}
          accessibilityState={{ expanded: open }}
          onPress={() => {
            setOpen((v) => !v);
            setView("account");
          }}
          style={({ pressed }) => [s.card, pressed && { backgroundColor: c.surfaceHover }]}
        >
          <View style={s.initial}>
            <Text style={s.initialText}>{initial}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={s.name}>
              {name}
            </Text>
            <Text numberOfLines={1} style={s.cardEmail}>
              {user?.email}
            </Text>
          </View>
          <Chevron open={open} color={c.inkMuted} />
        </Pressable>
      </TourTarget>

      <UpgradeDialog open={upsell !== null} trigger={upsell} onClose={() => setUpsell(null)} />
    </View>
  );
}

function Item({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  const c = useColors();
  const s = useThemedStyles(styles);
  return (
    <Pressable
      accessibilityRole="menuitem"
      onPress={onPress}
      style={({ pressed }) => [s.item, pressed && { backgroundColor: c.surfaceHover }]}
    >
      {icon}
      <Text style={s.itemText}>{label}</Text>
    </Pressable>
  );
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={px(16)}
      height={px(16)}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
    >
      <Path d="m18 15-6-6-6 6" />
    </Svg>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    panel: {
      marginBottom: space(2),
      marginRight: space(2),
      minWidth: px(200),
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surfaceRaised,
      padding: space(1.5),
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(3),
      borderRadius: 8,
      paddingHorizontal: space(2.5),
      paddingVertical: space(2),
    },
    itemText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.ink },
    back: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(1.5),
      borderRadius: 8,
      paddingHorizontal: space(2),
      paddingVertical: space(1.5),
    },
    backText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.inkMuted },
    rule: { marginVertical: space(1), height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
    email: {
      paddingHorizontal: space(2.5),
      paddingBottom: space(1.5),
      paddingTop: space(1),
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: c.inkMuted,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(2.5),
      borderRadius: radius.lg,
      padding: space(1),
      minHeight: 44,
    },
    initial: {
      width: px(32),
      height: px(32),
      borderRadius: px(16),
      backgroundColor: c.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    initialText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: "#ffffff" },
    name: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.ink },
    cardEmail: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted },
  });
