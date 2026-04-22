use async_trait::async_trait;
use backshift_core::event::{BatchedEvent, EventType};
use serde::Serialize;

use crate::adapter::{Adapter, AdapterError};

const GA4_ENDPOINT: &str = "https://www.google-analytics.com/mp/collect";
const GA4_DEBUG_ENDPOINT: &str = "https://www.google-analytics.com/debug/mp/collect";

pub struct Ga4Adapter {
    measurement_id: String,
    api_secret: String,
    debug: bool,
    client: reqwest::Client,
}

impl Ga4Adapter {
    pub fn new(measurement_id: impl Into<String>, api_secret: impl Into<String>) -> Self {
        Self {
            measurement_id: measurement_id.into(),
            api_secret: api_secret.into(),
            debug: false,
            client: reqwest::Client::new(),
        }
    }

    /// Use the GA4 debug endpoint (shows validation errors in response).
    pub fn with_debug(mut self) -> Self {
        self.debug = true;
        self
    }
}

#[derive(Serialize)]
struct Ga4Payload {
    client_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_id: Option<String>,
    events: Vec<Ga4Event>,
}

#[derive(Serialize)]
struct Ga4Event {
    name: String,
    params: serde_json::Value,
}

fn normalize_event_name(name: &str) -> String {
    // GA4 event names must be alphanumeric + underscore, max 40 chars
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '_' })
        .take(40)
        .collect()
}

#[async_trait]
impl Adapter for Ga4Adapter {
    fn name(&self) -> &'static str {
        "ga4"
    }

    fn accepts(&self, event: &BatchedEvent) -> bool {
        matches!(event.event_type, EventType::Track | EventType::Error)
    }

    async fn send(&self, event: &BatchedEvent) -> Result<(), AdapterError> {
        let event_name = match event.event_type {
            EventType::Error => "exception".to_string(),
            _ => normalize_event_name(event.event.as_deref().unwrap_or("unknown_event")),
        };

        let mut params = event
            .properties
            .clone()
            .unwrap_or(serde_json::Value::Object(Default::default()));

        if let EventType::Error = event.event_type {
            if let Some(err) = &event.error {
                if let serde_json::Value::Object(ref mut m) = params {
                    m.insert(
                        "description".to_string(),
                        serde_json::Value::String(err.message.clone()),
                    );
                    m.insert("fatal".to_string(), serde_json::Value::Bool(false));
                }
            }
        }

        // Append engagement time (required by GA4 Measurement Protocol)
        if let serde_json::Value::Object(ref mut m) = params {
            m.insert(
                "engagement_time_msec".to_string(),
                serde_json::Value::Number(1.into()),
            );
        }

        let payload = Ga4Payload {
            client_id: event.context.session_id.clone(),
            user_id: event.user_id.clone(),
            events: vec![Ga4Event { name: event_name, params }],
        };

        let base = if self.debug { GA4_DEBUG_ENDPOINT } else { GA4_ENDPOINT };
        let url = format!(
            "{}?measurement_id={}&api_secret={}",
            base, self.measurement_id, self.api_secret
        );

        let resp = self
            .client
            .post(&url)
            .json(&payload)
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
