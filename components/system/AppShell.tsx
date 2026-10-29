import { router, usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BackHandler,
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/system/ErrorBoundaries";
import { AppNotices } from "@/components/system/AppNotices";
import { OfflineNotice } from "@/components/system/OfflineNotice";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/system/ThemeToggle";
import { ChatRowMenu } from "@/components/chat/ChatRowMenu";
import { rememberWorkspace } from "@/lib/lastWorkspace";
import { startTour, type TourId } from "@/lib/tour";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { AccountMenu } from "@/components/system/AccountMenu";
import { useScrollEdges } from "@/lib/useScrollEdges";
import { markFreshChat } from "@/lib/freshChats";
import { holdTemporaryChat, leaveTemporaryChatUnless } from "@/lib/temporaryChat";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";
import { TourTarget } from "@/components/tour/TourOverlay";
import { SIDEBAR_WIDTH, TOPBAR_HEIGHT } from "@/components/system/shellMetrics";

/* The app shell, phone layout only: a top bar and a drawer from the left.
 *
 * The web's desktop sidebar (always in view, collapsible, remembered in
 * localStorage) has no counterpart here - this app is only ever the phone
 * layout - so neither does its collapse store.
 *
 * Window events the web used between the shell and its neighbours are
 * DeviceEventEmitter events under the same names:
 *   clardentity:open-nav / clardentity:close-nav  (from the tour overlay)
 *   clardentity:conversation-renamed {id, title}  (from ChatView) */

type Workspace = { id: string; name: string; role: string };

/* --------------------------------------------------------------- icons -- */
/* Inline so the shell stays dependency-free; 16px on a 24px grid. */

function Icon({ children, size = px(16), color, dashed }: { children: ReactNode; size?: number; color: string; dashed?: boolean }) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? "2.6 2.6" : undefined}
    >
      {children}
    </Svg>
  );
}

const icons = {
  plus: <Path d="M12 5v14M5 12h14" />,
  chevron: <Path d="m6 9 6 6 6-6" />,
  menu: <Path d="M3 6h18M3 12h18M3 18h18" />,
  admin: <Path d="M3 13h4v7H3zM10 8h4v12h-4zM17 4h4v16h-4z" />,
  close: <Path d="M18 6 6 18M6 6l12 12" />,
  panelLeft: (
    <>
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Path d="M9 3v18" />
    </>
  ),
  help: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" />
      <Path d="M12 17h.01" />
    </>
  ),
};

const BUBBLE = "M21 11.5a8.4 8.4 0 0 1-8.5 8.3 9 9 0 0 1-3.9-.9L3 21l1.6-4.5A8.3 8.3 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5z";

/* ------------------------------------------------------------- drawer -- */

type RecentConversation = {
  id: string;
  title: string | null;
  created_at: string;
  pinned?: boolean;
};

const RECENTS_SHOWN = 12;

/** Recent conversations in the active room.
 *
 *  Its own component so the drawer doesn't re-render on every change of a
 *  fetch it doesn't own, and so "no room selected" is one early return rather
 *  than a condition threaded through the nav. */
function RecentConversations({
  workspaceId,
  workspaces,
  activeId,
  refreshKey,
  onNavigate,
}: {
  workspaceId: string | null;
  /** For the row menu's "Move to workspace". */
  workspaces: Workspace[];
  activeId: string | null;
  refreshKey: number;
  onNavigate?: () => void;
}) {
  const c = useColors();
  const s = useThemedStyles(styles);
  const reducedMotion = usePrefersReducedMotion();
  const [items, setItems] = useState<RecentConversation[]>([]);
  // Total in the workspace, so the list can say when it is showing only the
  // newest few - chats past the cut-off had simply "vanished" as far as
  // anyone could tell from here.
  const [total, setTotal] = useState(0);
  // Bumped by the row menu after a rename, a pin or a move, so the list
  // re-reads (a pin changes the order, a move takes the row out of it).
  const [localKey, setLocalKey] = useState(0);
  const reload = useCallback(() => setLocalKey((n) => n + 1), []);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    apiFetch<RecentConversation[]>(`/chat/conversations?workspace_id=${encodeURIComponent(workspaceId)}`)
      .then((rows) => {
        if (cancelled) return;
        setTotal(rows.length);
        setItems(rows.slice(0, RECENTS_SHOWN));
      })
      .catch(() => {
        // A drawer that can't list history is not worth an error state; the
        // room screen shows the same list with one.
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, refreshKey, activeId, localKey]);

  /** After the row menu has deleted it: drop it from the list, and move off
   *  it if it is what you were reading - the next render would fetch a 404. */
  function remove(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id));
    setTotal((n) => Math.max(0, n - 1));
    if (id === activeId) router.push(workspaceId ? `/workspace/${workspaceId}` : "/workspace");
  }

  const { moreStart, moreEnd, scrollProps } = useScrollEdges("y");

  if (!workspaceId || items.length === 0) return <View style={{ flex: 1 }} />;

  // The list's edges fade where there is more to scroll, as the web's
  // scroll-fade-y did. Hex alpha works because every surface token is #rrggbb.
  const clear = `${c.surfaceMuted}00`;

  return (
    <View style={{ marginTop: space(5), flex: 1, minHeight: 0 }}>
      <Text style={s.recentsLabel}>Recents</Text>
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView {...scrollProps} showsVerticalScrollIndicator={false}>
          {items.map((r, i) => {
            const active = r.id === activeId;
            return (
              <Animated.View
                key={r.id}
                // phone-rise: each row rises into place, a beat after the one
                // above it (capped at ten beats).
                entering={reducedMotion ? undefined : FadeInUp.delay(Math.min(i, 10) * 120).duration(850).easing(Easing.bezier(0.22, 1, 0.36, 1))}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                {/* A 36pt row, 9px radius, a 12px ring and the title - the
                    design's shape, at the height a fingertip needs in a list
                    where a miss opens the wrong chat. */}
                <Pressable
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onNavigate?.();
                    router.push(`/chat/${r.id}`);
                  }}
                  style={({ pressed }) => [
                    s.recentRow,
                    (active || pressed) && { backgroundColor: c.surfaceHover },
                  ]}
                >
                  <MaskIcon src="/ui/recent-dot.svg" size={12} color={active ? c.ink : c.nav} />
                  <Text numberOfLines={1} style={[s.recentText, active && { fontFamily: fonts.medium, color: c.ink }]}>
                    {r.title || "Untitled chat"}
                  </Text>
                </Pressable>
                {/* In the row rather than over it, so the title truncates
                    earlier instead of the control printing across its end. */}
                <View style={{ marginRight: space(1) }}>
                  <ChatRowMenu
                    conversationId={r.id}
                    title={r.title}
                    pinned={Boolean(r.pinned)}
                    workspaceId={workspaceId}
                    workspaces={workspaces}
                    onChanged={reload}
                    onDeleted={() => remove(r.id)}
                  />
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
        {moreStart && <LinearGradient pointerEvents="none" colors={[c.surfaceMuted, clear]} style={[s.fade, { top: 0 }]} />}
        {moreEnd && <LinearGradient pointerEvents="none" colors={[clear, c.surfaceMuted]} style={[s.fade, { bottom: 0 }]} />}
      </View>
      {total > items.length && (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            onNavigate?.();
            router.push(`/workspace/${workspaceId}/search`);
          }}
          style={({ pressed }) => [s.seeAll, pressed && { backgroundColor: c.surfaceHover }]}
        >
          <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted }}>See all {total} chats</Text>
        </Pressable>
      )}
    </View>
  );
}

/* The design's navigation row: 263 x 48, 9px radius, a 24px icon and a 20px
 * label in the warm grey it reserves for chrome. `iconSrc` takes one of the
 * design's own SVGs; `icon` is the inline-path fallback for rows the design
 * does not draw (Admin). */
function NavItem({
  href,
  icon,
  iconSrc,
  children,
  active,
  onNavigate,
  tourId,
}: {
  href: string;
  icon?: ReactNode;
  iconSrc?: string;
  children: ReactNode;
  active: boolean;
  onNavigate?: () => void;
  /** Coachmark target name - see lib/tour.tsx. */
  tourId?: string;
}) {
  const c = useColors();
  const s = useThemedStyles(styles);
  const color = active ? c.ink : c.nav;
  return (
    <TourTarget id={tourId}>
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        onPress={() => {
          onNavigate?.();
          router.push(href);
        }}
        style={({ pressed }) => [s.navRow, (active || pressed) && { backgroundColor: c.surfaceHover }]}
      >
        {iconSrc ? (
          <MaskIcon src={iconSrc} size={24} color={color} />
        ) : (
          <Icon size={24} color={color}>
            {icon}
          </Icon>
        )}
        <Text numberOfLines={1} style={[s.navText, { color }, active && { fontFamily: fonts.medium }]}>
          {children}
        </Text>
      </Pressable>
    </TourTarget>
  );
}

/* The list opens in place under the button, pushing the nav down, rather
 * than floating over it: a dropdown drawn outside its parent's bounds
 * doesn't receive touches on Android. */
function WorkspaceSwitcher({
  workspaces,
  activeId,
  onNavigate,
}: {
  workspaces: Workspace[];
  activeId: string | null;
  onNavigate?: () => void;
}) {
  const c = useColors();
  const s = useThemedStyles(styles);
  const [open, setOpen] = useState(false);
  const active = workspaces.find((w) => w.id === activeId) ?? null;

  function go(href: string) {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  }

  return (
    <TourTarget id="workspace-switcher">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Workspace: ${active?.name ?? "none selected"}`}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [s.switcher, pressed && { backgroundColor: c.surfaceHover }]}
      >
        <View style={s.switcherInitial}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: fontSize.xs, color: "#ffffff" }}>
            {(active?.name ?? "W").slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.ink }}>
          {active?.name ?? "Select a workspace"}
        </Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Icon size={px(14)} color={c.inkMuted}>
            {icons.chevron}
          </Icon>
        </View>
      </Pressable>

      {open && (
        <View accessibilityRole="menu" style={s.switcherMenu}>
          <ScrollView style={{ maxHeight: px(288) }} nestedScrollEnabled>
            {workspaces.length === 0 && (
              <Text style={{ paddingHorizontal: space(2.5), paddingVertical: space(2), fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted }}>
                No workspaces yet
              </Text>
            )}
            {workspaces.map((w) => {
              const current = w.id === activeId;
              return (
                <Pressable
                  key={w.id}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: current }}
                  onPress={() => go(`/workspace/${w.id}`)}
                  style={({ pressed }) => [
                    s.switcherItem,
                    { backgroundColor: current ? c.brandSoft : pressed ? c.surfaceHover : "transparent" },
                  ]}
                >
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: current ? c.brand : c.inkSecondary }}>
                    {w.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, letterSpacing: 0.4, textTransform: "uppercase", color: c.inkMuted }}>
                    {w.role}
                  </Text>
                </Pressable>
              );
            })}
            <View style={{ marginVertical: space(1), height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }} />
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => go("/workspace")}
              style={({ pressed }) => [s.switcherItem, { justifyContent: "flex-start", gap: space(2) }, pressed && { backgroundColor: c.surfaceHover }]}
            >
              <Icon color={c.inkSecondary}>{icons.plus}</Icon>
              <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.inkSecondary }}>All workspaces</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}
    </TourTarget>
  );
}

/* --------------------------------------------------------------- shell -- */

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const c = useColors();
  const s = useThemedStyles(styles);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reducedMotion = usePrefersReducedMotion();
  const pathname = usePathname() ?? "";
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Workspace[]>("/workspaces")
      .then((ws) => {
        if (!cancelled) setWorkspaces(ws);
      })
      .catch(() => {
        // The shell must render even if this fails; the screen below will
        // surface the real error from its own fetch.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // /workspace/<id> carries the workspace in the path; /chat/<id> doesn't, so
  // it's resolved from the conversation. Without this the drawer reads
  // "Select a workspace" while you are inside one of its conversations, and the
  // Attachments/Search rows point at the workspace *list* - which makes it easy
  // to upload a document into one workspace and then ask questions in another,
  // and conclude that grounding is broken.
  const workspaceMatch = pathname.match(/^\/workspace\/([^/]+)/);
  const conversationId = pathname.match(/^\/chat\/([^/]+)/)?.[1] ?? null;
  // Keyed by conversation so a stale result is ignored by derivation rather
  // than cleared with a setState in the effect body (which cascades renders).
  const [resolved, setResolved] = useState<{
    id: string;
    workspaceId: string;
    title: string | null;
    temporary: boolean;
  } | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    apiFetch<{ workspace_id: string; title: string | null; temporary?: boolean }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}`,
    )
      .then((conv) => {
        if (!cancelled) {
          if (conv.temporary) holdTemporaryChat(conversationId);
          setResolved({
            id: conversationId,
            workspaceId: conv.workspace_id,
            title: conv.title,
            temporary: Boolean(conv.temporary),
          });
        }
      })
      .catch(() => {
        // The drawer just falls back to no active workspace; the screen
        // below surfaces the real error.
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Leaving a temporary chat - for a new chat, another chat, any other screen -
  // deletes it, which is the promise its intro makes. See lib/temporaryChat.
  useEffect(() => {
    leaveTemporaryChatUnless(conversationId);
  }, [conversationId]);

  const chatWorkspaceId =
    conversationId && resolved?.id === conversationId ? resolved.workspaceId : null;
  const activeWorkspaceId = workspaceMatch ? workspaceMatch[1] : chatWorkspaceId;
  // The entry route (/start) opens a chat in the workspace you were in last.
  useEffect(() => {
    if (activeWorkspaceId) rememberWorkspace(activeWorkspaceId);
  }, [activeWorkspaceId]);
  const inTemporaryChat = Boolean(
    conversationId && resolved?.id === conversationId && resolved.temporary,
  );
  const conversationTitle =
    conversationId && resolved?.id === conversationId
      ? resolved.temporary
        ? "Temporary chat"
        : resolved.title
      : null;
  // Which tour, if any, walks the screen in view - drives the replay button.
  const tourHere: TourId | null = conversationId
    ? "chat"
    : /^\/workspace\/[^/]+$/.test(pathname)
      ? "workspace"
      : null;
  const [starting, setStarting] = useState(false);
  // Bumped after a conversation is created or deleted here, so the recents
  // list refetches without the drawer owning the list itself.
  const [recentsKey, setRecentsKey] = useState(0);

  /* The drawer. It slides in from the left over the screen, follows a
     finger dragged left and closes past 40% of its width or on a quick
     flick; anything shorter springs back. Close only - no edge-swipe to
     open, because a swipe in from the left edge is iOS's own Back gesture
     and the two would fight. Android's Back closes it rather than leaving
     the screen under it.

     Not a Modal: the tour's callout is a layer above the navigator and has
     to stay above the drawer when a step points into it. */
  const drawerWidth = Math.min(SIDEBAR_WIDTH, window.width * 0.85);
  const offset = useSharedValue(-drawerWidth); // 0 = fully open
  const duration = reducedMotion ? 0 : 200;

  function openDrawer() {
    offset.value = -drawerWidth;
    setMobileOpen(true);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    offset.value = withTiming(0, { duration, easing: Easing.out(Easing.ease) });
  }, [mobileOpen, offset, duration]);

  // Closed by navigating somewhere from inside it: gone at once, with the
  // screen it navigated to.
  const close = useCallback(() => setMobileOpen(false), []);

  // Closed in place (X, backdrop, Back, a swipe): slide out, then unmount.
  const dismiss = useCallback(() => {
    offset.value = withTiming(-drawerWidth, { duration: reducedMotion ? 0 : 180 }, (finished) => {
      "worklet";
      if (finished) scheduleOnRN(setMobileOpen, false);
    });
  }, [offset, drawerWidth, reducedMotion]);

  useEffect(() => {
    if (!mobileOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [mobileOpen, dismiss]);

  // The coachmark tour points at things in this drawer, which is closed;
  // the overlay can't find its target and asks here, rather than knowing how
  // the shell is laid out. Closing is the reverse: a step whose target is on
  // the screen itself must not be shown behind the drawer.
  useEffect(() => {
    const a = DeviceEventEmitter.addListener("clardentity:open-nav", () => openDrawer());
    const b = DeviceEventEmitter.addListener("clardentity:close-nav", () => setMobileOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
    // openDrawer only touches the shared value and state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerWidth]);

  // A chat names itself after its first answer (see ChatView's final
  // handler): refresh the recents list and, if it's the one in view, the
  // title in the top bar - without a round trip for the latter.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "clardentity:conversation-renamed",
      ({ id, title }: { id: string; title: string }) => {
        setRecentsKey((k) => k + 1);
        setResolved((prev) => (prev && prev.id === id ? { ...prev, title } : prev));
      },
    );
    return () => sub.remove();
  }, []);

  const pan = usePanGesture({
    // Sideways only: up and down stays a scroll of the drawer's lists.
    activeOffsetX: [-12, 12],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      "worklet";
      offset.value = Math.min(0, e.translationX);
    },
    onDeactivate: (e) => {
      "worklet";
      const travelled = Math.min(0, e.translationX);
      if (!e.canceled && (-travelled > drawerWidth * 0.4 || e.velocityX < -600)) {
        // finish the slide, then close
        offset.value = withTiming(-drawerWidth, { duration: 180 }, (finished) => {
          "worklet";
          if (finished) scheduleOnRN(setMobileOpen, false);
        });
      } else {
        offset.value = withTiming(0, { duration: 200 });
      }
    },
  });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [-drawerWidth, 0], [0, 1]),
  }));

  async function startConversation() {
    if (starting) return;
    // No workspace in view (the profile screen, the workspace list, /start
    // itself): the entry route picks one - the last used, else the first,
    // else a new one - and opens a chat there. The button is never dead.
    if (!activeWorkspaceId) {
      router.push("/start");
      return;
    }
    setStarting(true);
    try {
      const conv = await apiFetch<{ id: string }>("/chat/conversations", {
        method: "POST",
        body: { workspace_id: activeWorkspaceId, default_mode: null },
      });
      setRecentsKey((k) => k + 1);
      markFreshChat(conv.id);
      router.push(`/chat/${conv.id}`);
    } catch {
      // The room screen has the same button with visible error handling; a
      // failure here should not put an error banner in the chrome.
    } finally {
      setStarting(false);
    }
  }

  /** The top bar's temporary-chat switch. From an ordinary chat it opens a
   *  temporary one; from a temporary chat it goes back to an ordinary new
   *  chat - and leaving deletes the temporary one (the effect above). */
  async function toggleTemporaryChat() {
    if (starting) return;
    if (inTemporaryChat) {
      void startConversation();
      return;
    }
    if (!activeWorkspaceId) return;
    setStarting(true);
    try {
      const conv = await apiFetch<{ id: string }>("/chat/conversations", {
        method: "POST",
        body: { workspace_id: activeWorkspaceId, default_mode: null, temporary: true },
      });
      holdTemporaryChat(conv.id);
      markFreshChat(conv.id);
      router.push(`/chat/${conv.id}`);
    } catch {
      // As with New chat: the chrome carries no error banner.
    } finally {
      setStarting(false);
    }
  }

  /* Destinations first, then history, then the account - the shape every
     chat app has converged on, and for a reason: the thing you do most
     (start talking) is one tap at the top, and the thing you do second most
     (pick up where you left off) is a list you scan rather than a screen you
     navigate to. */
  const nav = (
    <View style={{ flex: 1, minHeight: 0, padding: space(3) }}>
      <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} onNavigate={close} />

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          close();
          void startConversation();
        }}
        disabled={starting}
        style={({ pressed }) => [
          s.navRow,
          { marginTop: space(3), opacity: starting ? 0.5 : 1 },
          pressed && { backgroundColor: c.surfaceHover },
        ]}
      >
        <MaskIcon src="/ui/nav-newchat.svg" size={24} color={c.nav} />
        <Text style={[s.navText, { color: c.nav }]}>{starting ? "Starting…" : "New chat"}</Text>
      </Pressable>

      <View style={{ marginTop: space(0.5), gap: space(0.5) }}>
        {/* Three rows, as drawn. Workspaces is reached from the picker above
            rather than a row of its own, and Search replaces the old "Chats"
            - same destination, the name the design gives it. */}
        <NavItem
          href={activeWorkspaceId ? `/workspace/${activeWorkspaceId}/documents` : "/workspace"}
          iconSrc="/ui/nav-attachments.svg"
          active={pathname.endsWith("/documents")}
          onNavigate={close}
          tourId="nav-attachments"
        >
          Attachments
        </NavItem>
        <NavItem
          href={activeWorkspaceId ? `/workspace/${activeWorkspaceId}/search` : "/workspace"}
          iconSrc="/ui/nav-search.svg"
          active={pathname.endsWith("/search")}
          onNavigate={close}
          tourId="nav-chats"
        >
          Search
        </NavItem>
        {/* Only an administrator has anywhere to go here, and only the
            server knows who that is. Absent for everyone else rather than
            present and refusing, which would be an advertisement. */}
        {user?.is_admin && (
          <NavItem href="/admin" icon={icons.admin} active={pathname.startsWith("/admin")} onNavigate={close}>
            Admin
          </NavItem>
        )}
      </View>

      <ErrorBoundary where="recents" label="Recent chats couldn't be shown.">
        <RecentConversations
          workspaceId={activeWorkspaceId}
          workspaces={workspaces}
          activeId={conversationId}
          refreshKey={recentsKey}
          onNavigate={close}
        />
      </ErrorBoundary>
    </View>
  );

  const account = (
    <View style={[s.account, { paddingBottom: space(3) + insets.bottom }]}>
      {/* The card is the way into everything the account can do. It used to
          be a link to the profile with a log-out icon bolted to its right -
          a door-with-an-arrow that only means "exit" to someone who already
          knows it does. The verbs are words in a menu now. */}
      <AccountMenu key={pathname} onNavigate={close} />
    </View>
  );

  const showTemporary = Boolean(user && activeWorkspaceId);
  // Under 360pt the top bar has room for menu, title, new and temporary
  // chat; light/dark is still in Settings (Appearance), and the tour replay
  // steps out too, so the screen's title has room to be read.
  const narrow = window.width < 360;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <View style={[s.topbar, { paddingTop: insets.top, height: TOPBAR_HEIGHT + insets.top }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation"
          accessibilityState={{ expanded: mobileOpen }}
          onPress={openDrawer}
          hitSlop={8}
          style={({ pressed }) => [s.iconButton, pressed && { backgroundColor: c.surfaceHover }]}
        >
          <Icon color={c.inkSecondary}>{icons.menu}</Icon>
        </Pressable>
        <Breadcrumbs
          pathname={pathname}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          conversationTitle={conversationTitle}
        />
        {/* One tap to a new chat, where the drawer's button is behind the
            drawer. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New chat"
          onPress={() => void startConversation()}
          disabled={starting}
          hitSlop={8}
          style={({ pressed }) => [
            s.iconButton,
            { marginLeft: "auto", opacity: starting ? 0.5 : 1 },
            pressed && { backgroundColor: c.surfaceHover },
          ]}
        >
          <Icon color={c.brand}>
            <Path d={BUBBLE} strokeWidth={1.9} />
            <Path d="M12.5 8.5v6M9.5 11.5h6" strokeWidth={1.9} />
          </Icon>
        </Pressable>
        {/* Signed in and inside a workspace only - the visitor demo has no
            history to keep a chat out of. Pressed while a temporary chat
            is open, and pressing it again goes back to an ordinary one. */}
        {showTemporary && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: inTemporaryChat }}
            accessibilityLabel={inTemporaryChat ? "Leave temporary chat" : "Start a temporary chat"}
            accessibilityHint={
              inTemporaryChat ? "Leave temporary chat - it will be deleted" : "Temporary chat - not saved to your history"
            }
            onPress={() => void toggleTemporaryChat()}
            disabled={starting}
            hitSlop={8}
            style={({ pressed }) => [
              s.iconButton,
              { opacity: starting ? 0.5 : 1 },
              inTemporaryChat ? { backgroundColor: c.brandSoft } : pressed && { backgroundColor: c.surfaceHover },
            ]}
          >
            {/* The new-chat bubble, drawn dashed: a chat that is not kept. */}
            <Icon color={inTemporaryChat ? c.brand : c.inkMuted} dashed>
              <Path d={BUBBLE} />
            </Icon>
          </Pressable>
        )}
        {!narrow && <ThemeToggle tourId="theme-toggle" />}
        {tourHere && !narrow && (
          // The coachmarks, again, on request - for anyone who skipped them
          // or wants a second look. Only where a tour exists for the screen
          // in view; `force` because the whole point is replaying one this
          // device has already finished.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show me around this page"
            onPress={() => startTour(tourHere, { force: true })}
            hitSlop={8}
            style={({ pressed }) => [s.iconButton, pressed && { backgroundColor: c.surfaceHover }]}
          >
            {({ pressed }) => <Icon color={pressed ? c.ink : c.inkMuted}>{icons.help}</Icon>}
          </Pressable>
        )}
      </View>

      <View style={{ flex: 1, minHeight: 0 }}>
        {/* keyed by route: a screen that failed gets a fresh start on the next one */}
        <ErrorBoundary key={pathname} where="page" variant="page" label="This page didn't load.">
          {children}
        </ErrorBoundary>
      </View>

      {/* Greeting on arrival, and the demo conversation if one followed the
          user in. Here rather than on any one screen: both are about opening
          the app, not about where you landed. */}
      <AppNotices />
      <OfflineNotice />

      {mobileOpen && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }, scrimStyle]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityLabel="Close navigation"
              importantForAccessibility="no"
              accessibilityElementsHidden
              onPress={dismiss}
            />
          </Animated.View>
          <GestureDetector gesture={pan}>
            <Animated.View
              testID="nav-drawer"
              accessibilityViewIsModal
              accessibilityLabel="Navigation"
              style={[s.drawer, { width: drawerWidth }, panelStyle]}
            >
              <View style={[s.drawerHead, { paddingTop: insets.top, height: TOPBAR_HEIGHT + insets.top }]}>
                {/* Home, as the desktop sidebar's wordmark is. close(), not
                    dismiss(): this navigates. */}
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    close();
                    router.push("/");
                  }}
                  hitSlop={8}
                  style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}
                >
                  {/* the five-dot mark, as the desktop sidebar draws it */}
                  <MaskIcon src="/ui/logo-dots.svg" width={px(18.6)} height={px(18)} color={c.brand} />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: fontSize.sm, letterSpacing: -0.2, color: c.ink }}>
                    Clardentity
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close navigation"
                  onPress={dismiss}
                  hitSlop={8}
                  style={({ pressed }) => [s.iconButton, pressed && { backgroundColor: c.surfaceHover }]}
                >
                  <Icon color={c.inkMuted}>{icons.close}</Icon>
                </Pressable>
              </View>
              {nav}
              {account}
            </Animated.View>
          </GestureDetector>
        </View>
      )}
    </View>
  );
}

function Breadcrumbs({
  pathname,
  workspaces,
  activeWorkspaceId,
  conversationTitle,
}: {
  pathname: string;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  conversationTitle: string | null;
}) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return <Crumbs crumbs={[{ label: "Home" }]} />;
  }

  // Any route not listed here falls through to its raw path segment, which
  // is how /profile was rendering as a lowercase "profile" in a bar where
  // every other entry is a proper name.
  const LABELS: Record<string, string> = {
    workspace: "Workspaces",
    chat: "Conversation",
    profile: "Your profile",
    settings: "Settings",
    start: "Opening a chat",
    admin: "Admin",
  };

  const crumbs: Array<{ label: string; href?: string }> = [];
  const root = segments[0];

  // A conversation belongs to a workspace, so the trail shows that lineage
  // rather than a bare "Conversation".
  if (root === "chat") {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    if (ws) crumbs.push({ label: ws.name, href: `/workspace/${ws.id}` });
    else crumbs.push({ label: "Workspaces", href: "/workspace" });
    // The chat screen has no title bar of its own, so this crumb is where
    // the conversation is named. Until the title has been generated from
    // the first exchange it reads the way the drawer does.
    crumbs.push({ label: conversationTitle || "New chat" });
    return <Crumbs crumbs={crumbs} />;
  }

  if (root === "workspace" && segments.length > 1) {
    // Inside a workspace the design starts at the workspace itself, not at
    // the list of them: "My workspace / Attachments", two crumbs.
    const id = segments[1];
    const ws = workspaces.find((w) => w.id === id);
    const name = ws?.name ?? "Workspace";
    const sub = segments[2];
    if (sub) {
      crumbs.push({ label: name, href: `/workspace/${id}` });
      crumbs.push({
        label: sub === "documents" ? "Attachments" : sub === "search" ? "Search" : sub,
      });
    } else {
      crumbs.push({ label: name });
    }
    return <Crumbs crumbs={crumbs} />;
  }

  crumbs.push({ label: LABELS[root] ?? root, href: `/${root}` });

  return <Crumbs crumbs={crumbs} />;
}

/** On a phone only the screen you are on: two crumbs shared the bar down
 *  to "P... / E..." on a 375pt screen. The workspace is still one tap away,
 *  in the drawer. 20px, in the warm grey the design gives the current page. */
function Crumbs({ crumbs }: { crumbs: Array<{ label: string; href?: string }> }) {
  const c = useColors();
  const last = crumbs[crumbs.length - 1];
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={1}
      style={{ flexShrink: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: fontSize.xl, color: c.nav }}
    >
      {last?.label}
    </Text>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    topbar: {
      zIndex: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: space(1),
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
      backgroundColor: c.surface,
      paddingHorizontal: space(4),
    },
    iconButton: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      padding: space(1.5),
    },
    drawer: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      borderRightWidth: 1,
      borderRightColor: c.hairline,
      backgroundColor: c.surfaceMuted,
    },
    drawerHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
      paddingHorizontal: space(4),
    },
    account: { borderTopWidth: 1, borderTopColor: c.hairline, padding: space(3) },
    navRow: {
      height: px(48),
      flexDirection: "row",
      alignItems: "center",
      gap: space(3),
      borderRadius: 9,
      paddingHorizontal: space(4),
    },
    navText: { flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.nav },
    recentsLabel: {
      paddingHorizontal: space(4),
      paddingBottom: space(1),
      fontFamily: fonts.medium,
      fontSize: fontSize.sm,
      textTransform: "uppercase",
      color: c.navMuted,
    },
    recentRow: {
      height: 36,
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: space(5),
      borderRadius: 9,
      paddingLeft: space(4),
      paddingRight: space(1.5),
    },
    recentText: { flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.nav },
    fade: { position: "absolute", left: 0, right: 0, height: space(6) },
    seeAll: { marginTop: space(1), borderRadius: radius.lg, paddingHorizontal: space(2.5), paddingVertical: space(1.5) },
    switcher: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: space(2.5),
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      paddingHorizontal: space(2.5),
      paddingVertical: space(2),
    },
    switcherInitial: {
      width: px(24),
      height: px(24),
      borderRadius: radius.md,
      backgroundColor: c.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    switcherMenu: {
      marginTop: space(1),
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surfaceRaised,
      padding: space(1),
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    switcherItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space(2),
      borderRadius: radius.md,
      paddingHorizontal: space(2.5),
      paddingVertical: space(2),
    },
  });
