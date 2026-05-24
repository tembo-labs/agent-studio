"use client";

// Theme settings UI. Three-mode picker (System / Light / Dark) at
// the top; each side shows a swatch grid with all the presets that
// match its base color plus a Custom slot. Picking Custom expands an
// inline editor (accent color, surface color, intensity). The two
// custom slots are kept separate so a light custom doesn't clobber
// a dark custom.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CUSTOM_DARK_ID,
  CUSTOM_LIGHT_ID,
  INTENSITY_MAX,
  INTENSITY_MIN,
  THEME_PRESETS,
  type CustomConfig,
  type ThemeMode,
  type ThemePreset,
  useAccent,
} from "@/components/providers/accent-provider";
import { ColorPicker, normalizeHex } from "@/components/settings/color-picker";
import {
  ThemePreview,
  type PreviewShape,
} from "@/components/settings/theme-preview";
import { cn } from "@/lib/utils";

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function ThemeSettings() {
  const {
    theme,
    setMode,
    setLightPick,
    setDarkPick,
    setCustomLight,
    setCustomDark,
  } = useAccent();

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
          customId={CUSTOM_LIGHT_ID}
          customLabel="Custom Light"
          customConfig={theme.customLight}
          baseMode="light"
          selected={theme.lightPick}
          onSelect={setLightPick}
          onCustomChange={setCustomLight}
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
          customId={CUSTOM_DARK_ID}
          customLabel="Custom Dark"
          customConfig={theme.customDark}
          baseMode="dark"
          selected={theme.darkPick}
          onSelect={setDarkPick}
          onCustomChange={setCustomDark}
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
  customId: string;
  customLabel: string;
  customConfig: CustomConfig;
  baseMode: "light" | "dark";
  selected: string;
  onSelect: (id: string) => void;
  onCustomChange: (patch: Partial<CustomConfig>) => void;
}

function SidePicker({
  title,
  description,
  presets,
  customId,
  customLabel,
  customConfig,
  baseMode,
  selected,
  onSelect,
  onCustomChange,
}: SidePickerProps) {
  const isCustom = selected === customId;

  const customShape: PreviewShape = {
    mode: baseMode,
    surface: customConfig.surface,
    accent: customConfig.accent,
    intensity: customConfig.intensity,
  };

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
        <PresetCard
          preset={{ id: customId }}
          customShape={customShape}
          label={customLabel}
          active={isCustom}
          onClick={() => onSelect(customId)}
        />
      </div>

      {isCustom && (
        <div className="flex flex-col gap-3 border-t border-[var(--color-border-weak)] pt-3">
          <CustomField
            title="Accent"
            description="Recolors the primary interactive fill."
          >
            <ColorField
              value={customConfig.accent}
              onChange={(v) => onCustomChange({ accent: v })}
            />
          </CustomField>
          <CustomField
            title="Background"
            description="Tints surfaces at low opacity."
          >
            <ColorField
              value={customConfig.surface}
              onChange={(v) => onCustomChange({ surface: v })}
            />
          </CustomField>
          <CustomField
            title="Intensity"
            description="Scale the background-tint opacity."
          >
            <IntensitySlider
              value={customConfig.intensity}
              onChange={(v) => onCustomChange({ intensity: v })}
              disabled={customConfig.surface === null}
            />
          </CustomField>
        </div>
      )}
    </div>
  );
}

interface PresetCardProps {
  preset: ThemePreset | { id: string };
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
  // ThemePreview only needs a full preset for the swatch — we pass a
  // bare-id object for the custom slots and rely on customShape to
  // describe what to render.
  const previewPreset =
    "name" in preset
      ? preset
      : ({ id: "custom" } as unknown as Parameters<
          typeof ThemePreview
        >[0]["preset"]);
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
      <ThemePreview preset={previewPreset} customShape={customShape} />
      <span className="truncate text-foreground">{name}</span>
    </button>
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
