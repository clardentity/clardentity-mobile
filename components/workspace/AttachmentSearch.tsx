import { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage } from "@/lib/auth";
import { AppText, Badge, Button, CardHeader, Input, Spinner } from "@/components/ui/primitives";
import { ErrorNotice } from "@/components/auth/AuthScreen";
import { useRise } from "@/components/workspace/rise";
import { fontSize, radius, space, useColors } from "@/lib/theme";

/* Searching inside attachments, at one of two scopes.
 *
 * Room-wide answers "where did I read that?". Conversation-scoped answers
 * "what was this answer built on?" - a much smaller haystack, and the one you
 * want when auditing a reply rather than hunting for a half-remembered line.
 *
 * Both are literal matching, not the embedding search used for retrieval:
 * someone typing into a search box is usually after a phrase they remember,
 * and semantic nearest-neighbour is the wrong tool for recalling exact
 * wording.
 *
 * The results are a plain list, not a FlatList: this always sits inside a
 * page that scrolls (the documents page, the sources panel), and a server
 * page of hits is short. */

type Hit = {
  document_id: string;
  filename: string;
  chunk_index: number;
  page_number: number | null;
  excerpt: string;
  cited_here: boolean;
};

type Result = { query: string; total: number; hits: Hit[] };

export function AttachmentSearch({
  workspaceId,
  conversationId,
  compact,
}: {
  workspaceId: string;
  /** Restricts the search to attachments this conversation actually cited. */
  conversationId?: string;
  compact?: boolean;
}) {
  const c = useColors();
  const rise = useRise();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scoped = Boolean(conversationId);

  async function handleSearch() {
    const term = query.trim();
    if (!term || searching) return;

    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId, q: term });
      if (conversationId) params.set("conversation_id", conversationId);
      setResult(await apiFetch<Result>(`/documents/search?${params.toString()}`));
    } catch (err) {
      setError(authErrorMessage(err));
      setResult(null);
    } finally {
      setSearching(false);
    }
  }

  return (
    <View style={{ gap: space(3) }}>
      {!compact && (
        <CardHeader
          title={scoped ? "Search this chat's sources" : "Search attachments"}
          description={scoped ? "Only the attachments this chat cited." : "Every attachment in this workspace."}
        />
      )}

      <View style={{ flexDirection: "row", gap: space(2) }}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={scoped ? "Find a phrase in the sources" : "Find a phrase in your attachments"}
          accessibilityLabel="Search attachments"
          returnKeyType="search"
          onSubmitEditing={() => void handleSearch()}
          clearButtonMode="while-editing"
          style={{ flex: 1, width: undefined }}
        />
        <Button
          variant="primary"
          onPress={() => void handleSearch()}
          disabled={searching || !query.trim()}
          style={{ height: 44 }}
        >
          {searching ? <Spinner color="#ffffff" /> : "Search"}
        </Button>
      </View>

      {error && <ErrorNotice>{error}</ErrorNotice>}

      {result && result.total === 0 && (
        <View
          style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: c.hairlineStrong,
            backgroundColor: c.surfaceMuted,
            paddingHorizontal: space(3),
            paddingVertical: space(6),
          }}
        >
          <AppText tone="muted" style={{ textAlign: "center" }}>
            Nothing in {scoped ? "this chat's sources" : "your attachments"} matches “{result.query}”.
          </AppText>
        </View>
      )}

      {result && result.total > 0 && (
        <>
          <AppText size="xs" tone="muted">
            {result.total} passage{result.total === 1 ? "" : "s"}
          </AppText>
          <View style={{ gap: space(2) }}>
            {result.hits.map((hit, i) => (
              <Animated.View
                key={`${hit.document_id}-${hit.chunk_index}`}
                entering={rise(i)}
                style={{
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: c.hairline,
                  backgroundColor: c.surface,
                  padding: space(3),
                }}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space(2), rowGap: space(1) }}>
                  <AppText size="xs" weight="medium">
                    {hit.filename}
                  </AppText>
                  {hit.page_number !== null && (
                    <AppText size="xs" tone="muted">
                      page {hit.page_number}
                    </AppText>
                  )}
                  {hit.cited_here && <Badge tone="brand">cited here</Badge>}
                </View>
                <AppText size="xs" tone="secondary" style={{ marginTop: space(1), lineHeight: fontSize.xs * 1.625 }}>
                  {hit.excerpt}
                </AppText>
              </Animated.View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
