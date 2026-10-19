import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type TextStyle } from "react-native";
import { ErrorBoundary } from "@/components/system/ErrorBoundaries";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { BarChart, DonutChart, LineChart, formatTokens, type Slice } from "@/components/admin/Charts";
import { PickerSheet } from "@/components/admin/PickerSheet";
import { AppText } from "@/components/ui/primitives";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  last_active_at: string | null;
  location: string | null;
  accepted_terms: boolean;
  onboarded: boolean;
  preview_unlocked: boolean;
  questions_asked: number;
  answers: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

type Bucket = { label: string; tokens: number };

type Overview = {
  generated_at: string;
  window_days: number;
  user_count: number;
  active_user_count: number;
  conversation_count: number;
  answer_count: number;
  turns_without_usage: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  users: UserRow[];
  by_day: Bucket[];
  by_mode: Bucket[];
  by_model: Bucket[];
};

type Source = "database" | "analytics";

type QueryResult = {
  question: string;
  sql: string;
  explanation: string;
  chart: "table" | "bar" | "pie" | "line";
  label_column: string | null;
  value_column: string | null;
  columns: string[];
  rows: (string | number | boolean | null)[][];
  source?: Source;
};

type PinnedView = {
  id: string;
  title: string;
  source: Source;
  query: string;
  chart: QueryResult["chart"];
  label_column: string | null;
  value_column: string | null;
  explanation: string | null;
};

type AnalyticsSlice = { label: string; value: number };

type Analytics = {
  configured: boolean;
  error: string | null;
  window_days: number;
  visitors: number;
  signed_in_visitors: number;
  events: number;
  by_day: { label: string; visitors: number; questions: number; demo_questions: number }[];
  demo_funnel: AnalyticsSlice[];
  demo_gated: AnalyticsSlice[];
  modes_picked: AnalyticsSlice[];
  questions_by_mode: AnalyticsSlice[];
  gates: AnalyticsSlice[];
  locked_modes: AnalyticsSlice[];
  upgrade_interest: AnalyticsSlice[];
  feedback: AnalyticsSlice[];
  devices: AnalyticsSlice[];
  problems: AnalyticsSlice[];
};

const SOURCE_LABEL: Record<Source, string> = {
  database: "from our database · everyone",
  analytics: "from PostHog · visitors who allowed analytics",
};

const TABULAR: TextStyle = { fontVariant: ["tabular-nums"] };

const styles = (c: Colors) => ({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.hairline,
    backgroundColor: c.surface,
    padding: space(4),
  },
  pill: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: c.hairline,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  },
});

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.card}>
      <View style={{ marginBottom: space(3) }}>
        <AppText weight="semibold">{title}</AppText>
        {subtitle && (
          <AppText size="xs" tone="muted" style={{ marginTop: space(0.5) }}>
            {subtitle}
          </AppText>
        )}
      </View>
      {children}
    </View>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const s = useThemedStyles(styles);
  return (
    // Two across, as the web's grid-cols-2 on a phone.
    <View style={[s.card, { flexBasis: "47%", flexGrow: 1, paddingVertical: space(3) }]}>
      <AppText size="xs" tone="muted">
        {label}
      </AppText>
      <AppText size="xl" weight="semibold" style={[{ marginTop: space(1) }, TABULAR]}>
        {value}
      </AppText>
      {hint && (
        <AppText size="xs" tone="muted" style={{ marginTop: space(0.5) }}>
          {hint}
        </AppText>
      )}
    </View>
  );
}

function StatGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(3) }}>{children}</View>;
}

/** A small rounded-border button: Refresh, Unpin, Pin to dashboard. */
function PillButton({
  onPress,
  disabled,
  tone = "plain",
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  tone?: "plain" | "brand";
  children: string;
}) {
  const c = useColors();
  const s = useThemedStyles(styles);
  const brand = tone === "brand";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [
        s.pill,
        brand && { borderColor: c.brandBorder, backgroundColor: pressed ? c.brand : c.brandSoft },
        !brand && pressed && { backgroundColor: c.surfaceHover },
        disabled && { opacity: 0.6 },
      ]}
    >
      {({ pressed }) => (
        <AppText
          size="xs"
          weight={brand ? "medium" : "regular"}
          style={{ color: brand ? (pressed ? "#ffffff" : c.brand) : pressed ? c.ink : c.inkSecondary }}
        >
          {children}
        </AppText>
      )}
    </Pressable>
  );
}

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "–";

/** The rows a chart draws, from the columns the query named. */
function chartRowsOf(result: QueryResult): Slice[] {
  if (result.rows.length === 0) return [];
  const labelIdx = Math.max(0, result.columns.indexOf(result.label_column ?? result.columns[0]));
  const valueIdx = Math.max(
    0,
    result.columns.indexOf(result.value_column ?? result.columns[result.columns.length - 1]),
  );
  return result.rows
    .map((r) => ({ label: String(r[labelIdx] ?? "–"), value: Number(r[valueIdx] ?? 0) }))
    .filter((s) => Number.isFinite(s.value));
}

/** A table that scrolls sideways inside its card rather than widening the
 *  screen. Columns are a fixed width each - React Native has no table
 *  layout to size them to their contents. */
function Table({
  head,
  rows,
  widths,
}: {
  head: string[];
  rows: ReactNode[][];
  widths: number[];
}) {
  const c = useColors();
  const cell = (i: number): { width: number; paddingRight: number } => ({ width: widths[i] ?? px(120), paddingRight: space(3) });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.hairlineStrong, paddingBottom: space(2) }}>
          {head.map((h, i) => (
            <AppText key={h} weight="medium" tone="muted" style={cell(i)}>
              {h}
            </AppText>
          ))}
        </View>
        {rows.map((row, r) => (
          <View
            key={r}
            style={{ flexDirection: "row", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: c.hairline, paddingVertical: space(1.5) }}
          >
            {row.map((value, i) => (
              <View key={i} style={cell(i)}>
                {typeof value === "string" || typeof value === "number" ? (
                  <AppText tone="secondary">{value}</AppText>
                ) : (
                  value
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** One answered view - chart, table and the query behind it. Shared by the
 *  "ask" box and every pinned tile, so a pinned view looks like its answer. */
function ResultView({ result, compact = false }: { result: QueryResult; compact?: boolean }) {
  const c = useColors();
  const rows = chartRowsOf(result);
  const shown = compact ? 10 : 50;
  // The web's <details>: the query, folded away until asked for.
  const [showSql, setShowSql] = useState(false);
  return (
    <View style={{ gap: space(3) }}>
      {result.explanation ? (
        <AppText size="xs" tone="secondary">
          {result.explanation}
        </AppText>
      ) : null}
      <ErrorBoundary where="admin-chart" label="This chart couldn't be shown.">
        {result.chart === "pie" && <DonutChart slices={rows} total={rows.reduce((a, s) => a + s.value, 0)} />}
        {result.chart === "bar" && <BarChart slices={rows} />}
        {result.chart === "line" && <LineChart points={rows} />}
      </ErrorBoundary>
      {(result.chart === "table" || !compact) && (
        <Table
          head={result.columns}
          widths={result.columns.map(() => px(140))}
          rows={result.rows.slice(0, shown).map((row) => row.map((cell) => (cell === null ? "–" : String(cell))))}
        />
      )}
      {result.rows.length > shown && (
        <AppText size="xs" tone="muted">
          Showing {shown} of {result.rows.length} rows.
        </AppText>
      )}
      <View>
        <Pressable onPress={() => setShowSql((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showSql }}>
          <AppText size="xs" tone="muted">
            {showSql ? "▾" : "▸"} The query that ran
          </AppText>
        </Pressable>
        {showSql && (
          <Text
            selectable
            style={{
              marginTop: space(1.5),
              borderRadius: radius.lg,
              backgroundColor: c.surfaceMuted,
              padding: space(2.5),
              fontFamily: fonts.mono,
              fontSize: fontSize.xs,
              color: c.inkSecondary,
            }}
          >
            {result.sql}
          </Text>
        )}
      </View>
    </View>
  );
}

/** A bar chart that says so when there is nothing to draw yet. */
function Bars({ slices }: { slices: AnalyticsSlice[] }) {
  if (slices.length === 0) {
    return (
      <AppText size="xs" tone="muted">
        Nothing recorded yet.
      </AppText>
    );
  }
  return (
    <ErrorBoundary where="admin-chart" label="This chart couldn't be shown.">
      <BarChart slices={slices} />
    </ErrorBoundary>
  );
}

/** What visitors did in the app and on the web, from PostHog. Its own fetch,
 *  so a PostHog that is slow or not connected never holds up the database
 *  half. */
function AnalyticsSection({ analytics }: { analytics: Analytics | "loading" | "failed" }) {
  if (analytics === "loading") {
    return (
      <Card title="Product analytics" subtitle="From PostHog">
        <AppText size="xs" tone="muted">
          Asking PostHog…
        </AppText>
      </Card>
    );
  }
  if (analytics === "failed" || !analytics.configured || analytics.error) {
    const message =
      analytics === "failed"
        ? "The analytics could not be loaded."
        : !analytics.configured
          ? "Not connected yet: the backend needs POSTHOG_PROJECT_ID and POSTHOG_QUERY_KEY (a PostHog personal API key with Query: Read on the EU project)."
          : analytics.error;
    return (
      <Card title="Product analytics" subtitle="From PostHog">
        <AppText size="xs" tone="secondary">
          {message}
        </AppText>
      </Card>
    );
  }
  const a = analytics;
  const signups = a.demo_funnel.find((s) => s.label === "Clicked sign up")?.value ?? 0;
  return (
    <View style={{ gap: space(3) }}>
      <View>
        <AppText weight="semibold">Product analytics · last {a.window_days} days</AppText>
        {/* Said next to the numbers, not in a footnote: these count only the
            visitors who allowed analytics, so they are a sample, not totals.
            Totals - accounts, questions, tokens - are the database's above. */}
        <AppText size="xs" tone="muted" style={{ marginTop: space(0.5) }}>
          From PostHog. Counts only visitors who allowed analytics, so read these as a sample - the totals above come
          from our database.
        </AppText>
      </View>
      <StatGrid>
        <Stat label="Visitors" value={String(a.visitors)} hint={`${a.signed_in_visitors} signed in`} />
        <Stat label="Events" value={String(a.events)} />
        <Stat
          label="Demo visitors"
          value={String(a.demo_funnel[0]?.value ?? 0)}
          hint={`${a.demo_funnel[1]?.value ?? 0} asked something`}
        />
        <Stat label="Sign-ups from the demo" value={String(signups)} hint="clicked through to sign up" />
      </StatGrid>
      <Card title="Visitors per day">
        {a.by_day.length > 0 ? (
          <ErrorBoundary where="admin-chart" label="This chart couldn't be shown.">
            <LineChart points={a.by_day.map((d) => ({ label: d.label.slice(5), value: d.visitors }))} />
          </ErrorBoundary>
        ) : (
          <AppText size="xs" tone="muted">
            Nothing recorded yet.
          </AppText>
        )}
      </Card>
      <Card title="The visitor demo" subtitle="Visitors who reached each step">
        <Bars slices={a.demo_funnel} />
      </Card>
      <Card title="What demo visitors reached for" subtitle="Account-only controls tapped in the demo">
        <Bars slices={a.demo_gated} />
      </Card>
      <Card title="Companions picked by hand">
        <Bars slices={a.modes_picked} />
      </Card>
      <Card title="Questions about the question" subtitle="Gates shown before answering, by kind">
        <Bars slices={a.gates} />
      </Card>
      <Card title="Interest in paid plans" subtitle="Visitors, not taps">
        <Bars slices={a.upgrade_interest} />
        {a.locked_modes.length > 0 && (
          <View style={{ marginTop: space(3) }}>
            <AppText size="xs" tone="muted" style={{ marginBottom: space(1.5) }}>
              Locked companions tapped
            </AppText>
            <Bars slices={a.locked_modes} />
          </View>
        )}
      </Card>
      <Card title="Was this helpful?">
        <Bars slices={a.feedback} />
      </Card>
      <Card title="Devices and problems">
        <Bars slices={[...a.devices, ...a.problems]} />
      </Card>
    </View>
  );
}

export function AdminDashboard() {
  const c = useColors();
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [source, setSource] = useState<"auto" | Source>("auto");
  const [analytics, setAnalytics] = useState<Analytics | "loading" | "failed">("loading");
  const [views, setViews] = useState<PinnedView[]>([]);
  const [viewResults, setViewResults] = useState<Record<string, QueryResult | string>>({});
  const [pinning, setPinning] = useState(false);

  const runView = useCallback((view: PinnedView) => {
    apiFetch<QueryResult>(`/admin/views/${view.id}/result`)
      .then((r) => setViewResults((prev) => ({ ...prev, [view.id]: r })))
      .catch((err) =>
        setViewResults((prev) => ({
          ...prev,
          [view.id]: authErrorMessage(err),
        })),
      );
  }, []);

  const load = useCallback(() => {
    apiFetch<Overview>("/admin/overview")
      .then(setData)
      .catch(() => setError("This account cannot open the dashboard."));
    // No reset to "loading" on Refresh: the last answer stays up until the
    // new one lands, and the effect that first calls this must not set state.
    apiFetch<Analytics>("/admin/analytics")
      .then(setAnalytics)
      .catch(() => setAnalytics("failed"));
    apiFetch<PinnedView[]>("/admin/views")
      .then((list) => {
        setViews(list);
        list.forEach(runView);
      })
      .catch(() => setViews([]));
  }, [runView]);

  useEffect(load, [load]);

  async function ask() {
    if (!question.trim() || running) return;
    setRunning(true);
    setQueryError(null);
    try {
      setResult(await apiFetch<QueryResult>("/admin/query", { method: "POST", body: { question, source } }));
    } catch (err) {
      setResult(null);
      // The server's reason ("Only SELECT queries are allowed", "PostHog's
      // allowance is used up"), not the status code it came with.
      setQueryError(authErrorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  /** Keep this answer on the dashboard: its query is stored and re-run each
   *  time the screen opens, so the tile stays live. */
  async function pin() {
    if (!result || pinning) return;
    setPinning(true);
    try {
      const view = await apiFetch<PinnedView>("/admin/views", {
        method: "POST",
        body: {
          title: result.question,
          source: result.source ?? "database",
          query: result.sql,
          chart: result.chart,
          label_column: result.label_column,
          value_column: result.value_column,
          explanation: result.explanation || null,
        },
      });
      setViews((prev) => [...prev, view]);
      setViewResults((prev) => ({ ...prev, [view.id]: result }));
    } catch (err) {
      setQueryError(authErrorMessage(err));
    } finally {
      setPinning(false);
    }
  }

  async function unpin(view: PinnedView) {
    try {
      await apiFetch(`/admin/views/${view.id}`, { method: "DELETE" });
      setViews((prev) => prev.filter((v) => v.id !== view.id));
    } catch {
      // Left on screen; the next refresh shows the truth.
    }
  }

  if (error) {
    return (
      <View style={{ paddingHorizontal: space(4), paddingVertical: space(16), alignItems: "center" }}>
        <AppText tone="low" style={{ textAlign: "center" }}>
          {error}
        </AppText>
        <AppText size="xs" tone="muted" style={{ marginTop: space(2), textAlign: "center" }}>
          Signed in as {user?.email}
        </AppText>
      </View>
    );
  }
  if (!data) {
    return (
      <AppText tone="muted" style={{ paddingHorizontal: space(4), paddingVertical: space(16), textAlign: "center" }}>
        Reading the numbers…
      </AppText>
    );
  }

  // The pie the client asked for: tokens by user, biggest first, with the
  // long tail gathered rather than drawn as forty invisible slivers.
  const spenders = data.users.filter((u) => u.total_tokens > 0).sort((a, b) => b.total_tokens - a.total_tokens);
  const top = spenders.slice(0, 7);
  const rest = spenders.slice(7).reduce((acc, u) => acc + u.total_tokens, 0);
  const pie: Slice[] = [
    ...top.map((u) => ({ label: u.display_name || u.email, value: u.total_tokens })),
    ...(rest > 0 ? [{ label: `${spenders.length - 7} others`, value: rest }] : []),
  ];

  const analyticsReady = typeof analytics === "object";

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: space(4), paddingVertical: space(8), gap: space(5) }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: space(3) }}>
        <View style={{ flexShrink: 1 }}>
          <AppText size="xl" weight="semibold" style={{ letterSpacing: -0.3 }}>
            Admin
          </AppText>
          <AppText size="xs" tone="muted">
            Generated {new Date(data.generated_at).toLocaleString()} · signed in as {user?.email}
          </AppText>
        </View>
        <PillButton onPress={load}>Refresh</PillButton>
      </View>

      <StatGrid>
        <Stat label="Registered" value={String(data.user_count)} hint={`${data.active_user_count} have asked something`} />
        <Stat label="Conversations" value={String(data.conversation_count)} />
        <Stat label="Answers" value={String(data.answer_count)} />
        <Stat
          label="Tokens"
          value={formatTokens(data.total_tokens)}
          hint={`${formatTokens(data.input_tokens)} in · ${formatTokens(data.output_tokens)} out`}
        />
      </StatGrid>

      {data.turns_without_usage > 0 && (
        // Said out loud rather than smoothed over: the totals above are a
        // floor, and this is exactly how far below the truth they may sit.
        <View
          style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.cautionBorder,
            backgroundColor: c.cautionBg,
            paddingHorizontal: space(3),
            paddingVertical: space(2),
          }}
        >
          <AppText size="xs" style={{ color: c.caution }}>
            {data.turns_without_usage} of {data.answer_count} answers were written before token metering existed and
            count as zero. Totals are a floor until those age out.
          </AppText>
        </View>
      )}

      <View style={{ gap: space(3) }}>
        <Card title="Tokens by user" subtitle="Share of everything spent, biggest first">
          <ErrorBoundary where="admin-chart" label="This chart couldn't be shown.">
            <DonutChart slices={pie} total={data.total_tokens} />
          </ErrorBoundary>
        </Card>
        <Card title="Tokens by mode" subtitle="Which companions cost what">
          <ErrorBoundary where="admin-chart" label="This chart couldn't be shown.">
            <BarChart slices={data.by_mode.filter((b) => b.tokens > 0).map((b) => ({ label: b.label, value: b.tokens }))} />
          </ErrorBoundary>
        </Card>
        {/* The breakdown that maps to money. "By mode" cannot see it: the
            same mode answered on the cheapest and the dearest model is the
            same bar, and the two differ by more than an order of magnitude
            now that the picker offers both. */}
        {data.by_model?.length > 0 && (
          <Card title="Tokens by model" subtitle="Every call, under the model that served it">
            <ErrorBoundary where="admin-chart" label="This chart couldn't be shown.">
              <BarChart slices={data.by_model.filter((b) => b.tokens > 0).map((b) => ({ label: b.label, value: b.tokens }))} />
            </ErrorBoundary>
          </Card>
        )}
        <Card title={`Daily usage · last ${data.window_days} days`}>
          <ErrorBoundary where="admin-chart" label="This chart couldn't be shown.">
            <LineChart points={data.by_day.map((b) => ({ label: b.label.slice(5), value: b.tokens }))} />
          </ErrorBoundary>
        </Card>
      </View>

      <AnalyticsSection analytics={analytics} />

      <Card title="Users" subtitle={`${data.user_count} accounts`}>
        {/* The table scrolls inside the card, not the screen sideways. */}
        <Table
          head={["Email", "Joined", "Last active", "Asked", "Tokens", "Flags"]}
          widths={[px(220), px(80), px(90), px(64), px(72), px(150)]}
          rows={data.users.map((u) => [
            <View key="email">
              <AppText numberOfLines={1}>{u.email}</AppText>
              {u.display_name && (
                <AppText size="xs" tone="muted" numberOfLines={1}>
                  {u.display_name}
                  {u.location ? ` · ${u.location}` : ""}
                </AppText>
              )}
            </View>,
            shortDate(u.created_at),
            shortDate(u.last_active_at),
            <AppText key="asked" tone="secondary" style={TABULAR}>
              {u.questions_asked}
            </AppText>,
            <AppText key="tokens" style={TABULAR}>
              {formatTokens(u.total_tokens)}
            </AppText>,
            <View key="flags" style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1) }}>
              {!u.accepted_terms && <Flag tone="warn">no terms</Flag>}
              {!u.onboarded && <Flag>not onboarded</Flag>}
              {u.preview_unlocked && <Flag tone="brand">preview</Flag>}
            </View>,
          ])}
        />
      </Card>

      {views.length > 0 && (
        <View style={{ gap: space(3) }}>
          <View>
            <AppText weight="semibold">Your views</AppText>
            <AppText size="xs" tone="muted" style={{ marginTop: space(0.5) }}>
              Pinned from the questions below, and re-run every time this screen opens.
            </AppText>
          </View>
          {views.map((view) => {
            const outcome = viewResults[view.id];
            return (
              <View
                key={view.id}
                style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: c.hairline, backgroundColor: c.surface, padding: space(4) }}
              >
                <View style={{ marginBottom: space(3), flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space(2) }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText weight="semibold">{view.title}</AppText>
                    <AppText size="xs" tone="muted" style={{ marginTop: space(0.5) }}>
                      {SOURCE_LABEL[view.source]}
                    </AppText>
                  </View>
                  <PillButton onPress={() => void unpin(view)}>Unpin</PillButton>
                </View>
                {outcome === undefined && (
                  <AppText size="xs" tone="muted">
                    Running…
                  </AppText>
                )}
                {typeof outcome === "string" && (
                  <AppText size="xs" tone="low">
                    {outcome}
                  </AppText>
                )}
                {outcome && typeof outcome !== "string" && <ResultView result={outcome} compact />}
              </View>
            );
          })}
        </View>
      )}

      <Card
        title="Ask for a view"
        subtitle="A question in English becomes one read-only query - against our database, or against PostHog's analytics. It cannot read what anyone wrote, and it cannot change anything."
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            onSubmitEditing={() => void ask()}
            returnKeyType="go"
            placeholder="Which modes get used most? How many demo visitors reached for attach?"
            placeholderTextColor={c.inkMuted}
            maxLength={500}
            style={{
              flexBasis: "100%",
              minHeight: px(40),
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: c.hairline,
              backgroundColor: c.surfaceRaised,
              paddingHorizontal: space(3),
              paddingVertical: space(2),
              fontFamily: fonts.regular,
              fontSize: fontSize.sm,
              color: c.ink,
            }}
          />
          <PickerSheet
            value={source}
            onChange={setSource}
            accessibilityLabel="Where to look"
            options={[
              { value: "auto", label: "Wherever fits" },
              { value: "database", label: "Our database" },
              { value: "analytics", label: "PostHog analytics", disabled: analyticsReady && !analytics.configured },
            ]}
          />
          <Pressable
            onPress={() => void ask()}
            disabled={running || !question.trim()}
            accessibilityRole="button"
            style={({ pressed }) => ({
              height: px(36),
              justifyContent: "center",
              borderRadius: radius.lg,
              backgroundColor: pressed ? c.brandDark : c.brand,
              paddingHorizontal: space(4),
              opacity: running || !question.trim() ? 0.6 : 1,
            })}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: "#ffffff" }}>
              {running ? "Working…" : "Show me"}
            </Text>
          </Pressable>
        </View>

        {queryError && (
          <AppText size="xs" tone="low" style={{ marginTop: space(3) }}>
            {queryError}
          </AppText>
        )}

        {result && (
          <View style={{ marginTop: space(4), gap: space(3) }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space(2) }}>
              <AppText size="xs" tone="muted">
                {SOURCE_LABEL[result.source ?? "database"]}
              </AppText>
              <PillButton tone="brand" onPress={() => void pin()} disabled={pinning}>
                {pinning ? "Pinning…" : "Pin to dashboard"}
              </PillButton>
            </View>
            <ResultView result={result} />
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

function Flag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warn" | "brand" }) {
  const c = useColors();
  const [border, bg, fg] =
    tone === "warn"
      ? [c.cautionBorder, c.cautionBg, c.caution]
      : tone === "brand"
        ? [c.brandBorder, c.brandSoft, c.brand]
        : [c.hairline, c.surfaceMuted, c.inkMuted];
  return (
    <View
      style={{
        borderRadius: radius.base,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        paddingHorizontal: space(1.5),
        paddingVertical: space(0.5),
      }}
    >
      <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: fg, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {children}
      </Text>
    </View>
  );
}
