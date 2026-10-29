import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fetch } from "expo/fetch";
import * as Sharing from "expo-sharing";
import { API_BASE_URL, serverDetail } from "@/lib/apiClient";
import { getAccessToken, refreshAccessToken } from "@/lib/auth";
import { deleteQuietly, exportFile, safeFileName } from "@/lib/exportFiles";
import { Spinner } from "@/components/ui/primitives";
import { fonts, fontSize, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* Creative mode's "make it a real file" - turns one answer into an actual
 * Word document, slide deck, or spreadsheet.
 *
 * A raw fetch, not apiFetch: the response here is file bytes, not JSON, and
 * apiFetch always parses the body as JSON on success. expo/fetch rather than
 * the global one, for a reliable arrayBuffer() on both platforms.
 */

const FORMATS: { value: "docx" | "pptx" | "xlsx"; label: string }[] = [
  { value: "docx", label: "Word document" },
  { value: "pptx", label: "Slide deck" },
  { value: "xlsx", label: "Spreadsheet" },
];

const MIME: Record<"docx" | "pptx" | "xlsx", string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const UTI: Record<"docx" | "pptx" | "xlsx", string> = {
  docx: "org.openxmlformats.wordprocessingml.document",
  pptx: "org.openxmlformats.presentationml.presentation",
  xlsx: "org.openxmlformats.spreadsheetml.sheet",
};

export function ExportFileMenu({
  conversationId,
  messageId,
}: {
  conversationId: string;
  messageId: string;
}) {
  const [open, setOpen] = useState(false);
  const [busyFormat, setBusyFormat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const c = useColors();
  const s = useThemedStyles(styles);

  async function request(format: string, accessToken: string | null) {
    return fetch(`${API_BASE_URL}/chat/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/export-file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ format }),
    });
  }

  async function download(format: "docx" | "pptx" | "xlsx") {
    setError(null);
    setBusyFormat(format);
    try {
      let res = await request(format, getAccessToken());
      // An expired access token is not a failure to generate - refresh it
      // once and ask again, as apiFetch does for JSON calls.
      if (res.status === 401) {
        const fresh = await refreshAccessToken();
        if (fresh) res = await request(format, fresh);
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(serverDetail(body, res.status, "Couldn't generate the file"));
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = safeFileName(disposition.match(/filename="([^"]+)"/)?.[1], `document.${format}`);

      // The web clicked an off-DOM download link. A phone has no downloads
      // folder to drop it in, so the file is written to the cache and handed
      // to the share sheet, from which it can be saved to Files, opened in
      // Word, or sent on - and deleted once the sheet is done with it.
      const file = exportFile(filename);
      file.create({ overwrite: true });
      try {
        await file.write(bytes);
        if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device");
        await Sharing.shareAsync(file.uri, { mimeType: MIME[format], UTI: UTI[format], dialogTitle: filename });
      } finally {
        deleteQuietly(file);
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the file");
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <View style={s.root}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={({ pressed }) => [s.toggle, pressed && { backgroundColor: c.surfaceHover }]}
      >
        <Text style={s.toggleText}>Save as file</Text>
      </Pressable>

      {open && (
        <View style={s.formats}>
          {FORMATS.map((f) => (
            <Pressable
              key={f.value}
              onPress={() => void download(f.value)}
              disabled={busyFormat !== null}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.format,
                pressed && { backgroundColor: c.surfaceHover },
                busyFormat !== null && { opacity: 0.5 },
              ]}
            >
              {busyFormat === f.value && <Spinner />}
              <Text style={s.formatText}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    root: { marginTop: space(1.5), alignItems: "flex-start" },
    toggle: { borderRadius: radius.md, paddingHorizontal: space(1.5), paddingVertical: space(0.5) },
    toggleText: {
      fontSize: fontSize.xs,
      fontFamily: fonts.regular,
      color: c.inkMuted,
      textDecorationLine: "underline",
      textDecorationColor: c.hairlineStrong,
    },
    formats: { marginTop: space(1.5), flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(1.5) },
    format: {
      flexDirection: "row",
      alignItems: "center",
      gap: space(1),
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: c.hairlineStrong,
      paddingHorizontal: space(2.5),
      paddingVertical: space(1),
    },
    formatText: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.inkSecondary },
    error: { marginTop: space(1), fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.bandLow },
  });
