import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { View } from "react-native";
import { API_BASE_URL } from "@/lib/apiClient";
import { authErrorMessage, getAccessToken, refreshAccessToken } from "@/lib/auth";
import { AppText, Spinner } from "@/components/ui/primitives";
import { OutlineButton } from "@/components/profile/ProfileSection";
import { fontSize, space } from "@/lib/theme";

/* Seeding the profile from another assistant's export.
 *
 * There is no API for this - none of the three providers let a third party
 * read a user's chat history, and there is no sign that will change. What
 * they all do offer is a free data export the user requests themselves, which
 * is a better arrangement anyway: no credentials, no scraping, and the user
 * can see exactly what they are handing over before they hand it over.
 *
 * Uploaded with fetch rather than apiFetch because this is multipart, and
 * apiFetch sets a JSON content type. The file comes from the system document
 * picker (the export is usually in Downloads or Files).
 */

const WHERE_TO_GET_IT = [
  { name: "ChatGPT", path: "Settings → Data controls → Export data", file: "conversations.json" },
  { name: "Claude", path: "Settings → Privacy → Export data", file: "conversations.json" },
  { name: "Gemini", path: "takeout.google.com → My Activity", file: "MyActivity.json" },
];

type Result = { source: string; messages: number; conversations: number };

export function ImportHistory({ onImported }: { onImported?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function choose() {
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        // Some providers' exports arrive without a JSON type on Android, so
        // anything can be picked and the server decides what it can read.
        type: ["application/json", "text/plain", "*/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
    } catch {
      setError("Couldn't open the file picker.");
      return;
    }
    if (picked.canceled || !picked.assets?.[0]) return;
    await upload(picked.assets[0]);
  }

  async function upload(asset: DocumentPicker.DocumentPickerAsset) {
    setBusy(true);
    setError(null);
    setResult(null);

    const body = new FormData();
    if (asset.file) {
      // react-native-web hands back a real File.
      body.append("file", asset.file);
    } else {
      // React Native's FormData reads a { uri, name, type } part from disk.
      body.append("file", {
        uri: asset.uri,
        name: asset.name || "export.json",
        type: asset.mimeType || "application/json",
      } as unknown as Blob);
    }

    async function send(token: string | null) {
      return fetch(`${API_BASE_URL}/profile/import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
      });
    }

    try {
      let res = await send(getAccessToken());
      if (res.status === 401) res = await send(await refreshAccessToken());

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.detail ?? "That file couldn't be read.");
      }
      setResult(payload as Result);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const lh = { lineHeight: fontSize.sm * 1.25 };

  return (
    // No card: on this page the section's own rule is the frame, and the
    // heading above it already says what this is for.
    <View>
      <View style={{ gap: space(1) }}>
        {WHERE_TO_GET_IT.map((source) => (
          <AppText key={source.name} tone="secondary" style={lh}>
            <AppText weight="medium">{source.name}</AppText>
            {"  "}
            {source.path} <AppText tone="secondary" style={{ opacity: 0.7 }}>({source.file})</AppText>
          </AppText>
        ))}
      </View>

      <View style={{ marginTop: space(6), flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(3) }}>
        <OutlineButton onClick={() => void choose()} disabled={busy}>
          {busy ? "Reading…" : "Choose export file"}
        </OutlineButton>
        {busy && <Spinner />}
      </View>

      {result && (
        <AppText tone="high" style={[lh, { marginTop: space(3) }]}>
          Imported {result.messages} of your messages from {result.source}
          {result.conversations > 0 && ` across ${result.conversations} conversations`}. Your
          profile is rebuilding now - refresh in a moment to see it.
        </AppText>
      )}
      {error && (
        <AppText tone="low" style={[lh, { marginTop: space(3) }]}>
          {error}
        </AppText>
      )}
    </View>
  );
}
