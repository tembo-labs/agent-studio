"use client";

// Tiny color swatch shown next to each preset choice. Mirrors how
// the preset will actually render: surface tint, accent dot, and a
// split-pill for the "system preference" preset that auto-picks.

import { useMemo } from "react";

import {
  CUSTOM_THEME_ID,
  type THEME_PRESETS,
} from "@/components/providers/accent-provider";
import { cn } from "@/lib/utils";

export type ThemePresetItem = (typeof THEME_PRESETS)[number];

const PREVIEW_BASE_CLASS =
  "border-[var(--color-border-weak)] shrink-0 overflow-hidden rounded-md border";

const PREVIEW_SIZE_CLASS = "h-4 w-7";

export interface PreviewShape {
  mode: "light" | "dark";
  surface: string | null;
  accent: string | null;
  intensity: number;
}

interface ThemePreviewProps {
  preset: ThemePresetItem | { id: typeof CUSTOM_THEME_ID };
  customShape?: PreviewShape;
  className?: string;
}

export function ThemePreview({
  preset,
  customShape,
  className,
}: ThemePreviewProps) {
  const shape = useMemo<PreviewShape | "system" | null>(() => {
    if (!("mode" in preset)) {
      return customShape ?? null;
    }
    if (preset.mode === "system") return "system";
    return {
      mode: preset.mode,
      surface: preset.surface,
      accent: preset.accent,
      intensity: preset.intensity,
    };
  }, [preset, customShape]);

  const style = useMemo(() => {
    if (!shape || shape === "system") return;
    const isDark = shape.mode === "dark";
    const baseBg = isDark ? "#0a0a0a" : "#ffffff";
    const baseBorder = isDark ? "#262626" : "#e5e5e5";
    const tintPercent = (isDark ? 10 : 5) * shape.intensity;
    const background = shape.surface
      ? `color-mix(in srgb, ${shape.surface} ${tintPercent}%, ${baseBg})`
      : baseBg;
    return { background, borderColor: baseBorder };
  }, [shape]);

  const accentStyle = useMemo(() => {
    if (!shape || shape === "system" || !shape.accent) return null;
    return { backgroundColor: shape.accent };
  }, [shape]);

  if (shape === "system") {
    return (
      <span
        aria-hidden
        className={cn(
          PREVIEW_BASE_CLASS,
          PREVIEW_SIZE_CLASS,
          "relative",
          className,
        )}
      >
        <span className="absolute inset-y-0 left-0 w-1/2 bg-white" />
        <span className="absolute inset-y-0 right-0 w-1/2 bg-[#0a0a0a]" />
      </span>
    );
  }

  if (!shape) {
    return (
      <span
        aria-hidden
        className={cn(
          PREVIEW_BASE_CLASS,
          PREVIEW_SIZE_CLASS,
          "bg-surface-secondary",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        PREVIEW_BASE_CLASS,
        PREVIEW_SIZE_CLASS,
        "relative",
        className,
      )}
      style={style}
    >
      {accentStyle ? (
        <span
          className="absolute top-1/2 right-0.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
          style={accentStyle}
        />
      ) : null}
    </span>
  );
}

export const CUSTOM_PREVIEW_PRESET = { id: CUSTOM_THEME_ID } as const;
