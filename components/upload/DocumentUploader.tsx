import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as DocumentPicker from "expo-document-picker";
import { File as FsFile } from "expo-file-system";
import { API_BASE_URL, apiFetch, serverDetail } from "@/lib/apiClient";
import { authErrorMessage, getAccessToken, refreshAccessToken } from "@/lib/auth";
import { Badge, Spinner } from "@/components/ui/primitives";
import { DOCUMENT_EXTENSIONS, MAX_DOCUMENT_BYTES, fileExtension } from "@/components/chat/MessageInput";
import { track } from "@/lib/analytics";
import { deleteQuietly } from "@/lib/exportFiles";
import { fonts, fontSize, px, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

type DocumentItem = {
  id: string;
  filename: string;
  file_type: string | null;
  status: "uploading" | "processing" | "processed" | "failed";
  created_at: string;
};

const POLL_INTERVAL_MS = 2000;

/** The attachments page's body: the title row with its Upload button, and
 *  the grid of what is in the workspace.
 *
 *  The header lives here rather than in the page above because the button in
 *  it starts this component's upload - the upload state (the spinner, the
 *  error) belongs to the same place as the control that starts it. */
export function DocumentUploader({
  workspaceId,
  description,
}: {
  workspaceId: string;
  description: string;
}) {
  const s = useThemedStyles(styles);
  const colors = useColors();
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchDocuments = useCallback((): Promise<DocumentItem[]> => {
    // Polled while anything is still processing, so never from the cache.
    return apiFetch<DocumentItem[]>(`/documents?workspace_id=${encodeURIComponent(workspaceId)}`, { fresh: true });
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    fetchDocuments()
      .then((data) => {
        if (!cancelled) setDocuments(data);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [fetchDocuments]);

  // Poll while any document is still processing so status updates without a manual refresh.
  useEffect(() => {
    if (!documents || !documents.some((d) => d.status === "processing" || d.status === "uploading")) {
      return;
    }
    const interval = setInterval(() => {
      fetchDocuments()
        .then(setDocuments)
        .catch(() => {
          // transient poll failure - try again next tick
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  async function handleUpload() {
    // The system picker filters by MIME type, not extension, so it opens on
    // everything and the extension is checked here instead of by `accept`.
    const picked = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const file = picked.assets[0];
    // The picker's copy in the cache is ours to remove once it has been
    // sent (or turned away): it is someone's document, and the cache only
    // clears when the OS decides to.
    const cached = new FsFile(file.uri);
    const ext = fileExtension(file.name);
    if (!DOCUMENT_EXTENSIONS.includes(ext)) {
      setError("That file type isn't supported. Use PDF, Word, Excel, PowerPoint, or a text file");
      deleteQuietly(cached);
      return;
    }
    const size = file.size ?? cached.size ?? 0;
    // The server's limit (MAX_UPLOAD_SIZE_MB), checked here so a phone
    // doesn't spend a minute uploading something that will be refused.
    if (size > MAX_DOCUMENT_BYTES) {
      setError("That file is over 25MB. Try a smaller one");
      deleteQuietly(cached);
      return;
    }
    setError(null);
    setUploading(true);

    try {
      // A FormData body is consumed by the request, so a retry builds its own.
      const post = (accessToken: string | null) => {
        const form = new FormData();
        form.append("workspace_id", workspaceId);
        // React Native's FormData takes a file as { uri, name, type }.
        form.append("file", {
          uri: file.uri,
          name: file.name,
          type: file.mimeType ?? "application/octet-stream",
        } as unknown as Blob);
        return fetch(`${API_BASE_URL}/documents/upload`, {
          method: "POST",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          body: form,
        });
      };

      track("document_uploaded", {
        extension: ext || undefined,
        size_kb: Math.round(size / 1024),
      });
      let res = await post(getAccessToken());
      // An expired access token is not a failed upload - refresh it once and
      // send again, as apiFetch does for JSON calls.
      if (res.status === 401) {
        const fresh = await refreshAccessToken();
        if (fresh) res = await post(fresh);
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(serverDetail(body, res.status, `Upload failed with status ${res.status}`));
      }

      const data = await fetchDocuments();
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      deleteQuietly(cached);
      setUploading(false);
    }
  }

  async function handleDelete(documentId: string) {
    try {
      await apiFetch(`/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" });
      const data = await fetchDocuments();
      setDocuments(data);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  // Two to a row: the web's grid at its phone width (grid-cols-2).
  const rows: DocumentItem[][] = [];
  for (let i = 0; i < (documents?.length ?? 0); i += 2) rows.push(documents!.slice(i, i + 2));

  return (
    <>
      <View style={s.header}>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.title} accessibilityRole="header">
            Attachments
          </Text>
          <Text style={s.description}>{description}</Text>
        </View>
        <View style={s.headerActions}>
          {uploading && <Spinner />}
          <Pressable
            onPress={() => void handleUpload()}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Upload a document"
            hitSlop={2}
            style={({ pressed }) => [
              s.upload,
              { backgroundColor: pressed ? colors.brandDark : colors.brand },
              uploading && { opacity: 0.6 },
            ]}
          >
            <Text style={s.uploadText}>{uploading ? "Uploading…" : "Upload"}</Text>
            <Svg
              viewBox="0 0 20 20"
              width={px(20)}
              height={px(20)}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M10 12.5V3.6M6.6 7 10 3.6 13.4 7" />
              <Path d="M3.5 12.2v2.6a1.6 1.6 0 0 0 1.6 1.6h9.8a1.6 1.6 0 0 0 1.6-1.6v-2.6" />
            </Svg>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {documents === null ? (
        <View style={s.loading}>
          <Spinner />
        </View>
      ) : documents.length === 0 ? (
        <Text style={[s.description, { marginTop: space(10) }]}>
          Nothing attached yet. What you upload here is read once and then
          available to every chat in this workspace.
        </Text>
      ) : (
        // The design draws this as a wall of tiles. Ours carry what a tile
        // of a document can actually say: what kind of file it is, what it
        // is called, and whether it has been read yet.
        <View style={s.grid}>
          {rows.map((row, r) => (
            <View key={r} style={s.gridRow}>
              {row.map((doc, c) => (
                <Animated.View
                  key={doc.id}
                  // The web's phone-rise: tiles settle in one after another.
                  entering={FadeInDown.delay(Math.min(r * 2 + c, 12) * 40).duration(300)}
                  style={s.tile}
                >
                  <Text style={s.ext}>{extensionOf(doc.filename) || doc.file_type || "file"}</Text>
                  <View style={{ minWidth: 0 }}>
                    <Text numberOfLines={2} style={s.filename}>
                      {doc.filename}
                    </Text>
                    <View style={{ marginTop: space(2) }}>
                      <StatusBadge status={doc.status} />
                    </View>
                  </View>
                  {/* Always shown: a touch screen has no hover to reveal it,
                      and a phone had no way to know a file could be removed. */}
                  <Pressable
                    onPress={() => void handleDelete(doc.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${doc.filename}`}
                    hitSlop={14}
                    style={s.delete}
                  >
                    {({ pressed }) => (
                      <Svg
                        viewBox="0 0 24 24"
                        width={px(14)}
                        height={px(14)}
                        fill="none"
                        stroke={pressed ? colors.bandLow : colors.inkMuted}
                        strokeWidth={2}
                        strokeLinecap="round"
                      >
                        <Path d="M18 6 6 18M6 6l12 12" />
                      </Svg>
                    )}
                  </Pressable>
                </Animated.View>
              ))}
              {row.length === 1 && <View style={[s.tile, s.spacer]} />}
            </View>
          ))}
        </View>
      )}
    </>
  );
}

/** "PDF", "DOCX" - what the tile leads with. */
function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toUpperCase();
}

function StatusBadge({ status }: { status: DocumentItem["status"] }) {
  const tones: Record<DocumentItem["status"], "neutral" | "mid" | "high" | "low"> = {
    uploading: "neutral",
    processing: "mid",
    processed: "high",
    failed: "low",
  };
  return <Badge tone={tones[status]}>{status}</Badge>;
}

const styles = (c: Colors) =>
  StyleSheet.create({
    header: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: space(4) },
    title: { fontFamily: fonts.medium, fontSize: fontSize["4xl"], lineHeight: fontSize["4xl"] * 1.25, color: c.ink },
    description: { fontFamily: fonts.regular, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.25, color: c.inkSecondary },
    headerActions: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: space(3) },
    upload: {
      height: px(42),
      flexDirection: "row",
      alignItems: "center",
      gap: space(1),
      borderRadius: px(34),
      paddingHorizontal: space(3),
      paddingVertical: space(2),
    },
    uploadText: { fontFamily: fonts.regular, fontSize: fontSize.xl, color: "#ffffff" },
    error: { marginTop: space(4), fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.bandLow },
    loading: { alignItems: "center", paddingVertical: space(16) },
    grid: { marginTop: space(10), gap: space(4) },
    gridRow: { flexDirection: "row", gap: space(4) },
    // The design's tiles are a shade off the canvas with no border.
    // surface-sunken is the canvas itself in this palette, so they were
    // invisible; the hover wash is the one fill in the system that is a step
    // away from the background in both themes.
    tile: {
      flex: 1,
      height: px(145),
      justifyContent: "space-between",
      borderRadius: px(12),
      backgroundColor: c.surfaceHover,
      padding: space(4),
    },
    spacer: { backgroundColor: "transparent" },
    ext: { fontFamily: fonts.medium, fontSize: fontSize.xs, letterSpacing: 0.4, textTransform: "uppercase", color: c.inkMuted },
    filename: { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.25, color: c.ink },
    delete: { position: "absolute", right: space(2), top: space(2), padding: space(1), borderRadius: 4 },
  });
