"use client";

import { Toaster as Sonner } from "sonner";

// Single Toaster mount for the workspace shell. Sonner has its own
// internal portal so this only needs to render once per layout —
// the underlying root is shared across every toast() call in the
// tree.
//
// Theme: passthrough sonner defaults, but read the surface palette
// at runtime so dark/light themes adopt without a remount. The
// `richColors` mode opts every toast into the success/error tints
// instead of the plain neutral background.

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      duration={4500}
      toastOptions={{
        // Round + sized to match the rest of the UI's card rhythm
        // — sonner's default is denser than our buttons + alerts.
        className: "text-sm font-medium",
      }}
    />
  );
}
