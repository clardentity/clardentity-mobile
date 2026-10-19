import { localStorage } from "@/lib/storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Appearance, useColorScheme } from "react-native";

/* The design tokens and the theme store.
 *
 * On the web the tokens are CSS variables keyed on <html data-theme> and
 * <html data-accent> (app/globals.css). React Native has no cascade, so the
 * same values live here as plain objects - light and dark for each of the four
 * accents, with only the variables an accent overrides listed under it, as in
 * the stylesheet - and components read them through useColors().
 *
 * The storage keys and the rule (stored choice, else the OS; burgundy is the
 * default and means "no accent") are the web's, so the two apps agree. */

export type Theme = "light" | "dark";
export type Accent = "burgundy" | "indigo" | "teal" | "plum";

const STORAGE_KEY = "clardentity-theme";
const ACCENT_KEY = "clardentity-accent";

/** The accents, in the order the picker shows them. `swatch` is the accent
 *  itself - what the dot in the picker is painted with. */
export const ACCENTS: Array<{ value: Accent; label: string; swatch: string }> = [
  { value: "burgundy", label: "Burgundy", swatch: "#6b2d5c" },
  { value: "indigo", label: "Indigo", swatch: "#2d3561" },
  { value: "teal", label: "Teal", swatch: "#0d7c7b" },
  { value: "plum", label: "Plum Velvet", swatch: "#4b2f64" },
];

/* ------------------------------------------------------------- tokens -- */

export type Colors = {
  canvas: string;
  surface: string;
  surfaceMuted: string;
  surfaceHover: string;
  surfaceSunken: string;
  bubbleMine: string;
  surfaceRaised: string;
  hairline: string;
  hairlineStrong: string;
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  inkInverse: string;
  nav: string;
  navStrong: string;
  navMuted: string;
  brand: string;
  brandDark: string;
  brandSoft: string;
  brandBorder: string;
  bandModerate: string;
  bandHigh: string;
  bandHighBg: string;
  bandHighBorder: string;
  bandMid: string;
  bandMidBg: string;
  bandMidBorder: string;
  bandLow: string;
  bandLowBg: string;
  bandLowBorder: string;
  caution: string;
  cautionBg: string;
  cautionBorder: string;
  focusRing: string;
  cardMark: string;
  avatarSkinLit: string;
  avatarSkin: string;
  avatarSkinShade: string;
  avatarBodyLit: string;
  avatarFace: string;
  avatarBlush: string;
  avatarShadow: string;
};

/* Burgundy. --text-muted uses the phone value (globals.css:468-478), since
   this app is only ever the phone layout. */
const BURGUNDY_LIGHT: Colors = {
  canvas: "#f5f3f4",
  surface: "#ffffff",
  surfaceMuted: "#faf8f9",
  surfaceHover: "rgba(77,67,57,0.05)",
  surfaceSunken: "#f5f3f4",
  bubbleMine: "#edeaeb",
  surfaceRaised: "#ffffff",
  hairline: "#f2f0ed",
  hairlineStrong: "#e8e3e7",
  ink: "#3d2a2f",
  inkSecondary: "#6b5c60",
  inkMuted: "#776b6f",
  inkInverse: "#ffffff",
  nav: "#5f5551",
  navStrong: "#4d4339",
  navMuted: "#8b7b73",
  brand: "#6b2d5c",
  brandDark: "#5a2550",
  brandSoft: "#f7f1f6",
  brandBorder: "#e3cfdd",
  bandModerate: "#5f8b21",
  bandHigh: "#248a3d",
  bandHighBg: "#f1f9f3",
  bandHighBorder: "#c2e5cd",
  bandMid: "#c04c00",
  bandMidBg: "#fff8f0",
  bandMidBorder: "#fbd9b5",
  bandLow: "#d70015",
  bandLowBg: "#fff2f2",
  bandLowBorder: "#f8cbcb",
  caution: "#b25000",
  cautionBg: "#fff8f1",
  cautionBorder: "#f7d6b3",
  focusRing: "#6b2d5c",
  cardMark: "#6b2d5c",
  avatarSkinLit: "#ffffff",
  avatarSkin: "#dfeaf7",
  avatarSkinShade: "#b4cbe3",
  avatarBodyLit: "#4a9eea",
  avatarFace: "#1d2b3a",
  avatarBlush: "#f0a8b8",
  avatarShadow: "rgba(0,0,0,0.12)",
};

const BURGUNDY_DARK: Colors = {
  canvas: "#131011",
  surface: "#1c1819",
  surfaceMuted: "#0d0b0b",
  surfaceHover: "#292325",
  surfaceSunken: "#0d0b0b",
  bubbleMine: "#2d2628",
  surfaceRaised: "#231e1f",
  hairline: "#332b2d",
  hairlineStrong: "#453a3d",
  ink: "#f5f0f2",
  inkSecondary: "#b6a5aa",
  inkMuted: "#928488",
  inkInverse: "#ffffff",
  nav: "#beafb3",
  navStrong: "#ded3d6",
  navMuted: "#8e8084",
  brand: "#c86ab1",
  brandDark: "#d982c4",
  brandSoft: "#2b1525",
  brandBorder: "#582f4e",
  bandModerate: "#9be34f",
  bandHigh: "#30d158",
  bandHighBg: "#0a1f10",
  bandHighBorder: "#1c4527",
  bandMid: "#ff9f0a",
  bandMidBg: "#241705",
  bandMidBorder: "#4d360b",
  bandLow: "#ff453a",
  bandLowBg: "#260d0c",
  bandLowBorder: "#55201d",
  caution: "#ff9f0a",
  cautionBg: "#241705",
  cautionBorder: "#4d360b",
  focusRing: "#c86ab1",
  cardMark: "#c86ab1",
  avatarSkinLit: "#f0f5fb",
  avatarSkin: "#c8dcf0",
  avatarSkinShade: "#93b4d4",
  avatarBodyLit: "#5aa9f8",
  avatarFace: "#16212e",
  avatarBlush: "#e58aa8",
  avatarShadow: "rgba(255,255,255,0.10)",
};

type Override = Partial<Colors>;

const ACCENT_OVERRIDES: Record<Exclude<Accent, "burgundy">, { light: Override; dark: Override }> = {
  indigo: {
    light: {
      canvas: "#f3f3f5", surfaceMuted: "#f5f6fb", surfaceSunken: "#f3f3f5", surfaceHover: "rgba(70,57,77,0.05)",
      bubbleMine: "#eaebed", hairline: "#f1edf2", hairlineStrong: "#e3e6e8", ink: "#2f334c", inkSecondary: "#5f6582",
      inkMuted: "#6a6d7f", nav: "#57515f", navStrong: "#46394d", navMuted: "#7e738b", brand: "#2d3561",
      brandDark: "#25305a", brandSoft: "#f1f2f7", brandBorder: "#cfd1e3", focusRing: "#2d3561", cardMark: "#2d3561",
    },
    dark: {
      canvas: "#101113", surface: "#18191c", surfaceMuted: "#0b0b0d", surfaceSunken: "#0b0b0d", surfaceHover: "#232429",
      surfaceRaised: "#1e1f23", bubbleMine: "#26272d", hairline: "#2b2c33", hairlineStrong: "#3a3c45", ink: "#f0f1f5",
      inkSecondary: "#a5a7b6", inkMuted: "#858793", nav: "#afb1be", navStrong: "#d3d5de", navMuted: "#80828e",
      brand: "#6a79c8", brandDark: "#828fd9", brandSoft: "#15182b", brandBorder: "#2f3658", focusRing: "#6a79c8",
      cardMark: "#6a79c8",
    },
  },
  teal: {
    light: {
      canvas: "#f3f5f5", surfaceMuted: "#f8fcfc", surfaceSunken: "#f3f5f5", surfaceHover: "rgba(57,62,77,0.05)",
      bubbleMine: "#eaeded", hairline: "#edeef2", hairlineStrong: "#e3e8e5", ink: "#1a3434", inkSecondary: "#4a6b6a",
      inkMuted: "#5d7373", nav: "#51575f", navStrong: "#393e4d", navMuted: "#737d8b", brand: "#0d7c7b",
      brandDark: "#255a57", brandSoft: "#f1f7f6", brandBorder: "#cfe2e3", focusRing: "#0d7c7b", cardMark: "#0d7c7b",
    },
    dark: {
      canvas: "#101313", surface: "#181c1c", surfaceMuted: "#0b0d0d", surfaceSunken: "#0b0d0d", surfaceHover: "#232929",
      surfaceRaised: "#1e2323", bubbleMine: "#262d2d", hairline: "#2b3333", hairlineStrong: "#3a4545", ink: "#f0f5f5",
      inkSecondary: "#a5b6b6", inkMuted: "#859393", nav: "#afbebe", navStrong: "#d3dede", navMuted: "#808e8e",
      brand: "#6ac8c7", brandDark: "#82d9d8", brandSoft: "#152b2b", brandBorder: "#2f5857", focusRing: "#6ac8c7",
      cardMark: "#6ac8c7",
    },
  },
  plum: {
    light: {
      canvas: "#f5f3f4", surfaceMuted: "#f9f7fc", surfaceSunken: "#f5f3f4", surfaceHover: "rgba(77,57,72,0.05)",
      bubbleMine: "#ebeaed", hairline: "#f2edf0", hairlineStrong: "#e3e3e8", ink: "#2f1f3f", inkSecondary: "#6b5a7b",
      inkMuted: "#77697d", nav: "#5f515e", navStrong: "#4d3948", navMuted: "#8b7389", brand: "#4b2f64",
      brandDark: "#3e255a", brandSoft: "#f4f1f7", brandBorder: "#dbcfe3", focusRing: "#4b2f64", cardMark: "#5d3a7a",
    },
    dark: {
      canvas: "#121013", surface: "#1a181c", surfaceMuted: "#0c0b0d", surfaceSunken: "#0c0b0d", surfaceHover: "#262329",
      surfaceRaised: "#211e23", bubbleMine: "#2a262d", hairline: "#2f2b33", hairlineStrong: "#403a45", ink: "#f3f0f5",
      inkSecondary: "#ada5b6", inkMuted: "#908a96", nav: "#b6afbe", navStrong: "#d9d3de", navMuted: "#87808e",
      brand: "#9c6ac8", brandDark: "#b082d9", brandSoft: "#20152b", brandBorder: "#452f58", focusRing: "#9c6ac8",
      cardMark: "#9c6ac8",
    },
  },
};

export function paletteFor(theme: Theme, accent: Accent): Colors {
  const base = theme === "dark" ? BURGUNDY_DARK : BURGUNDY_LIGHT;
  if (accent === "burgundy") return base;
  return { ...base, ...ACCENT_OVERRIDES[accent][theme] };
}

/* Type, space and radius.
 *
 * The web design was drawn at desktop size and the phone layout zooms the
 * whole page to 0.92 (app/globals.css, lib/uiScale.ts on the web). Scaling
 * the root of a native view is not an option, so the factor is baked into the
 * numbers here instead: `px(16)` is what 16 CSS px came out as on a phone.
 * The smallest label is held at 12.5, as on the web. */
export const UI_SCALE = 0.92;
export function px(n: number): number {
  return Math.round(n * UI_SCALE * 10) / 10;
}

/** The web's overridden Tailwind type scale (globals.css:442-449), zoomed. */
export const fontSize = {
  xs: Math.max(12.5, px(12)),
  sm: px(16),
  base: px(16),
  lg: px(20),
  xl: px(20),
  "2xl": px(24),
  "3xl": px(28),
  "4xl": px(32),
} as const;

/** Tailwind's 4px spacing step, zoomed: `space(4)` is `p-4`. */
export function space(steps: number): number {
  return px(steps * 4);
}

export const radius = {
  sm: px(2),
  base: px(4),
  md: px(6),
  lg: px(8),
  xl: px(12),
  "2xl": px(16),
  full: 9999,
} as const;

/** Outfit is the app's sans (globals.css:420); Geist Mono for code. Android
 *  needs a family per weight, so weight is picked by name, not fontWeight. */
export const fonts = {
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  mono: "GeistMono_400Regular",
} as const;

/* -------------------------------------------------------------- store -- */

const listeners = new Set<() => void>();

function announce() {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function storedTheme(): Theme | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function currentTheme(): Theme {
  return storedTheme() ?? (Appearance.getColorScheme() === "dark" ? "dark" : "light");
}

/** What the picker should show as selected. */
export function storedAccent(): Accent {
  const stored = localStorage.getItem(ACCENT_KEY);
  return ACCENTS.some((a) => a.value === stored) ? (stored as Accent) : "burgundy";
}

export function currentAccent(): Accent {
  return storedAccent();
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  announce();
}

export function toggleTheme() {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
}

export function setAccent(accent: Accent) {
  localStorage.setItem(ACCENT_KEY, accent);
  announce();
}

/** The current choice, as on the web: one string snapshot so it is stable
 *  between renders. Follows the OS live until the user picks a side. */
export function useAppearance(): { accent: Accent; theme: Theme } {
  const os = useColorScheme();
  const snapshot = useSyncExternalStore(subscribe, () => `${storedAccent()}:${storedTheme() ?? ""}`);
  const [accent, stored] = snapshot.split(":");
  const theme: Theme = stored === "light" || stored === "dark" ? stored : os === "dark" ? "dark" : "light";
  return { accent: accent as Accent, theme };
}

type ThemeContextValue = { theme: Theme; accent: Accent; colors: Colors };

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  accent: "burgundy",
  colors: BURGUNDY_LIGHT,
});

/** Provides the resolved palette to everything below it. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, accent } = useAppearance();
  const value = useMemo(() => ({ theme, accent, colors: paletteFor(theme, accent) }), [theme, accent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Draws a subtree in one theme whatever the app is in, keeping the accent -
 *  the web's `data-theme="dark"` on a single element (the landing demo's
 *  panel sits on a dark photograph in either theme). */
export function ThemeOverride({ theme, children }: { theme: Theme; children: ReactNode }) {
  const { accent } = useContext(ThemeContext);
  const value = useMemo(() => ({ theme, accent, colors: paletteFor(theme, accent) }), [theme, accent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}

/** The web re-ran the accent rule per route (the landing page stays
 *  burgundy for signed-out visitors). The app has no landing route, so there
 *  is nothing to re-run; kept so the root layout mirrors the web's. */
export function AccentScope() {
  return null;
}

/** Build a StyleSheet from the palette once per palette change. */
export function useThemedStyles<T>(factory: (c: Colors) => T): T {
  const colors = useColors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(colors), [colors]);
}

/** Re-render on any appearance change, for code that reads currentTheme()
 *  directly. */
export function useAppearanceVersion(): number {
  const [n, setN] = useState(0);
  const bump = useCallback(() => setN((v) => v + 1), []);
  useEffect(() => subscribe(bump), [bump]);
  return n;
}
