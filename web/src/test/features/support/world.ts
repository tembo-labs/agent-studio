import {
  After,
  Before,
  setWorldConstructor,
  World,
  type IWorldOptions,
} from "@cucumber/cucumber";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { closeBddPool, destroySeededUser, type SeededSession } from "./db";

// The Cucumber "World" is the per-scenario state container — every
// step in a scenario sees the same instance. We own the Playwright
// browser/context/page here so step definitions just call
// `this.page.goto(...)` instead of plumbing instances around.
//
// One browser per process, one context+page per scenario. Contexts
// are cheap to create and provide isolation (cookies/storage), so
// scenarios can't leak state into each other.

export class TasWorld extends World {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  /** Set when a Given step plants a session row + cookie. After hook
   *  uses this to cascade-delete the seeded user + member + session
   *  so the dev DB stays clean. */
  seededSession?: SeededSession;

  constructor(options: IWorldOptions) {
    super(options);
  }

  /** Resolves to the canonical base URL for the dev server. Tests
   *  always go through `getPublicOrigin`-equivalent URLs so we
   *  don't accidentally pin a port mapping that changes between
   *  developers. */
  baseUrl(): string {
    return process.env.TAS_TEST_BASE_URL ?? "http://localhost:3000";
  }
}

setWorldConstructor(TasWorld);

// Browser launches once per worker (single-process default in our
// config). Context + page rebuild per scenario for hard isolation.
// Headless by default; flip with HEADLESS=0 when iterating locally.
let browser: Browser | undefined;

Before(async function (this: TasWorld) {
  if (!browser) {
    browser = await chromium.launch({
      headless: process.env.HEADLESS !== "0",
    });
  }
  this.browser = browser;
  this.context = await browser.newContext();
  this.page = await this.context.newPage();
});

After(async function (this: TasWorld) {
  await this.context?.close();
  if (this.seededSession) {
    await destroySeededUser(this.seededSession.userId);
    this.seededSession = undefined;
  }
});

// process.on('exit') would be too late for async cleanup; cucumber
// emits AfterAll for any global teardown. Browser stays alive
// across scenarios in the same run for speed.
import { AfterAll } from "@cucumber/cucumber";
AfterAll(async function () {
  await browser?.close();
  browser = undefined;
  await closeBddPool();
});
