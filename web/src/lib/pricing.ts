// Rough Anthropic model pricing per 1M tokens. Public list pricing as
// of 2026; surfaced as "approx" in the UI so users know to trust the
// invoice for the authoritative number. Update the table as Anthropic
// publishes new model rates.

type Rate = { input: number; output: number };

// Anthropic public list pricing per 1M tokens, by model family.
// Patterns match the family, not a specific version — Anthropic re-uses
// the same tier across versions inside a family. Update as Anthropic
// publishes new rates.
const ANTHROPIC_RATES: Array<{ pattern: RegExp; rate: Rate }> = [
  { pattern: /claude-opus/i, rate: { input: 15, output: 75 } },
  { pattern: /claude-sonnet/i, rate: { input: 3, output: 15 } },
  { pattern: /claude-haiku/i, rate: { input: 1, output: 5 } },
];

/**
 * Returns the estimated USD cost of a run, or null if we don't have a
 * pricing entry for the model. Model strings look like
 * `provider:model-name` (e.g. `anthropic:claude-sonnet-4-6`).
 */
export function estimateRunCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
): number | null {
  if (!model.startsWith("anthropic:")) return null;
  const modelName = model.slice("anthropic:".length);
  const match = ANTHROPIC_RATES.find((r) => r.pattern.test(modelName));
  if (!match) return null;
  return (
    (tokensInput * match.rate.input + tokensOutput * match.rate.output) /
    1_000_000
  );
}

export function formatTokens(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatCurrency(usd: number): string {
  // Sub-cent values aren't useful at this UI level; floor to two
  // decimals but bump to three when the cost is below $0.01 so users
  // see something other than "$0.00".
  const decimals = usd < 0.01 ? 4 : usd < 1 ? 3 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(usd);
}
