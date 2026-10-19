import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { apiFetch } from "@/lib/apiClient";
import { ChatRowMenu } from "@/components/chat/ChatRowMenu";
import { authErrorMessage } from "@/lib/auth";
import { modeLabel, type CognitiveMode } from "@/lib/modes";
import { AppText, Button, Spinner } from "@/components/ui/primitives";
import { ErrorNotice } from "@/components/auth/AuthScreen";
import { markFreshChat } from "@/lib/freshChats";
import { fonts, fontSize, px, space, useColors } from "@/lib/theme";
import { tourRef } from "@/components/tour/TourOverlay";

type Workspace = {
  id: string;
  name: string;
  role: string;
  created_at: string;
  last_activity_at?: string | null;
};

/** "02 Oct" - the design's form, and all a row needs: it sits beside the
 *  mode at 12px, where a full timestamp was ~150px of a row that also has to
 *  carry a title. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

type Conversation = {
  id: string;
  title: string | null;
  default_mode: string | null;
  created_at: string;
  last_activity_at?: string | null;
  pinned?: boolean;
};

export function WorkspaceDetail({ workspaceId }: { workspaceId: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  // Every workspace the user belongs to - the destinations a chat can be
  // moved to. Fetched with the rest; an empty list just hides the control.
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  // Bumped after a rename, pin or move so the list is re-read: a pin changes
  // the order, a move takes the row out of this workspace entirely.
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which mode is being started, so only the control you pressed shows a
  // pending label. `"any"` covers the plain "Create" button.
  const [creating, setCreating] = useState<CognitiveMode | "any" | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiFetch<Workspace>(`/workspaces/${workspaceId}`),
      apiFetch<Conversation[]>(`/chat/conversations?workspace_id=${workspaceId}`),
      apiFetch<Workspace[]>("/workspaces").catch(() => [] as Workspace[]),
    ])
      .then(([ws, convs, all]) => {
        if (cancelled) return;
        setWorkspace(ws);
        setConversations(convs);
        setAllWorkspaces(all);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, reloadKey]);

  async function handleNewConversation(mode?: CognitiveMode) {
    if (creating) return;
    setCreating(mode ?? "any");
    setError(null);
    try {
      const conv = await apiFetch<Conversation>("/chat/conversations", {
        method: "POST",
        body: { workspace_id: workspaceId, default_mode: mode ?? null },
      });
      markFreshChat(conv.id);
      router.push(`/chat/${conv.id}`);
      // This screen stays in the stack under the chat; clear the pending
      // label so it is right when they come Back.
      setCreating(null);
    } catch (err) {
      setError(authErrorMessage(err));
      setCreating(null);
    }
  }

  if (error && (!workspace || conversations === null)) {
    return (
      <View style={{ paddingHorizontal: space(4), paddingVertical: space(8) }}>
        <ErrorNotice>{error}</ErrorNotice>
      </View>
    );
  }

  /** The row menu has already deleted it; drop it from the list. */
  function forgetConversation(id: string) {
    setConversations((prev) => (prev ?? []).filter((conv) => conv.id !== id));
  }

  async function handleDeleteWorkspace() {
    setDeletingWorkspace(true);
    setError(null);
    try {
      await apiFetch(`/workspaces/${workspaceId}`, { method: "DELETE" });
      // The list page re-provisions a workspace on sign-in if this was the
      // last one, so there is always somewhere to land.
      router.replace("/workspace");
    } catch (err) {
      setError(authErrorMessage(err));
      setDeletingWorkspace(false);
    }
  }

  /** The web's second click ("Sure? Delete workspace") is the system alert:
   *  a touch screen has no blur to cancel the armed button on. */
  function confirmDeleteWorkspace() {
    Alert.alert(
      "Delete this workspace?",
      "Removes every chat and attachment in it. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete workspace", style: "destructive", onPress: () => void handleDeleteWorkspace() },
      ],
    );
  }

  if (!workspace || conversations === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space(24) }}>
        <Spinner />
      </View>
    );
  }

  const header = (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: space(4) }}>
        <View style={{ flex: 1, minWidth: px(200) }}>
          <Text numberOfLines={1} accessibilityRole="header" style={{ fontFamily: fonts.medium, fontSize: fontSize["4xl"], color: c.ink }}>
            {workspace.name}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xl, color: c.inkSecondary }}>
            Attachments added here ground every answer in this workspace.
          </Text>
        </View>
        {/* "Create" on this page means a chat in this workspace - the one
            thing you came here to do. */}
        <Pressable
          ref={tourRef("new-chat")} collapsable={false}
          onPress={() => void handleNewConversation()}
          disabled={creating !== null}
          accessibilityRole="button"
          accessibilityLabel="Create a chat"
          style={({ pressed }) => ({
            height: px(42),
            flexShrink: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: space(1),
            borderRadius: px(34),
            backgroundColor: pressed ? c.brandDark : c.brand,
            paddingHorizontal: space(3),
            opacity: creating !== null ? 0.6 : 1,
          })}
        >
          <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xl, color: "#ffffff" }}>
            {creating === "any" ? "Creating…" : "Create"}
          </Text>
          <PlusIcon />
        </Pressable>
      </View>
      {error && <ErrorNotice style={{ marginTop: space(6) }}>{error}</ErrorNotice>}
    </View>
  );

  const footer =
    workspace.role === "owner" ? (
      // Owners only - a member leaving isn't the same operation and isn't
      // offered here. Everything in the workspace goes with it: chats,
      // attachments, memory.
      <View
        style={{
          marginTop: space(10),
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space(3),
          borderRadius: px(12),
          borderWidth: 1,
          borderColor: c.hairline,
          paddingHorizontal: space(5),
          paddingVertical: space(3),
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <AppText weight="medium">Delete this workspace</AppText>
          <AppText size="xs" tone="muted">
            Removes every chat and attachment in it. This can&apos;t be undone.
          </AppText>
        </View>
        <Button variant="danger" onPress={confirmDeleteWorkspace} disabled={deletingWorkspace}>
          {deletingWorkspace ? "Deleting…" : "Delete workspace"}
        </Button>
      </View>
    ) : undefined;

  return (
    // The mode cards used to open this page - six tiles asking you to pick
    // a cognitive stance before you had a question. The mode belongs to the
    // message, not to the workspace, and is chosen in the composer where you
    // can see what you're asking; attachments and search moved to the
    // sidebar, where navigation lives. What's left is the one thing you came
    // here to do and the list of what you did before.
    <FlatList
      style={{ flex: 1 }}
      data={conversations}
      keyExtractor={(conv) => conv.id}
      contentContainerStyle={{ paddingHorizontal: space(5), paddingTop: px(69), paddingBottom: insets.bottom + space(16) }}
      ListHeaderComponent={header}
      ListHeaderComponentStyle={{ marginBottom: conversations.length === 0 ? space(10) : space(8) }}
      ListFooterComponent={footer}
      ItemSeparatorComponent={() => <View style={{ height: space(3) }} />}
      ListEmptyComponent={
        <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xl, color: c.inkSecondary }}>
          No chats in this workspace yet. Create one and it collects here.
        </Text>
      }
      renderItem={({ item: conv, index }) => (
        // The row opens the chat and the menu is its own button beside it,
        // so a press on the menu never also opens the chat.
        <View
          ref={tourRef(index === 0 ? "chat-list" : null)}
          collapsable={false}
          style={{
            height: px(48),
            flexDirection: "row",
            alignItems: "center",
            borderRadius: px(8),
            borderWidth: 1,
            borderColor: c.hairline,
            paddingRight: space(2),
          }}
        >
          <Pressable
            onPress={() => router.push(`/chat/${conv.id}`)}
            accessibilityRole="link"
            style={({ pressed }) => ({
              height: "100%",
              flex: 1,
              minWidth: 0,
              flexDirection: "row",
              alignItems: "center",
              gap: space(2),
              paddingHorizontal: space(5),
              borderRadius: px(8),
              backgroundColor: pressed ? c.surfaceHover : "transparent",
            })}
          >
            {conv.pinned && (
              <View accessibilityLabel="Pinned">
                <Svg viewBox="0 0 24 24" width={px(14)} height={px(14)} fill="none" stroke={c.brand} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
                  <Path d="M12 14v6" />
                </Svg>
              </View>
            )}
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSize.xl, color: c.inkSecondary }}>
              {conv.title || "Untitled chat"}
            </Text>
            {/* Pushed to the right end of the row: when it was last
                touched, and which companion answered in it. */}
            <View style={{ marginLeft: "auto", flexDirection: "row", flexShrink: 0, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkSecondary }}>
                {shortDate(conv.last_activity_at ?? conv.created_at)}
              </Text>
              {conv.default_mode && (
                <>
                  <View style={{ height: px(12), width: px(12), alignItems: "center", justifyContent: "center" }}>
                    <View style={{ height: px(4), width: px(4), borderRadius: 9999, backgroundColor: c.inkMuted }} />
                  </View>
                  <Text numberOfLines={1} style={{ maxWidth: px(144), fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.ink }}>
                    {modeLabel(conv.default_mode)}
                  </Text>
                </>
              )}
            </View>
          </Pressable>
          <ChatRowMenu
            conversationId={conv.id}
            title={conv.title}
            pinned={Boolean(conv.pinned)}
            workspaceId={workspaceId}
            workspaces={allWorkspaces}
            onChanged={() => setReloadKey((n) => n + 1)}
            onDeleted={() => forgetConversation(conv.id)}
          />
        </View>
      )}
    />
  );
}

function PlusIcon() {
  return (
    <Svg viewBox="0 0 20 20" width={px(20)} height={px(20)} fill="none" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round">
      <Path d="M10 4.2v11.6M4.2 10h11.6" />
    </Svg>
  );
}
