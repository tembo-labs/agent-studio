import { Section } from "@/components/section";
import { getAppVersion, POWERED_BY_HREF } from "@/lib/config";

export const dynamic = "force-dynamic";

// Version: the release this instance is running. The value is baked into
// the web image at build time (TAS_VERSION build-arg), so it always
// reflects the image that's actually live — read-only and purely
// informational, visible to any workspace member.
export default function VersionPage() {
  const version = getAppVersion();

  return (
    <div className="divide-y divide-[var(--color-border-weak)]">
      <div className="pb-6 first:pt-0">
        <Section
          title="Running version"
          description="The Tembo Agent Studio release this instance is running. Baked into the deployed image, so it always reflects what's actually live."
        >
          <div className="border-border bg-surface-secondary flex flex-wrap items-center justify-between gap-4 rounded-lg border px-5 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-foreground-muted text-xs font-medium uppercase tracking-wide">
                Tembo Agent Studio
              </span>
              {version ? (
                <span className="text-foreground-title font-mono text-2xl font-semibold">
                  {version}
                </span>
              ) : (
                <span className="text-foreground-title text-2xl font-semibold">
                  Development build
                </span>
              )}
            </div>

            {version ? (
              <div className="flex gap-4 text-sm">
                <a
                  href={`${POWERED_BY_HREF}/releases/tag/v${version}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-foreground hover:text-foreground-title underline underline-offset-2"
                >
                  Release notes
                </a>
                <a
                  href={`${POWERED_BY_HREF}/blob/main/CHANGELOG.md`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-foreground hover:text-foreground-title underline underline-offset-2"
                >
                  Changelog
                </a>
              </div>
            ) : (
              <span className="text-foreground-muted max-w-[16rem] text-sm">
                From-source / local builds aren&apos;t versioned. A version
                appears on instances running a published release image.
              </span>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
