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
        rate("claude-opus", 15.0, 75.0),
        rate("claude-sonnet", 3.0, 15.0),
        rate("claude-haiku", 1.0, 5.0),
    ]
});

static OPENAI_RATES: Lazy<Vec<ModelRate>> = Lazy::new(|| {
    vec![
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

/// Returns USD cost for a run, or None if the model isn't in our
/// pricing tables (callers persist None which renders as "—" in
/// the UI). Model strings look like `provider:model-name` —
/// matching the same shape the TS-side helper consumes.
pub fn estimate_run_cost(
    model: &str,
    tokens_input: i32,
    tokens_output: i32,
) -> Option<f64> {
    let (prefix, rates): (&str, &Lazy<Vec<ModelRate>>) =
        if let Some(rest) = model.strip_prefix("anthropic:") {
            return cost_in_table(rest, tokens_input, tokens_output, &ANTHROPIC_RATES);
        } else if let Some(rest) = model.strip_prefix("openai:") {
            return cost_in_table(rest, tokens_input, tokens_output, &OPENAI_RATES);
        } else {
            ("", &ANTHROPIC_RATES)
        };
    // Defensive default in case the early returns above don't catch
    // — `prefix` left unused signals to the reader the function is
    // shape-driven, not fall-through.
    let _ = (prefix, rates);
    None
}

fn cost_in_table(
    model_name: &str,
    tokens_input: i32,
    tokens_output: i32,
    table: &Lazy<Vec<ModelRate>>,
) -> Option<f64> {
    let entry = table.iter().find(|r| r.pattern.is_match(model_name))?;
    let cost = (tokens_input as f64 * entry.input_per_million
        + tokens_output as f64 * entry.output_per_million)
        / 1_000_000.0;
    Some(cost)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anthropic_sonnet() {
        let c = estimate_run_cost("anthropic:claude-sonnet-4-6", 1_000_000, 1_000_000)
            .expect("priced");
        // 3 + 15 = 18 USD for 1M in + 1M out
        assert!((c - 18.0).abs() < 1e-9, "expected ~18.0, got {c}");
    }

    #[test]
    fn openai_gpt_4o_mini() {
        let c = estimate_run_cost("openai:gpt-4o-mini", 1_000_000, 1_000_000)
            .expect("priced");
        // 0.15 + 0.6 = 0.75
        assert!((c - 0.75).abs() < 1e-9, "expected ~0.75, got {c}");
    }

    #[test]
    fn unknown_model_returns_none() {
        assert!(estimate_run_cost("custom:no-such-model", 100, 100).is_none());
    }

    #[test]
    fn unknown_provider_returns_none() {
        assert!(estimate_run_cost("cohere:command", 100, 100).is_none());
    }
}
