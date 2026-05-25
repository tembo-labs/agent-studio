// Cron helpers shared by the automations form (preview), the
// automations list page (next-fire column), and the scheduler tick.
// Single source of truth so a cron string the form accepts is one
// the scheduler will evaluate identically.
//
// We use cron-parser (5-field cron, no seconds field) and cronstrue
// for the human readable summary. Schedules are always interpreted
// in UTC — see migration 0015 for the rationale.

import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";

export type CronValidation =
  | { ok: true; humanReadable: string; nextFire: Date }
  | { ok: false; error: string };

export function validateCron(expr: string): CronValidation {
  const trimmed = expr.trim();
  if (!trimmed) return { ok: false, error: "Cron expression is required." };
  try {
    const it = CronExpressionParser.parse(trimmed, { tz: "UTC" });
    const next = it.next().toDate();
    const human = cronstrue.toString(trimmed, { use24HourTimeFormat: true });
    return { ok: true, humanReadable: human, nextFire: next };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// Returns the next fire instant at or after `after`, or null if the
// cron expression is malformed (scheduler should record an error).
export function nextFireAfter(expr: string, after: Date): Date | null {
  try {
    const it = CronExpressionParser.parse(expr.trim(), {
      tz: "UTC",
      currentDate: after,
    });
    return it.next().toDate();
  } catch {
    return null;
  }
}

// True if the cron has any firing in the half-open window (after, now].
// Used by the scheduler to decide "is a firing due?" without iterating
// every cron step manually.
export function hasFiringInWindow(
  expr: string,
  after: Date,
  now: Date,
): boolean {
  const next = nextFireAfter(expr, after);
  if (!next) return false;
  return next.getTime() <= now.getTime();
}
