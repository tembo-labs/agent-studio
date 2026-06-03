"use client";

// Tiny stand-in for next-themes. Stores the user's chosen mode
// ("system" | "light" | "dark") in localStorage and toggles the
// `dark` class on <html> based on the resolved mode. Listens to
// `prefers-color-scheme` while in system mode so OS-level changes
// flip the app live.
//
// The actual <html> class application happens twice — once in the
// pre-hydration boot script in app/layout.tsx (so we don't flash
// the wrong mode on first paint) and once here whenever state
// changes after hydration. AccentProvider reads `resolvedTheme`
// from this provider to know whether to apply light or dark
// surface mixes.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

type ThemeMode = "system" | "light" | "dark";
type ResolvedMode = "light" | "dark";

const STORAGE_KEY = "theme-mode";
const STORE_EVENT = "theme-mode-change";

type Ctx = {
  theme: ThemeMode;
  resolvedTheme: ResolvedMode;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function readSystem(): ResolvedMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

function applyClass(resolved: ResolvedMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function subscribeTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(STORE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORE_EVENT, callback);
  };
}

function getThemeServerSnapshot(): ThemeMode {
  return "system";
}

function subscribeSystem(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSystemServerSnapshot(): ResolvedMode {
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read browser theme state as external stores so hydration uses the
  // same deterministic server snapshot as the pre-hydration boot script.
  const theme = useSyncExternalStore(
    subscribeTheme,
    readStored,
    getThemeServerSnapshot,
  );
  const systemMode = useSyncExternalStore(
    subscribeSystem,
    readSystem,
    getSystemServerSnapshot,
  );

  const resolvedTheme: ResolvedMode = theme === "system" ? systemMode : theme;

  useEffect(() => {
    applyClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
      window.dispatchEvent(new Event(STORE_EVENT));
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

// Inline boot script. Runs before hydration so the dark class is on
// <html> at first paint. Defaults to system preference when no
// stored value exists.
export const THEME_BOOT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem('theme-mode');
    var mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var resolved = mode;
    if (mode === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    // never block body parsing on storage / DOM weirdness
  }
})();`;
