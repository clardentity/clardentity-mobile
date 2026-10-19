import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage } from "@/lib/auth";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Spinner } from "@/components/ui/primitives";
import { ErrorNotice } from "@/components/auth/AuthScreen";
import { useRise } from "@/components/workspace/rise";
import { fonts, fontSize, px, radius, space, useColors } from "@/lib/theme";

type Workspace = {
  id: string;
  name: string;
  role: string;
  created_at: string;
};

/** "02 Oct 2026" - the design's own form, and the one that can't be read as
 *  the wrong date in either hemisphere. */
function created(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** The folder tile the design puts at the head of every row. */
function FolderTile() {
  const c = useColors();
  return (
    <View
      style={{
        height: px(56),
        width: px(56),
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.base,
        backgroundColor: c.inkMuted,
      }}
    >
      <MaskIcon src="/ui/nav-folder.svg" size={px(40)} color="#ffffff" />
    </View>
  );
}

export function WorkspaceList() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const rise = useRise();
  // Set only by the sign-in and registration redirects. Arriving here from
  // anywhere else - the sidebar, a breadcrumb - means the list was asked for
  // deliberately, and skipping past it would make a second workspace
  // impossible to create once you have one.
  const { enter } = useLocalSearchParams<{ enter?: string }>();
  const autoEnter = enter === "1";

  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  // The design has a Create button and no form. The form it opens is a card
  // at the head of the list, in the place the new workspace will take -
  // rather than a dialog over the top of a list it is about to join.
  const [composing, setComposing] = useState(false);

  function fetchWorkspaces(): Promise<Workspace[]> {
    return apiFetch<Workspace[]>("/workspaces");
  }

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaces()
      .then((data) => {
        if (cancelled) return;
        // Signing in should land you where you can ask something, not on a
        // list with one item on it. `replace` so Back returns to the screen
        // before rather than bouncing through here again.
        if (autoEnter && data.length === 1) {
          router.replace(`/workspace/${data[0].id}`);
          return;
        }
        setWorkspaces(data);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [autoEnter]);

  function cancelCompose() {
    setName("");
    setComposing(false);
  }

  async function handleCreate() {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      await apiFetch<Workspace>("/workspaces", {
        method: "POST",
        body: { name: name.trim() },
      });
      setName("");
      setComposing(false);
      setWorkspaces(await fetchWorkspaces());
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  const card = {
    height: px(113),
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: space(6),
    borderRadius: px(12),
    borderWidth: 1,
    padding: px(9),
  };

  const header = (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: space(4) }}>
        <View style={{ flex: 1, minWidth: px(200) }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.medium, fontSize: fontSize["4xl"], color: c.ink }}>
            Workspaces
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xl, color: c.inkSecondary }}>
            Keep everything for each workspace in one place.
          </Text>
        </View>
        <Pressable
          onPress={() => setComposing(true)}
          accessibilityRole="button"
          accessibilityLabel="Create a workspace"
          style={({ pressed }) => ({
            height: px(42),
            flexShrink: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: space(1),
            borderRadius: px(34),
            backgroundColor: pressed ? c.brandDark : c.brand,
            paddingHorizontal: space(3),
          })}
        >
          <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xl, color: "#ffffff" }}>Create</Text>
          <Svg viewBox="0 0 20 20" width={px(20)} height={px(20)} fill="none" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round">
            <Path d="M10 4.2v11.6M4.2 10h11.6" />
          </Svg>
        </Pressable>
      </View>

      {error && <ErrorNotice style={{ marginTop: space(6) }}>{error}</ErrorNotice>}

      {composing && workspaces !== null && (
        <View style={[card, { marginTop: space(12), borderColor: c.brandBorder }]}>
          <FolderTile />
          <View style={{ flex: 1, minWidth: 0, paddingTop: px(2) }}>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Name this workspace"
              placeholderTextColor={c.inkMuted}
              accessibilityLabel="New workspace name"
              returnKeyType="done"
              onSubmitEditing={() => void handleCreate()}
              style={{ fontFamily: fonts.regular, fontSize: fontSize["2xl"], color: c.ink, padding: 0 }}
            />
            <View style={{ marginTop: space(2), flexDirection: "row", alignItems: "center", gap: space(3) }}>
              <Pressable
                onPress={() => void handleCreate()}
                disabled={creating || !name.trim()}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => ({
                  borderRadius: 9999,
                  backgroundColor: pressed ? c.brandDark : c.brand,
                  paddingHorizontal: space(3),
                  paddingVertical: space(1),
                  opacity: creating || !name.trim() ? 0.5 : 1,
                })}
              >
                <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: "#ffffff" }}>
                  {creating ? "Creating…" : "Create"}
                </Text>
              </Pressable>
              <Pressable onPress={cancelCompose} accessibilityRole="button" hitSlop={8}>
                {({ pressed }) => (
                  <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: pressed ? c.ink : c.inkSecondary }}>
                    Cancel
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  if (workspaces === null) {
    return (
      <View style={{ flex: 1, paddingHorizontal: space(5), paddingTop: px(69) }}>
        {header}
        <View style={{ alignItems: "center", paddingVertical: space(16) }}>
          <Spinner />
        </View>
      </View>
    );
  }

  return (
    // The design's gutters at phone width: one column of cards.
    <FlatList
      style={{ flex: 1 }}
      data={workspaces}
      keyExtractor={(ws) => ws.id}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ paddingHorizontal: space(5), paddingTop: px(69), paddingBottom: insets.bottom + space(16) }}
      ListHeaderComponent={header}
      ListHeaderComponentStyle={{ marginBottom: composing ? space(4) : space(12) }}
      ItemSeparatorComponent={() => <View style={{ height: space(4) }} />}
      ListEmptyComponent={
        composing ? undefined : (
          <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xl, color: c.inkSecondary }}>
            No workspaces yet. Create one and everything you attach and ask collects inside it.
          </Text>
        )
      }
      renderItem={({ item: ws, index }) => (
        <Animated.View entering={rise(index)}>
          <Pressable
            onPress={() => router.push(`/workspace/${ws.id}`)}
            accessibilityRole="link"
            style={({ pressed }) => [
              card,
              {
                borderColor: pressed ? c.brandBorder : c.hairlineStrong,
                backgroundColor: pressed ? c.surfaceHover : "transparent",
              },
            ]}
          >
            <FolderTile />
            <View style={{ flex: 1, minWidth: 0, paddingTop: px(2) }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: fontSize["2xl"], color: c.ink }}>
                {ws.name}
              </Text>
              <Text style={{ marginTop: px(2), fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkSecondary }}>
                Created {created(ws.created_at)}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      )}
    />
  );
}
