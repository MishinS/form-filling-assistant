use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Model { pub slug: String, pub name: String }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntime { pub base_url: String, pub kind: String, pub models: Vec<Model> }

pub fn parse_ollama_tags(body: &str) -> Vec<Model> {
    #[derive(Deserialize)]
    struct Tag { name: String }
    #[derive(Deserialize)]
    struct Tags { models: Vec<Tag> }
    serde_json::from_str::<Tags>(body)
        .map(|t| t.models.into_iter().map(|m| Model { slug: m.name.clone(), name: m.name }).collect())
        .unwrap_or_default()
}

pub fn parse_openai_models(body: &str) -> Vec<Model> {
    #[derive(Deserialize)]
    struct Item { id: String }
    #[derive(Deserialize)]
    struct List { data: Vec<Item> }
    serde_json::from_str::<List>(body)
        .map(|l| l.data.into_iter().map(|i| Model { slug: i.id.clone(), name: i.id }).collect())
        .unwrap_or_default()
}

async fn try_get(url: &str) -> Option<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(800))
        .build().ok()?;
    let res = client.get(url).send().await.ok()?;
    if !res.status().is_success() { return None; }
    res.text().await.ok()
}

#[tauri::command]
pub async fn detect_local_runtime() -> Option<LocalRuntime> {
    // Ollama (native tags endpoint); chat uses its OpenAI-compatible /v1 base.
    if let Some(body) = try_get("http://127.0.0.1:11434/api/tags").await {
        let models = parse_ollama_tags(&body);
        if !models.is_empty() {
            return Some(LocalRuntime { base_url: "http://127.0.0.1:11434/v1".into(), kind: "ollama".into(), models });
        }
    }
    // LM Studio (already OpenAI-compatible).
    if let Some(body) = try_get("http://127.0.0.1:1234/v1/models").await {
        let models = parse_openai_models(&body);
        if !models.is_empty() {
            return Some(LocalRuntime { base_url: "http://127.0.0.1:1234/v1".into(), kind: "lmstudio".into(), models });
        }
    }
    None
}

pub fn classify_status(status: u16) -> &'static str {
    match status {
        401 | 403 => "auth",
        404 => "model_not_found",
        429 => "rate_limited",
        _ => "provider_error",
    }
}

/// Build the chat-completion request body. No `response_format`: LM Studio's
/// newer server rejects `{type:"json_object"}` with HTTP 400 (it accepts only
/// `json_schema` or `text`), and Ollama's /v1 needs no hint either. The prompt
/// already mandates strict JSON and the webview's parseFields strips envelopes.
pub fn chat_payload(model: &str, prompt: &str) -> serde_json::Value {
    serde_json::json!({
        "model": model,
        "temperature": 0,
        "messages": [{ "role": "user", "content": prompt }],
    })
}

/// Local inference can be slow on CPU-only backends: a ~7k-token prompt on a 3B
/// model (no discrete GPU) measured ~250 s end-to-end. 120 s timed out and
/// surfaced as a spurious `unreachable`/llm-failed. This timeout governs ONLY the
/// local path (`llm_chat`); the cloud path uses its own fetch timeout untouched.
const LOCAL_LLM_TIMEOUT_SECS: u64 = 300;

#[tauri::command]
pub async fn llm_chat(base_url: String, model: String, prompt: String) -> Result<String, String> {
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(LOCAL_LLM_TIMEOUT_SECS))
        .build().map_err(|_| "provider_error".to_string())?;
    let payload = chat_payload(&model, &prompt);
    let res = client.post(&endpoint).json(&payload).send().await
        .map_err(|_| "unreachable".to_string())?;
    if !res.status().is_success() {
        return Err(classify_status(res.status().as_u16()).to_string());
    }
    let body: serde_json::Value = res.json().await.map_err(|_| "bad_response".to_string())?;
    body["choices"][0]["message"]["content"].as_str()
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "bad_response".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ollama_tags() {
        let body = r#"{"models":[{"name":"llama3.1:8b"},{"name":"qwen2.5:7b"}]}"#;
        assert_eq!(parse_ollama_tags(body), vec![
            Model { slug: "llama3.1:8b".into(), name: "llama3.1:8b".into() },
            Model { slug: "qwen2.5:7b".into(), name: "qwen2.5:7b".into() },
        ]);
    }

    #[test]
    fn parses_openai_models() {
        let body = r#"{"data":[{"id":"gemma-3-4b"},{"id":"phi-4"}]}"#;
        assert_eq!(parse_openai_models(body), vec![
            Model { slug: "gemma-3-4b".into(), name: "gemma-3-4b".into() },
            Model { slug: "phi-4".into(), name: "phi-4".into() },
        ]);
    }

    #[test]
    fn bad_json_yields_empty() {
        assert!(parse_ollama_tags("nope").is_empty());
        assert!(parse_openai_models("{}").is_empty());
    }

    #[test]
    fn chat_payload_omits_json_object_response_format() {
        // LM Studio (and json_schema-only OpenAI servers) reject
        // response_format:{type:"json_object"} with HTTP 400. The prompt already
        // mandates strict JSON, so the local payload must not send it.
        let p = chat_payload("qwen2.5-7b-instruct", "extract fields");
        assert_eq!(p["model"], "qwen2.5-7b-instruct");
        assert_eq!(p["temperature"], 0);
        assert_eq!(p["messages"][0]["role"], "user");
        assert_eq!(p["messages"][0]["content"], "extract fields");
        assert_ne!(p["response_format"]["type"], "json_object");
    }

    #[test]
    fn classifies_http_status() {
        assert_eq!(classify_status(401), "auth");
        assert_eq!(classify_status(403), "auth");
        assert_eq!(classify_status(404), "model_not_found");
        assert_eq!(classify_status(429), "rate_limited");
        assert_eq!(classify_status(500), "provider_error");
    }
}
