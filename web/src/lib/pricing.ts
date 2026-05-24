// Rough Anthropic model pricing per 1M tokens. Public list pricing as
// of 2026; surfaced as "approx" in the UI so users know to trust the
// invoice for the authoritative number. Update the table as Anthropic
// publishes new model rates.

type Rate = { input: number; output: number };

// Provider rate tables. Patterns match family identifiers, not
// specific versions — providers re-use the same tier across versions
// inside a family. Update as providers publish new rates.
const ANTHROPIC_RATES: Array<{ pattern: RegExp; rate: Rate }> = [
  { pattern: /claude-opus/i, rate: { input: 15, output: 75 } },
  { pattern: /claude-sonnet/i, rate: { input: 3, output: 15 } },
  { pattern: /claude-haiku/i, rate: { input: 1, output: 5 } },
];

// OpenAI public list pricing per 1M tokens, by model family.
// Source: https://platform.openai.com/docs/pricing
const OPENAI_RATES: Array<{ pattern: RegExp; rate: Rate }> = [
  // GPT-5 family (current premium tier).
  { pattern: /^gpt-5-mini/i, rate: { input: 0.25, output: 2 } },
  { pattern: /^gpt-5-nano/i, rate: { input: 0.05, output: 0.4 } },
  { pattern: /^gpt-5/i, rate: { input: 1.25, output: 10 } },
  // GPT-4o family.
  { pattern: /^gpt-4o-mini/i, rate: { input: 0.15, output: 0.6 } },
  { pattern: /^gpt-4o/i, rate: { input: 2.5, output: 10 } },
  // GPT-4.1 family.
  { pattern: /^gpt-4\.1-nano/i, rate: { input: 0.1, output: 0.4 } },
  { pattern: /^gpt-4\.1-mini/i, rate: { input: 0.4, output: 1.6 } },
  { pattern: /^gpt-4\.1/i, rate: { input: 2, output: 8 } },
  // o-series reasoning.
  { pattern: /^o3-mini/i, rate: { input: 1.1, output: 4.4 } },
  { pattern: /^o3/i, rate: { input: 2, output: 8 } },
];

/**
 * Returns the estimated USD cost of a run, or null if we don't have a
 * pricing entry for the model. Model strings look like
 * `provider:model-name` (e.g. `anthropic:claude-sonnet-4-6`,
 * `openai:gpt-4o-mini`).
 */
export function estimateRunCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
): number | null {
  const tables: Array<{ prefix: string; rates: typeof ANTHROPIC_RATES }> = [
    { prefix: "anthropic:", rates: ANTHROPIC_RATES },
    { prefix: "openai:", rates: OPENAI_RATES },
  ];
  for (const { prefix, rates } of tables) {
    if (!model.startsWith(prefix)) continue;
    const modelName = model.slice(prefix.length);
    const match = rates.find((r) => r.pattern.test(modelName));
    if (!match) return null;
    return (
      (tokensInput * match.rate.input + tokensOutput * match.rate.output) /
      1_000_000
    );
  }
  return null;
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
