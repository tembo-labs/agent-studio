"use client";

import { useState } from "react";

import { CopyButton } from "@/components/copy-button";

// The prefilled Slack app manifest, behind a show/hide toggle with a copy
// button. Client-only because of the toggle + clipboard; the manifest string
// is built on the server and passed in.
export function ManifestBlock({ manifest }: { manifest: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="text-foreground-weak hover:text-foreground text-sm underline underline-offset-2"
      >
        {show ? "Hide" : "Show"} app manifest
      </button>
      {show && (
        <div className="relative mt-2">
          <div className="absolute right-2 top-2 z-10">
            <CopyButton
              text={manifest}
              label="Copy manifest"
              ariaLabel="Copy app manifest to clipboard"
            />
          </div>
          <textarea
            readOnly
            rows={14}
            value={manifest}
            className="bg-input text-foreground-strong w-full resize-y rounded-lg p-2 pr-28 font-mono text-sm shadow-[0_0_0_1px_var(--color-border)]"
          />
        </div>
      )}
    </div>
  );
}
