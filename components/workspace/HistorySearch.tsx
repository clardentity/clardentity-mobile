import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage } from "@/lib/auth";
import { modeLabel } from "@/lib/modes";
import { AppText, Spinner } from "@/components/ui/primitives";
import { ErrorNotice } from "@/components/auth/AuthScreen";
import { useRise } from "@/components/workspace/rise";
import { fonts, fontSize, px, space, useColors } from "@/lib/theme";

type SearchResult = {
  message_id: string;
  conversation_id: string;
  conversation_title: string | null;
  role: string;
  content: string;
  mode_used: string;
  created_at: string;
  rank: number;
};

/** The small mark on every result, saying this came out of a chat. */
function ChatMark({ color }: { color: string }) {
  return (
    <Svg viewBox="0 0 16 16" width={px(16)} height={px(16)} fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 3.2h12v8H8.8L5.6 13.6V11.2H2z" />
      <Path d="M4.6 6.1h6.8M4.6 8.3h4.4" />
    </Svg>
  );
}

/** The search box and what it finds. Fills its parent: the box stays put at
 *  the top and the results scroll under it. */
export function HistorySearch({ workspaceId }: { workspaceId: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const rise = useRise();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const q = query.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SearchResult[]>(
        `/history/search?workspace_id=${workspaceId}&q=${encodeURIComponent(q)}`,
      );
      setResults(data);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || !query.trim();

  return (
    // The design's column for this page is the search box and whatever it
    // finds and nothing else - no title above it, because the breadcrumb has
    // already said where you are.
    <View style={{ flex: 1, width: "100%", maxWidth: px(930), alignSelf: "center" }}>
      {/* The box carries its own submit, as drawn: a 32px brand disc at the
          right end of a 54px card. */}
      <View
        style={{
          height: px(54),
          flexDirection: "row",
          alignItems: "center",
          borderRadius: px(12),
          borderWidth: 1,
          borderColor: c.hairline,
          backgroundColor: c.surfaceRaised,
          paddingLeft: px(27),
          paddingRight: px(22),
          shadowColor: "#000000",
          shadowOpacity: 0.04,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 28 },
          elevation: 2,
        }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor={c.inkMuted}
          accessibilityLabel="Search chat history"
          returnKeyType="search"
          onSubmitEditing={() => void handleSearch()}
          style={{ flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: fontSize.xl, color: c.ink, paddingVertical: 0 }}
        />
        <Pressable
          onPress={() => void handleSearch()}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Search"
          hitSlop={6}
          style={({ pressed }) => ({
            marginLeft: space(2),
            height: px(32),
            width: px(32),
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            backgroundColor: pressed && !disabled ? c.brandDark : c.brand,
          })}
        >
          {loading ? (
            <Spinner color="#ffffff" />
          ) : (
            <Svg viewBox="0 0 20 20" width={px(20)} height={px(20)} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeLinecap="round">
              {/* A waveform, as the design draws it: everything said, to
                  search through. */}
              <Path d="M4 8.5v3M7 5.5v9M10 3.5v13M13 6.5v7M16 8.5v3" />
            </Svg>
          )}
        </Pressable>
      </View>

      {error && <ErrorNotice style={{ marginTop: space(6) }}>{error}</ErrorNotice>}

      {results !== null &&
        (results.length === 0 ? (
          <AppText tone="secondary" style={{ marginTop: space(8), paddingHorizontal: px(17), lineHeight: fontSize.sm * 1.25 }}>
            Nothing said in this workspace matches that.
          </AppText>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(r) => r.message_id}
            style={{ marginTop: space(3), flex: 1 }}
            contentContainerStyle={{ paddingBottom: insets.bottom + space(16) }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item: r, index }) => (
              <Animated.View entering={rise(index)}>
                <Pressable
                  onPress={() => router.push(`/chat/${r.conversation_id}`)}
                  accessibilityRole="link"
                  style={({ pressed }) => ({
                    borderBottomWidth: 1,
                    borderBottomColor: c.hairline,
                    paddingHorizontal: px(17),
                    paddingVertical: px(14),
                    backgroundColor: pressed ? c.surfaceHover : "transparent",
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
                    <ChatMark color={c.inkSecondary} />
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkSecondary }}>
                      {r.conversation_title || "Untitled chat"}
                    </Text>
                    {/* Who said it, and in which mode - the right end of the
                        row in the design. */}
                    <View style={{ marginLeft: "auto", flexDirection: "row", flexShrink: 0, alignItems: "center" }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.ink }}>
                        {r.role === "user" ? "You" : "Companion"}
                      </Text>
                      <View style={{ height: px(12), width: px(12), alignItems: "center", justifyContent: "center" }}>
                        <View style={{ height: px(4), width: px(4), borderRadius: 9999, backgroundColor: c.inkMuted }} />
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkSecondary }}>
                        {modeLabel(r.mode_used)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{ marginTop: space(2), fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.25, color: c.inkSecondary }}
                  >
                    {r.content}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          />
        ))}
    </View>
  );
}
