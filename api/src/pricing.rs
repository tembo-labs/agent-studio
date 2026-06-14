//! Per-million-token list pricing for the Anthropic + OpenAI model
//! families we support. Mirrors web/src/lib/pricing.ts — keep the
//! tables in lockstep when adding a new provider/family.
//!
//! Estimates only — the authoritative number is whatever each
//! provider invoices. The UI surfaces this as "approx" so the user
//! knows to trust their bill for the real number.

use once_cell::sync::Lazy;
use regex::Regex;

struct ModelRate {
    pattern: Regex,
    input_per_million: f64,
    output_per_million: f64,
}

static ANTHROPIC_RATES: Lazy<Vec<ModelRate>> = Lazy::new(|| {
    vec![
        // Fable 5 (Mythos-class) — premium tier, $10/$50 per MTok (GA 2026-06-09).
        rate("claude-fable", 10.0, 50.0),
        // Current Opus (4.5–4.8) is $5/$25; only the deprecated 4.1/4.0 were
        // $15/$75 and they retire mid-2026 — not worth special-casing.
        rate("claude-opus", 5.0, 25.0),
        rate("claude-sonnet", 3.0, 15.0),
        rate("claude-haiku", 1.0, 5.0),
    ]
});

static OPENAI_RATES: Lazy<Vec<ModelRate>> = Lazy::new(|| {
    vec![
        // GPT-5.x — specific patterns before the bare `^gpt-5` catch-all so it
        // doesn't swallow the 5.x variants. 5.5/5.4 are the current flagships.
        rate("^gpt-5\\.5", 5.0, 30.0),
        rate("^gpt-5\\.4-mini", 0.75, 4.5),
        rate("^gpt-5\\.4-nano", 0.2, 1.25),
        rate("^gpt-5\\.4", 2.5, 15.0),
        rate("^gpt-5\\.2", 0.875, 7.0),
        rate("^gpt-5\\.1", 0.625, 5.0),
        rate("^gpt-5-mini", 0.25, 2.0),
        rate("^gpt-5-nano", 0.05, 0.4),
        rate("^gpt-5", 1.25, 10.0),
        rate("^gpt-4o-mini", 0.15, 0.6),
        rate("^gpt-4o", 2.5, 10.0),
        rate("^gpt-4\\.1-nano", 0.1, 0.4),
        rate("^gpt-4\\.1-mini", 0.4, 1.6),
        rate("^gpt-4\\.1", 2.0, 8.0),
        rate("^o3-mini", 1.1, 4.4),
        rate("^o3", 2.0, 8.0),
    ]
});

fn rate(pattern: &str, input: f64, output: f64) -> ModelRate {
    ModelRate {
        // The web-side table is case-insensitive (`/…/i`); mirror that.
        pattern: Regex::new(&format!("(?i){pattern}"))
            .expect("invalid hard-coded model pricing regex"),
        input_per_million: input,
        output_per_million: output,
    }
}

// Prompt-cache multipliers on the base INPUT rate. Anthropic bills cache
// writes (creation) at 1.25x and cache reads at 0.1x of input. `tokens_input`
// is the uncached input (full rate); cache halves are counted separately and
// never overlap it. OpenAI/others that don't report cache tokens pass 0 here,
// so the multipliers are a no-op for them.
const CACHE_READ_MULTIPLIER: f64 = 0.1;
const CACHE_WRITE_MULTIPLIER: f64 = 1.25;

/// Returns USD cost for a run, or None if the model isn't in our
/// pricing tables (callers persist None which renders as "—" in
/// the UI). Model strings look like `provider:model-name` —
/// matching the same shape the TS-side helper consumes.
/// `cache_read`/`cache_write` are the Anthropic prompt-cache token counts
/// (0 when caching is off).
pub fn estimate_run_cost(
    model: &str,
    tokens_input: i32,
    tokens_output: i32,
    cache_read: i32,
    cache_write: i32,
) -> Option<f64> {
    if let Some(rest) = model.strip_prefix("anthropic:") {
        cost_in_table(rest, tokens_input, tokens_output, cache_read, cache_write, &ANTHROPIC_RATES)
    } else if let Some(rest) = model.strip_prefix("openai:") {
        cost_in_table(rest, tokens_input, tokens_output, cache_read, cache_write, &OPENAI_RATES)
    } else {
        None
    }
}

fn cost_in_table(
    model_name: &str,
    tokens_input: i32,
    tokens_output: i32,
    cache_read: i32,
    cache_write: i32,
    table: &Lazy<Vec<ModelRate>>,
) -> Option<f64> {
    let entry = table.iter().find(|r| r.pattern.is_match(model_name))?;
    let input_cost = (tokens_input as f64
        + cache_read as f64 * CACHE_READ_MULTIPLIER
        + cache_write as f64 * CACHE_WRITE_MULTIPLIER)
        * entry.input_per_million;
    let cost = (input_cost + tokens_output as f64 * entry.output_per_million) / 1_000_000.0;
    Some(cost)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anthropic_sonnet() {
        let c =
            estimate_run_cost("anthropic:claude-sonnet-4-6", 1_000_000, 1_000_000, 0, 0).expect("priced");
        // 3 + 15 = 18 USD for 1M in + 1M out
        assert!((c - 18.0).abs() < 1e-9, "expected ~18.0, got {c}");
    }

    #[test]
    fn anthropic_opus() {
        let c =
            estimate_run_cost("anthropic:claude-opus-4-8", 1_000_000, 1_000_000, 0, 0).expect("priced");
        // 5 + 25 = 30 USD for 1M in + 1M out
        assert!((c - 30.0).abs() < 1e-9, "expected ~30.0, got {c}");
    }

    #[test]
    fn anthropic_fable_5() {
        let c =
            estimate_run_cost("anthropic:claude-fable-5", 1_000_000, 1_000_000, 0, 0).expect("priced");
        // 10 + 50 = 60 USD for 1M in + 1M out
        assert!((c - 60.0).abs() < 1e-9, "expected ~60.0, got {c}");
    }

    #[test]
    fn openai_gpt_4o_mini() {
        let c = estimate_run_cost("openai:gpt-4o-mini", 1_000_000, 1_000_000, 0, 0).expect("priced");
        // 0.15 + 0.6 = 0.75
        assert!((c - 0.75).abs() < 1e-9, "expected ~0.75, got {c}");
    }

    #[test]
    fn openai_gpt_5_5_not_swallowed_by_catch_all() {
        // gpt-5.5 must hit its own $5/$30 rate, not the bare ^gpt-5 ($1.25/$10).
        let c = estimate_run_cost("openai:gpt-5.5", 1_000_000, 1_000_000, 0, 0).expect("priced");
        // 5 + 30 = 35
        assert!((c - 35.0).abs() < 1e-9, "expected ~35.0, got {c}");
    }

    #[test]
    fn openai_gpt_5_base() {
        let c = estimate_run_cost("openai:gpt-5", 1_000_000, 1_000_000, 0, 0).expect("priced");
        // 1.25 + 10 = 11.25
        assert!((c - 11.25).abs() < 1e-9, "expected ~11.25, got {c}");
    }

    #[test]
    fn anthropic_cache_tokens_priced_at_read_write_multipliers() {
        // Opus input $5/MTok. 1M cache_read @ 0.1x = $0.50; 1M cache_write @
        // 1.25x = $6.25; 1M uncached input @ 1x = $5; no output.
        let c = estimate_run_cost(
            "anthropic:claude-opus-4-8",
            1_000_000,
            0,
            1_000_000,
            1_000_000,
        )
        .expect("priced");
        assert!((c - (5.0 + 0.5 + 6.25)).abs() < 1e-9, "expected ~11.75, got {c}");
    }

    #[test]
    fn unknown_model_returns_none() {
        assert!(estimate_run_cost("custom:no-such-model", 100, 100, 0, 0).is_none());
    }

    #[test]
    fn unknown_provider_returns_none() {
        assert!(estimate_run_cost("cohere:command", 100, 100, 0, 0).is_none());
    }
}
