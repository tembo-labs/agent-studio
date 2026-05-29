"use client";

import { useActionState, useRef } from "react";
import { useActionToast } from "@/lib/use-action-toast";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_FAVICON_KINDS,
  FAVICON_LABELS,
  type FaviconKind,
} from "@/lib/favicon-constants";

import {
  setFaviconDefaultAction,
  uploadFaviconAction,
  type FaviconFormState,
} from "./actions";

const INITIAL: FaviconFormState = {};

type Props = {
  workspaceSlug: string;
  currentKind: FaviconKind;
  /** Cache-busting suffix so the live tab favicon refreshes after save. */
  cacheKey: string;
};

export function FaviconPicker({
  workspaceSlug,
  currentKind,
  cacheKey,
}: Props) {
  const [defaultState, defaultAction, defaultPending] = useActionState(
    setFaviconDefaultAction,
    INITIAL,
  );
  useActionToast(defaultState);
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadFaviconAction,
    INITIAL,
  );
  useActionToast(uploadState);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const customSrc = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/favicon?v=${cacheKey}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {DEFAULT_FAVICON_KINDS.map((kind) => (
          <form key={kind} action={defaultAction}>
            <input type="hidden" name="workspace" value={workspaceSlug} />
            <input type="hidden" name="kind" value={kind} />
            <button
              type="submit"
              disabled={defaultPending}
              aria-pressed={currentKind === kind}
              className={
                currentKind === kind
                  ? "bg-surface-raised border-foreground-title flex w-full flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 transition-colors"
                  : "bg-surface-raised border-border hover:border-border-strong flex w-full flex-col items-center gap-1.5 rounded-lg border px-2 py-3 transition-colors"
              }
            >
              <img
                src={`/favicons/${kind}.svg`}
                alt=""
                aria-hidden
                className="text-foreground h-8 w-8"
              />
              <span className="text-foreground text-xs font-medium">
                {FAVICON_LABELS[kind]}
              </span>
            </button>
          </form>
        ))}

        <form action={uploadAction} className="contents">
          <label
            className={
              currentKind === "custom"
                ? "bg-surface-raised border-foreground-title flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 transition-colors"
                : "bg-surface-raised border-border hover:border-border-strong flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-2 py-3 transition-colors"
            }
            aria-disabled={uploadPending}
          >
            <input type="hidden" name="workspace" value={workspaceSlug} />
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico"
              disabled={uploadPending}
              className="sr-only"
              onChange={(e) => {
                if (e.currentTarget.files?.length) {
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            {currentKind === "custom" ? (
              <img
                src={customSrc}
                alt=""
                aria-hidden
                className="h-8 w-8 object-contain"
              />
            ) : (
              <span
                aria-hidden
                className="text-foreground-weak flex h-8 w-8 items-center justify-center text-xl"
              >
                +
              </span>
            )}
            <span className="text-foreground text-xs font-medium">
              {currentKind === "custom" ? "Custom (change)" : "Upload"}
            </span>
          </label>
        </form>
      </div>

      <p className="text-foreground-muted text-sm">
        PNG, SVG, or ICO, up to 200 KB. The favicon shows in the browser
        tab for everyone using this workspace.
      </p>

      {(defaultState.error || uploadState.error) && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {defaultState.error ?? uploadState.error}
        </p>
      )}
      {(defaultState.message || uploadState.message) && (
        <p className="text-foreground-weak text-sm">
          {defaultState.message ?? uploadState.message}
        </p>
      )}

      {/* Standalone Choose-file button for keyboard / screen-reader users
          who prefer not to rely on the label-as-button pattern above. */}
      {currentKind === "custom" && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadPending}
          >
            {uploadPending ? "Uploading…" : "Choose a different file"}
          </Button>
        </div>
      )}
    </div>
  );
}
