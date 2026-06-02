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
          {version ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-baseline gap-2">
                <span className="text-foreground-weak">Tembo Agent Studio</span>
                <span className="text-foreground font-mono text-base font-medium">
                  {version}
                </span>
              </div>
              <div className="flex gap-4">
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
            </div>
          ) : (
            <p className="text-foreground-weak text-sm">
              Development build — no version is baked in. A version appears on
              instances running a published release image.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
