use async_trait::async_trait;
use nightshift_core::event::BatchedEvent;
use serde_json;

use crate::adapter::{Adapter, AdapterError};

pub struct WebhookAdapter {
    url: String,
    /// Optional (header-name, value) pair sent with every request
    secret_header: Option<(String, String)>,
    client: reqwest::Client,
}

impl WebhookAdapter {
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            secret_header: None,
            client: reqwest::Client::new(),
        }
    }

    pub fn with_secret(mut self, header: impl Into<String>, value: impl Into<String>) -> Self {
        self.secret_header = Some((header.into(), value.into()));
        self
    }
}

#[async_trait]
impl Adapter for WebhookAdapter {
    fn name(&self) -> &'static str {
        "webhook"
    }

    async fn send(&self, event: &BatchedEvent) -> Result<(), AdapterError> {
        let body = serde_json::to_string(event).map_err(AdapterError::Serialization)?;
        let mut req = self
            .client
            .post(&self.url)
            .header("Content-Type", "application/json")
            .body(body);

        if let Some((name, value)) = &self.secret_header {
            req = req.header(name.as_str(), value.as_str());
        }

        let resp = req
            .send()
            .await
            .map_err(|e| AdapterError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(AdapterError::Http { status, body });
        }
        Ok(())
    }
}
