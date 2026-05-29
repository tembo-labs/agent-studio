import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";

import { seedSignedInUser } from "../support/db";
import type { TasWorld } from "../support/world";

// Generic navigation step — reused by any scenario that already
// established a session via Given. The "without a session" variant
// in auth.steps.ts is distinct so anon vs authed flows can't be
// confused at the spec level.
When("I visit {string}", async function (this: TasWorld, path: string) {
  if (!this.page) throw new Error("Playwright page not initialised");
  await this.page.goto(`${this.baseUrl()}${path}`);
});

// Step definitions for the signed-in dashboard scenario. The Given
// step seeds the test session in Postgres + sets the cookie on the
// already-launched Playwright BrowserContext (from world.ts's
// Before hook). The When step is shared with auth.feature via
// the {string} pattern (cucumber resolves by signature).

Given(
  "I'm signed in as a {string} of workspace {string}",
  async function (this: TasWorld, role: string, workspaceSlug: string) {
    if (!this.context) throw new Error("Playwright context not initialised");

    if (
      role !== "workspace_admin" &&
      role !== "operator" &&
      role !== "viewer"
    ) {
      throw new Error(`Unknown role "${role}" — expected workspace_admin, operator, or viewer.`);
    }

    const session = await seedSignedInUser({ workspaceSlug, role });
    this.seededSession = session;

    // better-auth's default cookie name in dev (no `secure`, no
    // custom prefix). The value is the session.token column —
    // server-side lookup compares verbatim.
    const url = new URL(this.baseUrl());
    await this.context.addCookies([
      {
        name: "better-auth.session_token",
        // Signed `<token>.<sig>` (URL-encoded) — anything else and
        // better-auth's `getSignedCookie` rejects the cookie before
        // it ever queries the session table.
        value: session.signedCookieValue,
        domain: url.hostname,
        path: "/",
        httpOnly: true,
        // Local dev runs over http, so `secure: true` would have
        // the browser silently drop the cookie. Production cookies
        // are still secure — better-auth controls that at the
        // server side, not the test harness.
        secure: false,
        sameSite: "Lax",
      },
    ]);
  },
);

Then(
  "I should see the dashboard for {string}",
  async function (this: TasWorld, workspaceSlug: string) {
    if (!this.page) throw new Error("Playwright page not initialised");
    // The dashboard layout renders the workspace name in the
    // sidebar switcher + a "Dashboard" heading. We check both as
    // a smoke-level proof we landed on the right page for the
    // right workspace; either alone would be brittle to UI tweaks.
    try {
      await expect(this.page.locator("body")).toContainText(
        new RegExp(workspaceSlug, "i"),
        { timeout: 3000 },
      );
      await expect(this.page.locator("body")).toContainText(/dashboard/i, {
        timeout: 3000,
      });
    } catch (e) {
      // Dump a screenshot + a chunk of the body text on failure so
      // the operator can tell whether the redirect went to /not-found,
      // bounced to /, or rendered an unexpected 5xx surface.
      const out = await this.page.screenshot({ fullPage: true });
      const fs = await import("node:fs/promises");
      await fs.writeFile("/tmp/bdd-dashboard-failure.png", out);
      const bodyText = await this.page.locator("body").innerText().catch(
        () => "(no body)",
      );
      console.error(
        `[bdd] dashboard assertion failed. URL=${this.page.url()}\n` +
          `body excerpt:\n${bodyText.slice(0, 400)}\n` +
          `screenshot: /tmp/bdd-dashboard-failure.png`,
      );
      throw e;
    }
  },
);
