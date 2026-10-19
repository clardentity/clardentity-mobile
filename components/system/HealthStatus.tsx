import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { BACKEND_ROOT_URL } from "@/lib/apiClient";
import { fonts, fontSize, radius, space, useColors } from "@/lib/theme";

type DependencyStatus = "ok" | "error";

type HealthResponse = {
  status: DependencyStatus;
  dependencies: Record<string, DependencyStatus>;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; data: HealthResponse }
  | { kind: "error"; message: string };

export function HealthStatus() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const c = useColors();

  useEffect(() => {
    let cancelled = false;

    fetch(`${BACKEND_ROOT_URL}/health`)
      .then(async (res) => {
        const data = (await res.json()) as HealthResponse;
        if (!cancelled) setState({ kind: "loaded", data });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ kind: "error", message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const text = { fontFamily: fonts.regular, fontSize: fontSize.sm } as const;

  return (
    <View
      style={{
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.surface,
        padding: space(4),
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          marginBottom: space(2.5),
          fontFamily: fonts.semibold,
          fontSize: fontSize.xs,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: c.inkMuted,
        }}
      >
        Backend connectivity
      </Text>

      {state.kind === "loading" && <Text style={[text, { color: c.inkMuted }]}>Checking…</Text>}

      {state.kind === "error" && (
        <Text style={[text, { color: c.bandLow }]}>
          Could not reach the backend at {BACKEND_ROOT_URL} ({state.message})
        </Text>
      )}

      {state.kind === "loaded" && (
        <View style={{ gap: space(1.5) }}>
          {Object.entries(state.data.dependencies).map(([name, status]) => {
            const tone = status === "ok" ? c.bandHigh : c.bandLow;
            return (
              <View key={name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[text, { color: c.inkSecondary, textTransform: "capitalize" }]}>{name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
                  <Text style={[text, { fontFamily: fonts.medium, color: tone }]}>
                    {status === "ok" ? "healthy" : "error"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
