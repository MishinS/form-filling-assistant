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
}
