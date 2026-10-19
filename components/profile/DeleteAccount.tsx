import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { OutlineButton } from "@/components/profile/ProfileSection";
import { AppText } from "@/components/ui/primitives";
import { space } from "@/lib/theme";

/** Deletes the whole account - workspaces, chats, documents, profile. The
 *  web asks twice with an autofocused "Sure?" button that cancels on blur;
 *  a touch screen has no blur to cancel on, so the second ask is the system
 *  alert, with the destructive choice styled as such. */
export function DeleteAccount() {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/auth/me", { method: "DELETE" });
      logout();
      router.replace("/");
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  function confirm() {
    Alert.alert(
      "Delete your account?",
      "Every workspace, chat, attachment and learned profile fact goes with it. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete everything", style: "destructive", onPress: () => void handleDelete() },
      ],
    );
  }

  return (
    // The heading and the warning live in the section above; this is only
    // the button, and the confirm it has always had.
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(3) }}>
      <OutlineButton danger onClick={confirm} disabled={busy}>
        {busy ? "Deleting…" : "Delete Account"}
      </OutlineButton>
      {error && <AppText tone="low">{error}</AppText>}
    </View>
  );
}
