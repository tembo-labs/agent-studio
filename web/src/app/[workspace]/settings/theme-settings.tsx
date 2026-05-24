"use client";

// Theme settings UI. Three-mode picker (System / Light / Dark) at
// the top; each side shows a swatch grid of presets. System mode
// shows both Light and Dark sides; the OS preference decides which
// side actually renders.

import { useMemo } from "react";

import {
  THEME_PRESETS,
  type ThemeMode,
  type ThemePreset,
  useAccent,
} from "@/components/providers/accent-provider";
import { ThemePreview } from "@/components/settings/theme-preview";
import { cn } from "@/lib/utils";

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function ThemeSettings() {
  const { theme, setMode, setLightPick, setDarkPick } = useAccent();

  const lightPresets = useMemo(
    () => THEME_PRESETS.filter((p) => p.mode === "light"),
    [],
  );
  const darkPresets = useMemo(
    () => THEME_PRESETS.filter((p) => p.mode === "dark"),
    [],
  );

  const showLight = theme.mode === "system" || theme.mode === "light";
  const showDark = theme.mode === "system" || theme.mode === "dark";

  return (
    <div className="flex flex-col gap-6">
      <ModeToggle value={theme.mode} onChange={setMode} />

      {showLight && (
        <SidePicker
          title="Light theme"
          description={
            theme.mode === "system"
              ? "Used when your OS is in light mode."
              : "Always active."
          }
          presets={lightPresets}
          selected={theme.lightPick}
          onSelect={setLightPick}
        />
      )}

      {showDark && (
        <SidePicker
          title="Dark theme"
          description={
            theme.mode === "system"
              ? "Used when your OS is in dark mode."
              : "Always active."
          }
          presets={darkPresets}
          selected={theme.darkPick}
          onSelect={setDarkPick}
        />
      )}
    </div>
  );
}

interface ModeToggleProps {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--color-border-weak)] bg-surface-raised p-0.5">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          aria-pressed={value === m.id}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === m.id
              ? "bg-surface text-foreground shadow-sm"
              : "text-foreground-weak hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

interface SidePickerProps {
  title: string;
  description: string;
  presets: ThemePreset[];
  selected: string;
  onSelect: (id: string) => void;
}

function SidePicker({
  title,
  description,
  presets,
  selected,
  onSelect,
}: SidePickerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border-weak)] bg-surface-raised p-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-foreground-weak">{description}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {presets.map((p) => (
          <PresetCard
            key={p.id}
            preset={p}
            active={selected === p.id}
            onClick={() => onSelect(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface PresetCardProps {
  preset: ThemePreset;
  active: boolean;
  onClick: () => void;
}

function PresetCard({ preset, active, onClick }: PresetCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        active
          ? "border-[var(--color-border-strong)] bg-surface"
          : "border-[var(--color-border-weak)] hover:bg-surface",
      )}
    >
      <ThemePreview preset={preset} />
      <span className="truncate text-foreground">{preset.name}</span>
    </button>
  );
}
