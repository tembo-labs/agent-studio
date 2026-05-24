"use client";

// Accent theme provider. Adapted from Tembo's apps/web accent system,
// with the next-themes dependency replaced by our local ThemeProvider.
// Storage shape and CSS contract (--accent-surface, --accent-fill,
// --accent-fill-fg, --tint-intensity, --focus-ring-color, data-tint,
// data-accent) are kept identical so the boot script in app/layout.tsx
// can restore state before hydration without duplicating logic.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { useTheme } from "./theme-provider";

const STORAGE_KEY = "accent-theme";
const ACTIVE_KEY = "accent-theme-active";

export const INTENSITY_MIN = 0.25;
export const INTENSITY_MAX = 2;
const INTENSITY_DEFAULT = 1;

export const CUSTOM_THEME_ID = "custom";

export interface ThemePreset {
  id: string;
  name: string;
  mode: "system" | "light" | "dark";
  surface: string | null;
  accent: string | null;
  intensity: number;
  // When true, surface tokens are replaced with --accent-surface at 100%
  // instead of being color-mixed. For "pure white", "blackout", etc.
  surfaceSolid?: boolean;
  // Explicit focus-ring color; otherwise derived from accent.
  focusRing?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "system",
    name: "System preference",
    mode: "system",
    surface: null,
    accent: null,
    intensity: 1,
  },
  {
    id: "light",
    name: "Light",
    mode: "light",
    surface: null,
    accent: null,
    intensity: 1,
  },
  {
    id: "paper",
    name: "Paper",
    mode: "light",
    surface: "#a47551",
    accent: "#4e342e",
    intensity: 1.1,
  },
  {
    id: "pure-light",
    name: "Pure Light",
    mode: "light",
    surface: "#ffffff",
    accent: null,
    intensity: 1,
    surfaceSolid: true,
  },
  {
    id: "dark",
    name: "Dark",
    mode: "dark",
    surface: null,
    accent: null,
    intensity: 1,
  },
  {
    id: "midnight",
    name: "Midnight",
    mode: "dark",
    surface: "#1e3a8a",
    accent: "#93c5fd",
    intensity: 1.1,
  },
  {
    id: "forest",
    name: "Forest",
    mode: "dark",
    surface: "#14532d",
    accent: "#15803d",
    intensity: 1.2,
    focusRing: "#ffffff",
  },
  {
    id: "ember",
    name: "Ember",
    mode: "dark",
    surface: "#542323",
    accent: "#ffffff",
    intensity: 2,
    focusRing: "#ffffff",
  },
  {
    id: "blackout",
    name: "Blackout",
    mode: "dark",
    surface: "#000000",
    accent: "#2e2e2e",
    intensity: 2,
    focusRing: "#6b6b6b",
  },
];

const DEFAULT_SYSTEM_LIGHT = "light";
const DEFAULT_SYSTEM_DARK = "dark";

function findPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

interface AccentTheme {
  themeId: string;
  customSurface: string | null;
  customAccent: string | null;
  customIntensity: number;
  systemLight: string;
  systemDark: string;
}

const DEFAULT_THEME: AccentTheme = {
  themeId: "system",
  customSurface: null,
  customAccent: null,
  customIntensity: INTENSITY_DEFAULT,
  systemLight: DEFAULT_SYSTEM_LIGHT,
  systemDark: DEFAULT_SYSTEM_DARK,
};

const DEFAULT_JSON = JSON.stringify(DEFAULT_THEME);
const STORE_EVENT = "accent-theme-change";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STORE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): string {
  if (typeof window === "undefined") return DEFAULT_JSON;
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_JSON;
}

function getServerSnapshot(): string {
  return DEFAULT_JSON;
}

function parseTheme(raw: string): AccentTheme {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return { ...DEFAULT_THEME, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

function srgbChannel(v: number): number {
  const c = v / 255;
  return c <= 39.28 / 1000 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb;
  return (
    0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
  );
}

function contrastColor(hex: string): string {
  return relativeLuminance(hex) > 0.5 ? "#0a0a0a" : "#ffffff";
}

// Return the accent color to use for the focus ring, or null if the
// accent is too light to contrast on a light background — caller
// falls back to the default ring color in that case.
function focusRingColor(hex: string): string | null {
  return relativeLuminance(hex) > 0.85 ? null : hex;
}

function writeStored(next: AccentTheme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(STORE_EVENT));
  } catch {
    /* ignore */
  }
}

interface EffectiveTheme {
  surface: string | null;
  accent: string | null;
  intensity: number;
  surfaceSolid: boolean;
  focusRing: string | null;
}

function fromPreset(preset: ThemePreset): EffectiveTheme {
  return {
    surface: preset.surface,
    accent: preset.accent,
    intensity: preset.intensity,
    surfaceSolid: preset.surfaceSolid ?? false,
    focusRing: preset.focusRing ?? null,
  };
}

function resolveEffective(
  theme: AccentTheme,
  resolvedMode: string | undefined,
): EffectiveTheme {
  if (theme.themeId === CUSTOM_THEME_ID) {
    return {
      surface: theme.customSurface,
      accent: theme.customAccent,
      intensity: theme.customIntensity,
      surfaceSolid: false,
      focusRing: null,
    };
  }
  if (theme.themeId === "system") {
    const subId =
      resolvedMode === "dark" ? theme.systemDark : theme.systemLight;
    const preset = findPreset(subId);
    if (preset) return fromPreset(preset);
  }
  const preset = findPreset(theme.themeId);
  if (preset) return fromPreset(preset);
  return {
    surface: null,
    accent: null,
    intensity: INTENSITY_DEFAULT,
    surfaceSolid: false,
    focusRing: null,
  };
}

interface AccentContextValue {
  theme: AccentTheme;
  effective: EffectiveTheme;
  setSurface: (color: string | null) => void;
  setAccent: (color: string | null) => void;
  setIntensity: (intensity: number) => void;
  setThemeId: (id: string) => void;
  setSystemLight: (id: string) => void;
  setSystemDark: (id: string) => void;
}

const AccentContext = createContext<AccentContextValue | null>(null);

function applyEffective(effective: EffectiveTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (effective.surface) {
    root.style.setProperty("--accent-surface", effective.surface);
    root.dataset.tint = "";
    if (effective.surfaceSolid) {
      root.dataset.tintSolid = "";
    } else {
      delete root.dataset.tintSolid;
    }
  } else {
    root.style.removeProperty("--accent-surface");
    delete root.dataset.tint;
    delete root.dataset.tintSolid;
  }

  if (effective.accent) {
    root.style.setProperty("--accent-fill", effective.accent);
    root.style.setProperty(
      "--accent-fill-fg",
      contrastColor(effective.accent),
    );
    root.dataset.accent = "";
  } else {
    root.style.removeProperty("--accent-fill");
    root.style.removeProperty("--accent-fill-fg");
    delete root.dataset.accent;
  }

  const ring =
    effective.focusRing ??
    (effective.accent ? focusRingColor(effective.accent) : null);
  if (ring) {
    root.style.setProperty("--focus-ring-color", ring);
  } else {
    root.style.removeProperty("--focus-ring-color");
  }

  root.style.setProperty("--tint-intensity", String(effective.intensity));

  try {
    window.localStorage.setItem(
      ACTIVE_KEY,
      JSON.stringify({
        ...effective,
        accentFg: effective.accent ? contrastColor(effective.accent) : null,
        focusRing:
          effective.focusRing ??
          (effective.accent ? focusRingColor(effective.accent) : null),
      }),
    );
  } catch {
    /* localStorage unavailable */
  }
}

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const rawTheme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const theme = useMemo(() => parseTheme(rawTheme), [rawTheme]);
  const { resolvedTheme, setTheme: setNextTheme } = useTheme();

  const effective = useMemo(
    () => resolveEffective(theme, resolvedTheme),
    [theme, resolvedTheme],
  );

  useEffect(() => {
    applyEffective(effective);
  }, [effective]);

  const update = useCallback((patch: Partial<AccentTheme>) => {
    const current = parseTheme(getSnapshot());
    writeStored({ ...current, ...patch });
  }, []);

  const setSurface = useCallback(
    (color: string | null) => {
      update({ customSurface: color, themeId: CUSTOM_THEME_ID });
    },
    [update],
  );

  const setAccent = useCallback(
    (color: string | null) => {
      update({ customAccent: color, themeId: CUSTOM_THEME_ID });
    },
    [update],
  );

  const setIntensity = useCallback(
    (intensity: number) => {
      update({ customIntensity: intensity, themeId: CUSTOM_THEME_ID });
    },
    [update],
  );

  const setThemeId = useCallback(
    (id: string) => {
      const preset = findPreset(id);
      if (preset) setNextTheme(preset.mode);
      update({ themeId: id });
    },
    [setNextTheme, update],
  );

  const setSystemLight = useCallback(
    (id: string) => {
      update({ systemLight: id });
    },
    [update],
  );

  const setSystemDark = useCallback(
    (id: string) => {
      update({ systemDark: id });
    },
    [update],
  );

  const value = useMemo(
    () => ({
      theme,
      effective,
      setSurface,
      setAccent,
      setIntensity,
      setThemeId,
      setSystemLight,
      setSystemDark,
    }),
    [
      theme,
      effective,
      setSurface,
      setAccent,
      setIntensity,
      setThemeId,
      setSystemLight,
      setSystemDark,
    ],
  );

  return (
    <AccentContext.Provider value={value}>{children}</AccentContext.Provider>
  );
}

export function useAccent() {
  const ctx = useContext(AccentContext);
  if (!ctx) {
    throw new Error("useAccent must be used within AccentProvider");
  }
  return ctx;
}

// Inline boot script. Runs before hydration so accent CSS vars are
// applied at first paint and the user doesn't see a flash of the
// unstyled / default accent.
export const ACCENT_BOOT_SCRIPT = `(function () {
  try {
    var d = document.documentElement;
    var t = localStorage.getItem('accent-theme-active');
    if (t) {
      t = JSON.parse(t);
      if (t && typeof t === 'object') {
        if (typeof t.surface === 'string') {
          d.style.setProperty('--accent-surface', t.surface);
          d.dataset.tint = '';
          if (t.surfaceSolid) {
            d.dataset.tintSolid = '';
          }
        }
        if (typeof t.accent === 'string') {
          d.style.setProperty('--accent-fill', t.accent);
          d.dataset.accent = '';
        }
        if (typeof t.accentFg === 'string') {
          d.style.setProperty('--accent-fill-fg', t.accentFg);
        }
        if (typeof t.focusRing === 'string') {
          d.style.setProperty('--focus-ring-color', t.focusRing);
        }
        if (typeof t.intensity === 'number') {
          d.style.setProperty('--tint-intensity', String(t.intensity));
        }
      }
    }
  } catch (e) {
    // never block body parsing on storage / DOM weirdness
  }
})();`;
