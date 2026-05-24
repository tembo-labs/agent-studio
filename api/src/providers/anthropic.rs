//! Thin Anthropic Messages API client used by the run task.
//! https://docs.anthropic.com/en/api/messages

use anyhow::{anyhow, Context};
use serde::{Deserialize, Serialize};

const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(Debug, Serialize)]
struct Request<'a> {
    model: &'a str,
    max_tokens: u32,
    system: &'a str,
    messages: Vec<Message<'a>>,
}

#[derive(Debug, Serialize)]
struct Message<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Debug, Deserialize)]
struct Response {
    content: Vec<ContentBlock>,
    stop_reason: Option<String>,
    #[serde(default)]
    usage: Option<UsageBlock>,
}

#[derive(Debug, Deserialize)]
struct UsageBlock {
    input_tokens: i32,
    output_tokens: i32,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ErrorBody {
    error: ErrorDetail,
}

#[derive(Debug, Deserialize)]
struct ErrorDetail {
    #[serde(rename = "type")]
    kind: String,
    message: String,
}

pub struct InvokeArgs<'a> {
    pub model: &'a str,
    pub instructions: &'a str,
    pub user_message: &'a str,
    pub max_tokens: u32,
}

pub struct InvokeResult {
    pub text: String,
    pub stop_reason: Option<String>,
    pub usage: Option<Usage>,
}

#[derive(Debug, Clone, Copy)]
pub struct Usage {
    pub input_tokens: i32,
    pub output_tokens: i32,
}

pub async fn invoke(
    client: &reqwest::Client,
    api_key: &str,
    args: InvokeArgs<'_>,
) -> anyhow::Result<InvokeResult> {
    let body = Request {
        model: args.model,
        max_tokens: args.max_tokens,
        system: args.instructions,
        messages: vec![Message {
            role: "user",
            content: args.user_message,
        }],
    };

    let res = client
        .post(ANTHROPIC_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .context("Anthropic request failed")?;

    let status = res.status();
    if !status.is_success() {
        // Try to surface the API's error.message verbatim — much more
        // useful than the raw status when triaging a failed run.
        let text = res.text().await.unwrap_or_default();
        if let Ok(err) = serde_json::from_str::<ErrorBody>(&text) {
            return Err(anyhow!(
                "Anthropic {} ({}): {}",
                status.as_u16(),
                err.error.kind,
                err.error.message
            ));
        }
        return Err(anyhow!(
            "Anthropic {} returned: {}",
            status.as_u16(),
            text.chars().take(400).collect::<String>()
        ));
    }

    let parsed: Response = res
        .json()
        .await
        .context("Anthropic response was not valid JSON")?;
    let text = parsed
        .content
        .iter()
        .filter(|c| c.kind == "text")
        .filter_map(|c| c.text.clone())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(InvokeResult {
        text,
        stop_reason: parsed.stop_reason,
        usage: parsed.usage.map(|u| Usage {
            input_tokens: u.input_tokens,
            output_tokens: u.output_tokens,
        }),
    })
}
