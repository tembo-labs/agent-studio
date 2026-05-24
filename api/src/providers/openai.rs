//! Thin OpenAI Chat Completions API client used by the run task.
//! https://platform.openai.com/docs/api-reference/chat
//!
//! Mirrors anthropic.rs in shape so the runner's dispatch in
//! `runner.rs` stays uniform — both providers expose `invoke()`
//! returning an `InvokeResult { text, stop_reason, usage }`.

use anyhow::{anyhow, Context};
use serde::{Deserialize, Serialize};

const OPENAI_URL: &str = "https://api.openai.com/v1/chat/completions";

#[derive(Debug, Serialize)]
struct Request<'a> {
    model: &'a str,
    messages: Vec<Message<'a>>,
    max_tokens: u32,
}

#[derive(Debug, Serialize)]
struct Message<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Debug, Deserialize)]
struct Response {
    choices: Vec<Choice>,
    #[serde(default)]
    usage: Option<UsageBlock>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ChoiceMessage,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChoiceMessage {
    #[serde(default)]
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsageBlock {
    prompt_tokens: i32,
    completion_tokens: i32,
}

#[derive(Debug, Deserialize)]
struct ErrorBody {
    error: ErrorDetail,
}

#[derive(Debug, Deserialize)]
struct ErrorDetail {
    #[serde(rename = "type", default)]
    kind: Option<String>,
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
        // OpenAI takes the system prompt as a `system` role message,
        // not a top-level field. Order matters: system first, user
        // second, so the model treats instructions as the rubric and
        // the user input as the prompt to act on.
        messages: vec![
            Message {
                role: "system",
                content: args.instructions,
            },
            Message {
                role: "user",
                content: args.user_message,
            },
        ],
    };

    let res = client
        .post(OPENAI_URL)
        .bearer_auth(api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .context("OpenAI request failed")?;

    let status = res.status();
    if !status.is_success() {
        let text = res.text().await.unwrap_or_default();
        if let Ok(err) = serde_json::from_str::<ErrorBody>(&text) {
            return Err(anyhow!(
                "OpenAI {} ({}): {}",
                status.as_u16(),
                err.error.kind.as_deref().unwrap_or("error"),
                err.error.message
            ));
        }
        return Err(anyhow!(
            "OpenAI {} returned: {}",
            status.as_u16(),
            text.chars().take(400).collect::<String>()
        ));
    }

    let parsed: Response = res
        .json()
        .await
        .context("OpenAI response was not valid JSON")?;

    let first = parsed
        .choices
        .first()
        .ok_or_else(|| anyhow!("OpenAI response had no choices"))?;
    let text = first.message.content.clone().unwrap_or_default();
    let stop_reason = first.finish_reason.clone();

    Ok(InvokeResult {
        text,
        stop_reason,
        usage: parsed.usage.map(|u| Usage {
            input_tokens: u.prompt_tokens,
            output_tokens: u.completion_tokens,
        }),
    })
}
