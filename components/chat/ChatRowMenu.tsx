import { useCallback, useState, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { ChatSheet } from "@/components/chat/ChatSheet";
import { apiFetch } from "@/lib/apiClient";
import { track } from "@/lib/analytics";
import { fonts, fontSize, px, radius, space, useThemedStyles, type Colors } from "@/lib/theme";

/* The chat row's own menu.
 *
 * Every list of chats - the drawer's recents and the workspace page - used
 * to carry its own loose controls: a bin here, a folder icon there, and no
 * way at all to rename or pin. Four verbs in a row is a toolbar on something
 * that is meant to be a name you tap. They live behind one "..." now, and
 * both lists use this component, so the chat you are looking at offers the
 * same four things wherever you found it.
 *
 * The web's popover is a sheet here. Delete still asks first - a chat takes
 * its messages, claims and citations with it - with the platform's own
 * destructive confirm rather than the web's in-place one.
 */

export type ChatRowWorkspace = { id: string; name: string };

type Action = "menu" | "move" | "rename";

function Kebab({ color, size }: { color: string; size: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <Circle cx="12" cy="5" r="1.75" />
      <Circle cx="12" cy="12" r="1.75" />
      <Circle cx="12" cy="19" r="1.75" />
    </Svg>
  );
}

function PinIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 14v6" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StrokeIcon({ d, color, size }: { d: string[]; color: string; size: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      {d.map((path) => (
        <Path key={path} d={path} stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

export function ChatRowMenu({
  conversationId,
  title,
  pinned,
  workspaceId,
  workspaces,
  onChanged,
  onDeleted,
  align = "right",
  style,
}: {
  conversationId: string;
  title: string | null;
  pinned: boolean;
  /** The workspace it is in now, so it isn't offered as a destination. */
  workspaceId: string | null;
  /** Every workspace the user belongs to. "Move to" hides when there is
   *  nowhere else to go. */
  workspaces: ChatRowWorkspace[];
  /** Called after a rename, pin or move lands, so the list can re-read. */
  onChanged?: () => void;
  /** Called after a delete lands - separately, because a list usually wants
   *  to drop the row rather than refetch, and the page you are on may be the
   *  chat that just went. */
  onDeleted?: () => void;
  /** Which side the web's popover opened on. A sheet has no side; kept so
   *  call sites port unchanged. */
  align?: "left" | "right";
  style?: StyleProp<ViewStyle>;
}) {
  void align;
  const s = useThemedStyles(styles);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Action>("menu");
  const [draft, setDraft] = useState(title ?? "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = title || "Untitled chat";
  const destinations = workspaces.filter((w) => w.id !== workspaceId);

  /* Opening and closing resets here rather than in an effect: reopening
     should offer the menu again, not whichever panel was showing when it
     closed, and the rename field should hold the name as it is now. Doing it
     at the event is one render; doing it in an effect is a second one. */
  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      setView("menu");
      setError(null);
      if (next) setDraft(title ?? "");
    },
    [title],
  );

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}`, { method: "PATCH", body });
      if ("title" in body) track("chat_renamed");
      if ("pinned" in body) track("chat_pinned", { pinned: Boolean(body.pinned) });
      if ("workspace_id" in body) track("chat_moved");
      setOpenState(false);
      onChanged?.();
    } catch {
      setError("That didn't save - try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/chat/conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" });
      track("chat_deleted");
      setOpenState(false);
      onDeleted?.();
    } catch {
      setError("That didn't delete - try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete chat?", `Delete "${label}" and everything in it?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove() },
    ]);
  }

  const icon = px(16);

  return (
    <View style={[{ flexShrink: 0 }, style]}>
      <Pressable
        onPress={() => setOpenState(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Options for "${label}"`}
        // Always visible, never hover-revealed: a hover-only control does not
        // exist on a touch screen. 36pt square, matching the recents row it
        // sits in, with the rest of a 44pt target in the slop.
        hitSlop={4}
        style={({ pressed }) => [s.kebab, pressed && { backgroundColor: s.colors.surfaceHover }]}
      >
        <Kebab color={s.colors.inkMuted} size={icon} />
      </Pressable>

      <ChatSheet open={open} onClose={() => setOpenState(false)} title={view === "menu" ? label : undefined}>
        {view === "menu" && (
          <>
            {destinations.length > 0 && (
              <MenuItem
                onPress={() => setView("move")}
                icon={
                  <StrokeIcon
                    color={s.colors.inkMuted}
                    size={icon}
                    d={["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v3", "M3 7v10a2 2 0 0 0 2 2h7", "M16 16h6m-3-3 3 3-3 3"]}
                  />
                }
                label="Move to workspace"
              />
            )}
            <MenuItem
              disabled={busy}
              onPress={() => void patch({ pinned: !pinned })}
              icon={<PinIcon color={pinned ? s.colors.brand : s.colors.inkMuted} size={icon} />}
              label={pinned ? "Unpin" : "Pin to top"}
            />
            <MenuItem
              onPress={() => setView("rename")}
              icon={<StrokeIcon color={s.colors.inkMuted} size={icon} d={["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"]} />}
              label="Rename"
            />
            <MenuItem
              danger
              disabled={busy}
              onPress={confirmDelete}
              icon={
                <StrokeIcon
                  color={s.colors.bandLow}
                  size={icon}
                  d={["M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"]}
                />
              }
              label={busy ? "Deleting…" : "Delete"}
            />
          </>
        )}

        {view === "move" && (
          <>
            <Text style={s.heading}>MOVE TO</Text>
            {destinations.map((w) => (
              <MenuItem key={w.id} disabled={busy} onPress={() => void patch({ workspace_id: w.id })} label={w.name} />
            ))}
          </>
        )}

        {view === "rename" && (
          <View style={{ padding: space(1) }}>
            <Text style={[s.heading, { paddingHorizontal: space(1) }]}>CHAT NAME</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              maxLength={120}
              autoFocus
              placeholder="Untitled chat"
              placeholderTextColor={s.colors.inkMuted}
              returnKeyType="done"
              onSubmitEditing={() => void patch({ title: draft })}
              style={s.input}
            />
            <View style={s.actions}>
              <Pressable
                onPress={() => setView("menu")}
                accessibilityRole="button"
                style={({ pressed }) => [s.small, pressed && { backgroundColor: s.colors.surfaceHover }]}
              >
                <Text style={[s.smallText, { color: s.colors.inkMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void patch({ title: draft })}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [
                  s.small,
                  { backgroundColor: pressed ? s.colors.brandDark : s.colors.brand },
                  busy && { opacity: 0.6 },
                ]}
              >
                <Text style={[s.smallText, { fontFamily: fonts.medium, color: "#ffffff" }]}>{busy ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {error && <Text style={s.error}>{error}</Text>}
      </ChatSheet>
    </View>
  );
}

function MenuItem({
  label,
  icon,
  onPress,
  disabled,
  danger = false,
}: {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const s = useThemedStyles(styles);
  return (
    <Pressable
      accessibilityRole="menuitem"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.item,
        pressed && { backgroundColor: danger ? s.colors.bandLowBg : s.colors.surfaceHover },
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon}
      <Text style={[s.itemText, danger && { color: s.colors.bandLow }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = (c: Colors) => ({
  colors: c,
  ...StyleSheet.create({
    kebab: { width: px(36), height: px(36), alignItems: "center", justifyContent: "center", borderRadius: radius.md },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(2),
      borderRadius: radius.md,
      paddingHorizontal: space(2),
      paddingVertical: space(3),
    },
    itemText: { flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.ink },
    heading: {
      paddingHorizontal: space(2),
      paddingVertical: space(1),
      fontFamily: fonts.semibold,
      fontSize: fontSize.xs,
      letterSpacing: 0.6,
      color: c.inkMuted,
    },
    input: {
      marginTop: space(1),
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      paddingHorizontal: space(2),
      paddingVertical: space(2),
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: c.ink,
    },
    actions: { marginTop: space(2), flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: space(1.5) },
    small: { borderRadius: radius.md, paddingHorizontal: space(3), paddingVertical: space(1.5) },
    smallText: { fontFamily: fonts.regular, fontSize: fontSize.xs },
    error: { paddingHorizontal: space(2), paddingVertical: space(1), fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.bandLow },
  }),
});
