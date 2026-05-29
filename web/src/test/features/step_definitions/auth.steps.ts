import { Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";

import type { TasWorld } from "../support/world";

// Step definitions for `auth.feature`. Kept narrow on purpose —
// these steps live or die with the feature next to them. Reusable
// "common" steps (login as <role>, etc.) get their own file later.

When(
  "I visit {string} without a session",
  async function (this: TasWorld, path: string) {
    if (!this.page) throw new Error("Playwright page not initialised");
    // No login step before this — the fresh BrowserContext from
    // Before() carries no cookies, so the request is effectively
    // anonymous.
    await this.page.goto(`${this.baseUrl()}${path}`);
  },
);

Then("I should see the sign-in screen", async function (this: TasWorld) {
  if (!this.page) throw new Error("Playwright page not initialised");
  // We assert on stable text from the sign-in surface rather than a
  // specific selector so a UI refresh doesn't shatter the test.
  // The "Sign in" button copy + Google button label are the
  // longest-standing identifiers.
  await expect(this.page.locator("body")).toContainText(/sign in|google/i);
});

Then(
  "the response should be a not-found page",
  async function (this: TasWorld) {
    if (!this.page) throw new Error("Playwright page not initialised");
    // page.goto() already resolved by the time the Then runs, so
    // there's no in-flight response to wait for. The visible 404
    // marker is the canonical proof — Next.js's default not-found
    // page renders "This page could not be found" + a "404", and a
    // customer's custom not-found.tsx would still carry one of
    // those tokens.
    await expect(this.page.locator("body")).toContainText(/404|not found/i);
  },
);
