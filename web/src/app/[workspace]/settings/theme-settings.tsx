"use client";

// Theme settings UI — preset swatch grid, optional system sub-picks,
// and a custom controls block (accent / surface / intensity) when the
// user has chosen the Custom theme. Adapted from Tembo apps/web's
// preferences.tsx but rebuilt around native form controls so we don't
// need to vendor Popover/Select/Slider.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CUSTOM_THEME_ID,
  INTENSITY_MAX,
  INTENSITY_MIN,
  THEME_PRESETS,
  useAccent,
} from "@/components/providers/accent-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { ColorPicker, normalizeHex } from "@/components/settings/color-picker";
import {
  CUSTOM_PREVIEW_PRESET,
  ThemePreview,
  type PreviewShape,
  type ThemePresetItem,
} from "@/components/settings/theme-preview";
import { cn } from "@/lib/utils";

export function ThemeSettings() {
  const {
    theme: accentTheme,
    setSurface,
    setAccent,
    setIntensity,
    setThemeId,
    setSystemLight,
    setSystemDark,
  } = useAccent();
  const { resolvedTheme } = useTheme();

  const { lightPresets, darkPresets, systemPresets } = useMemo(() => {
    return {
      systemPresets: THEME_PRESETS.filter((p) => p.mode === "system"),
      lightPresets: THEME_PRESETS.filter((p) => p.mode === "light"),
      darkPresets: THEME_PRESETS.filter((p) => p.mode === "dark"),
    };
  }, []);

  const isCustom = accentTheme.themeId === CUSTOM_THEME_ID;
  const isSystem = accentTheme.themeId === "system";

  const customShape: PreviewShape = useMemo(
    () => ({
      mode: resolvedTheme === "dark" ? "dark" : "light",
      surface: accentTheme.customSurface,
      accent: accentTheme.customAccent,
      intensity: accentTheme.customIntensity,
    }),
    [
      resolvedTheme,
      accentTheme.customSurface,
      accentTheme.customAccent,
      accentTheme.customIntensity,
    ],
  );

  const orderedPresets = useMemo(
    () => [...systemPresets, ...lightPresets, ...darkPresets],
    [systemPresets, lightPresets, darkPresets],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {orderedPresets.map((p) => (
          <PresetCard
            key={p.id}
            preset={p}
            active={accentTheme.themeId === p.id}
            onClick={() => setThemeId(p.id)}
          />
        ))}
        <PresetCard
          preset={CUSTOM_PREVIEW_PRESET}
          customShape={customShape}
          label="Custom"
          active={isCustom}
          onClick={() => setThemeId(CUSTOM_THEME_ID)}
        />
      </div>

      {isSystem && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SystemSubPicker
            label="Light mode"
            description="Used when your OS is in light mode."
            value={accentTheme.systemLight}
            onChange={setSystemLight}
            presets={lightPresets}
          />
          <SystemSubPicker
            label="Dark mode"
            description="Used when your OS is in dark mode."
            value={accentTheme.systemDark}
            onChange={setSystemDark}
            presets={darkPresets}
          />
        </div>
      )}

      {isCustom && (
        <div className="flex flex-col gap-4 rounded-lg border border-[var(--color-border-weak)] bg-surface-raised p-4">
          <CustomField
            title="Accent"
            description="Recolors the primary interactive fill."
          >
            <ColorField
              value={accentTheme.customAccent}
              onChange={setAccent}
            />
          </CustomField>
          <CustomField
            title="Background"
            description="Tints background, raised, and secondary surfaces at low opacity."
          >
            <ColorField
              value={accentTheme.customSurface}
              onChange={setSurface}
            />
          </CustomField>
          <CustomField
            title="Intensity"
            description="Scale the background-tint opacity."
          >
            <IntensitySlider
              value={accentTheme.customIntensity}
              onChange={setIntensity}
              disabled={accentTheme.customSurface === null}
            />
          </CustomField>
        </div>
      )}
    </div>
  );
}

interface PresetCardProps {
  preset: ThemePresetItem | typeof CUSTOM_PREVIEW_PRESET;
  customShape?: PreviewShape;
  label?: string;
  active: boolean;
  onClick: () => void;
}

function PresetCard({
  preset,
  customShape,
  label,
  active,
  onClick,
}: PresetCardProps) {
  const name = label ?? ("name" in preset ? preset.name : "Custom");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        active
          ? "border-[var(--color-border-strong)] bg-surface-raised"
          : "border-[var(--color-border-weak)] hover:bg-surface-raised",
      )}
    >
      <ThemePreview preset={preset} customShape={customShape} />
      <span className="truncate text-foreground">{name}</span>
    </button>
  );
}

interface SystemSubPickerProps {
  label: string;
  description: string;
  value: string;
  onChange: (id: string) => void;
  presets: ThemePresetItem[];
}

function SystemSubPicker({
  label,
  description,
  value,
  onChange,
  presets,
}: SystemSubPickerProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-weak)] bg-surface-raised p-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-foreground-weak">{description}</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border-border text-foreground rounded-md border px-2 py-1.5 text-sm"
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function CustomField({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-foreground-weak">{description}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface ColorFieldProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

function ColorField({ value, onChange }: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const [rawInput, setRawInput] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const displayValue = rawInput ?? value ?? "";
  const committedHex = useMemo(
    () => (value ? (normalizeHex(value) ?? "#3b82f6") : "#3b82f6"),
    [value],
  );
  const triggerStyle = useMemo(
    () => ({ backgroundColor: value ?? "transparent" }),
    [value],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      if (next.trim() === "") {
        setRawInput(null);
        onChange(null);
        return;
      }
      const normalized = normalizeHex(next);
      if (normalized) {
        setRawInput(null);
        onChange(normalized);
      } else {
        setRawInput(next);
      }
    },
    [onChange],
  );

  const handlePick = useCallback(
    (hex: string) => {
      setRawInput(null);
      onChange(hex);
    },
    [onChange],
  );

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <button
        type="button"
        aria-label="Open color picker"
        onClick={() => setOpen((o) => !o)}
        className="border-border hover:border-[var(--color-border-strong)] h-6 w-6 shrink-0 rounded-full border transition-colors"
        style={triggerStyle}
      >
        {value ? null : (
          <span className="bg-border block h-px w-[140%] origin-center -translate-x-[14%] translate-y-[11px] -rotate-45" />
        )}
      </button>
      <input
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        placeholder="#000000"
        spellCheck={false}
        className="bg-surface border-border text-foreground w-28 rounded-md border px-2 py-1 font-mono text-xs uppercase"
      />
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-lg border border-[var(--color-border)] bg-surface-raised shadow-lg">
          <ColorPicker value={committedHex} onChange={handlePick} />
        </div>
      )}
    </div>
  );
}

interface IntensitySliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

function IntensitySlider({
  value,
  onChange,
  disabled,
}: IntensitySliderProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        min={Math.round(INTENSITY_MIN * 100)}
        max={Math.round(INTENSITY_MAX * 100)}
        step={5}
        disabled={disabled}
        aria-label="Tint intensity"
        className="w-40"
      />
      <span
        className={cn(
          "text-foreground-weak w-10 text-right font-mono text-xs tabular-nums",
          disabled && "opacity-50",
        )}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}
