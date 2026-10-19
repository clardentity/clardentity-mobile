import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { apiFetch } from "@/lib/apiClient";
import { ImportHistory } from "@/components/profile/ImportHistory";
import { authErrorMessage } from "@/lib/auth";
import { AspectList, type Aspect } from "@/components/profile/AspectList";
import { AppText, Badge, Spinner } from "@/components/ui/primitives";
import { OutlineButton, ProfileSection } from "@/components/profile/ProfileSection";
import { ErrorNotice } from "@/components/auth/AuthScreen";
import { useAuth } from "@/lib/auth";
import { fonts, fontSize, px, radius, space, useColors } from "@/lib/theme";

type ProfileRole = {
  role_id: string;
  label: string;
  qualifiers: Record<string, string[]>;
  evidence: string;
};

type Profile = {
  personality_md: string | null;
  aspects: Aspect[];
  roles: ProfileRole[];
  user_edited: boolean;
  updated_at: string | null;
};

/** "4 minutes ago", "yesterday" - the line under the name, which is the
 *  only place the profile says when it last learned anything. */
function sinceLabel(iso: string | null): string {
  if (!iso) return "Nothing learned yet";
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return "Last synchronized just now";
  const units: Array<[number, string]> = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
  ];
  let unit = units[0];
  for (const next of units) if (seconds >= next[0]) unit = next;
  const n = Math.floor(seconds / unit[0]);
  return `Last synchronized ${n} ${unit[1]}${n === 1 ? "" : "s"} ago`;
}

export function ProfileView() {
  const { user } = useAuth();
  const c = useColors();
  const insets = useSafeAreaInsets();
  // The add form lives inside the facts list; the button that opens it is in
  // that section's header, where the design puts it.
  const [addingAspect, setAddingAspect] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState<"rebuild" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // `reloadKey` drives the fetch instead of calling a loader directly, so the
  // effect body never calls setState (which cascades renders); refreshing is
  // just a key bump.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // A refresh is asked for because something changed; skip the GET cache.
    apiFetch<Profile>("/profile", { fresh: reloadKey > 0 })
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function handleAddAspect(label: string, value: string) {
    setError(null);
    try {
      setProfile(
        await apiFetch<Profile>("/profile/aspects", {
          method: "POST",
          body: { label, value },
        }),
      );
      setAddingAspect(false);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  async function handleRemoveAspect(id: string) {
    setError(null);
    try {
      setProfile(await apiFetch<Profile>(`/profile/aspects/${id}`, { method: "DELETE" }));
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  async function handleRebuild() {
    setBusy("rebuild");
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/profile/rebuild", { method: "POST" });
      setNotice("Rebuilding from your history. This runs in the background - use Refresh in a moment to see it.");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleClear() {
    setBusy("clear");
    setError(null);
    try {
      await apiFetch("/profile", { method: "DELETE" });
      setProfile({
        personality_md: null,
        aspects: [],
        roles: [],
        user_edited: false,
        updated_at: null,
      });
      setNotice("Profile deleted. It will start building again as you use the app.");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!profile && !error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space(24) }}>
        <Spinner />
      </View>
    );
  }

  // A profile now exists as soon as there is anything in it, inferred or
  // written by hand. Gating on personality_md hid the add form from exactly
  // the people who had nothing yet and most wanted to write something.
  // Optional chaining rather than a direct read. A response missing either
  // array - an older backend, a partial payload, a proxy that dropped a field
  // - took the whole page down to a runtime error, which is a strictly worse
  // outcome than rendering the empty state and letting them add something.
  const aspects = profile?.aspects ?? [];
  const roles = profile?.roles ?? [];
  const hasProfile = aspects.length > 0 || roles.length > 0;

  const name = user?.display_name || user?.email || "Your profile";
  const initials = name.slice(0, 2).toUpperCase();
  const lh = { lineHeight: fontSize.sm * 1.25 };

  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ paddingHorizontal: space(5), paddingTop: px(74), paddingBottom: insets.bottom + space(16) }}
    >
      {/* The head of the page: who this profile is about, when it last
          learned anything, and the two things you can do to it. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space(4) }}>
        <View style={{ flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space(2) }}>
          <View
            style={{
              height: px(60),
              width: px(60),
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 9999,
              backgroundColor: c.brand,
            }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.xl, color: "#ffffff" }}>{initials}</Text>
          </View>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: fontSize["2xl"], color: c.ink }}>
              {name}
            </Text>
            <AppText tone="secondary" style={lh}>
              {sinceLabel(profile?.updated_at ?? null)}
            </AppText>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexShrink: 0, alignItems: "center", gap: space(2) }}>
          <Pressable
            onPress={() => setReloadKey((k) => k + 1)}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel="Refresh profile"
            accessibilityHint="Read it again"
            style={({ pressed }) => ({
              height: px(42),
              width: px(42),
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: c.hairlineStrong,
              backgroundColor: pressed ? c.surfaceHover : "transparent",
              opacity: busy !== null ? 0.5 : 1,
            })}
          >
            <Svg viewBox="0 0 20 20" width={px(20)} height={px(20)} fill="none" stroke={c.ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M16.3 8.1A6.5 6.5 0 1 0 16 12.4" />
              <Path d="M16.5 4.2v4h-4" />
            </Svg>
          </Pressable>
          <OutlineButton onClick={handleRebuild} disabled={busy !== null}>
            {busy === "rebuild" ? "Rebuilding…" : "Rebuild"}
          </OutlineButton>
        </View>
      </View>

      {error && <ErrorNotice style={{ marginTop: space(6) }}>{error}</ErrorNotice>}
      {notice && (
        <View
          style={{
            marginTop: space(6),
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.hairline,
            backgroundColor: c.surfaceMuted,
            paddingHorizontal: space(3),
            paddingVertical: space(2),
          }}
        >
          <AppText tone="secondary">{notice}</AppText>
        </View>
      )}

      <View style={{ marginTop: space(6) }}>
        <ProfileSection
          title="Conversation History"
          description="Bring your previous conversations with you. Only your messages are read."
        >
          <ImportHistory onImported={() => setReloadKey((k) => k + 1)} />
        </ProfileSection>

        <ProfileSection
          title="Learned Profile Facts"
          description="Autonomous deductions based on interaction history. Each fact can be removed independently."
          action={
            <OutlineButton onClick={() => setAddingAspect((v) => !v)} disabled={busy !== null}>
              {addingAspect ? "Close" : "Add Aspect"}
            </OutlineButton>
          }
        >
          <AspectList
            aspects={aspects}
            adding={addingAspect}
            onAddingChange={setAddingAspect}
            busy={busy !== null}
            onAdd={handleAddAspect}
            onRemove={handleRemoveAspect}
          />
          {hasProfile && (
            // Not in the design, and not the same thing as deleting the
            // account: this throws away what Clardentity has worked out
            // about you and lets it start again, which is the lighter of the
            // two things someone uneasy about a wrong profile actually wants.
            <Pressable
              onPress={handleClear}
              disabled={busy !== null}
              accessibilityRole="button"
              hitSlop={8}
              style={{ marginTop: space(6), alignSelf: "flex-start", opacity: busy !== null ? 0.5 : 1 }}
            >
              {({ pressed }) => (
                <AppText
                  style={[lh, { color: pressed ? c.bandLow : c.inkMuted, textDecorationLine: pressed ? "underline" : "none" }]}
                >
                  {busy === "clear" ? "Deleting…" : "Forget everything learned so far"}
                </AppText>
              )}
            </Pressable>
          )}
        </ProfileSection>

        <ProfileSection
          title="Occupational Roles"
          description="The positions you appear to occupy, and what suggested each one."
          style={{ borderBottomWidth: 0 }}
        >
          {roles.length > 0 ? (
            <View style={{ gap: space(5) }}>
              {roles.map((r) => (
                <View key={r.role_id}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(2) }}>
                    <AppText weight="medium" style={lh}>
                      {r.label}
                    </AppText>
                    {Object.values(r.qualifiers)
                      .flat()
                      .map((v) => (
                        <Badge key={v} tone="brand">
                          {v}
                        </Badge>
                      ))}
                  </View>
                  {r.evidence ? (
                    <AppText tone="secondary" style={[lh, { marginTop: space(1) }]}>
                      {r.evidence}
                    </AppText>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <AppText tone="secondary" style={lh}>
              No roles inferred yet - nothing in your history clearly indicated one.
            </AppText>
          )}
        </ProfileSection>
      </View>
    </ScrollView>
  );
}
