// Vitest setup — runs once before any test file's imports execute.
//
// Most of our lib/ modules import `server-only`, which throws when
// evaluated outside a Next.js server context. Vitest's "node"
// environment isn't one, so the import fails before any test code
// runs. We stub the module to a no-op so test files can import
// production code as-is without sprinkling skip markers everywhere.
//
// This shim is *only* about module-evaluation safety. It does NOT
// weaken the production guarantee — Next.js still enforces
// server-only at build time on the real `server-only` package.

import { vi } from "vitest";

vi.mock("server-only", () => ({}));
