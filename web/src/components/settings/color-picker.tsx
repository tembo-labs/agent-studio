"use client";

// HSV color picker — saturation/value plane + hue strip. Ported
// from Tembo's apps/web settings component. No external deps; uses
// pointer events with capture for smooth drag.

import { useCallback, useEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";

interface HSV {
  h: number;
  s: number;
  v: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function normalizeHex(input: string): string | null {
  const trimmed = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = [...trimmed];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toLowerCase()}`;
  }
  return null;
}

function hexToHsv(hex: string): HSV {
  const normalized = normalizeHex(hex) ?? "#000000";
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToHex({ h, s, v }: HSV): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) {
    rp = c;
    gp = x;
  } else if (h < 120) {
    rp = x;
    gp = c;
  } else if (h < 180) {
    gp = c;
    bp = x;
  } else if (h < 240) {
    gp = x;
    bp = c;
  } else if (h < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
}

function hueToHex(h: number): string {
  return hsvToHex({ h, s: 1, v: 1 });
}

const HUE_GRADIENT = {
  background:
    "linear-gradient(to right, #ef4444 0%, #eab308 17%, #22c55e 33%, #06b6d4 50%, #3b82f6 67%, #a855f7 83%, #ef4444 100%)",
};

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const hsv = useMemo(() => hexToHsv(value), [value]);
  const hsvRef = useRef(hsv);
  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const updateFromSV = useCallback(
    (clientX: number, clientY: number) => {
      const el = svRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const s = clamp((clientX - rect.left) / rect.width, 0, 1);
      const v = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
      onChange(hsvToHex({ h: hsvRef.current.h, s, v }));
    },
    [onChange],
  );

  const updateFromHue = useCallback(
    (clientX: number) => {
      const el = hueRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const h = clamp((clientX - rect.left) / rect.width, 0, 1) * 360;
      const { s, v } = hsvRef.current;
      onChange(hsvToHex({ h, s, v }));
    },
    [onChange],
  );

  const handleSVPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      updateFromSV(e.clientX, e.clientY);
    },
    [updateFromSV],
  );

  const handleSVPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons === 0) return;
      updateFromSV(e.clientX, e.clientY);
    },
    [updateFromSV],
  );

  const handleHuePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      updateFromHue(e.clientX);
    },
    [updateFromHue],
  );

  const handleHuePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons === 0) return;
      updateFromHue(e.clientX);
    },
    [updateFromHue],
  );

  const svBackground = useMemo(
    () => ({
      backgroundColor: hueToHex(hsv.h),
      backgroundImage:
        "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
    }),
    [hsv.h],
  );

  const svPointerStyle = useMemo(
    () => ({
      left: `${hsv.s * 100}%`,
      top: `${(1 - hsv.v) * 100}%`,
      backgroundColor: value,
    }),
    [hsv.s, hsv.v, value],
  );

  const huePointerStyle = useMemo(
    () => ({
      left: `${(hsv.h / 360) * 100}%`,
    }),
    [hsv.h],
  );

  return (
    <div className="flex flex-col gap-3 p-3">
      <div
        ref={svRef}
        onPointerDown={handleSVPointerDown}
        onPointerMove={handleSVPointerMove}
        className="border-border relative h-32 w-full cursor-crosshair touch-none overflow-hidden rounded-lg border"
        style={svBackground}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow",
            "ring-1 ring-black/20",
          )}
          style={svPointerStyle}
        />
      </div>
      <div
        ref={hueRef}
        onPointerDown={handleHuePointerDown}
        onPointerMove={handleHuePointerMove}
        className="border-border relative h-3 w-full cursor-pointer touch-none overflow-hidden rounded-full border"
        style={HUE_GRADIENT}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/20"
          style={huePointerStyle}
        />
      </div>
    </div>
  );
}

export { normalizeHex };
