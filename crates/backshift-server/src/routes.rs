use std::sync::Arc;

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use backshift_core::{
    dedup::{DedupCache, dedup_key},
    event::IngestBatch,
    pii::sanitize_event,
};
use backshift_adapters::adapter::AdapterRouter;
use tokio::sync::Mutex;
use tracing::warn;

pub struct AppState {
    pub router: Arc<AdapterRouter>,
    pub dedup: Arc<Mutex<Box<dyn DedupCache>>>,
}

pub async fn ingest_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<IngestBatch>,
) -> impl IntoResponse {
    if body.batch.is_empty() {
        return StatusCode::BAD_REQUEST;
    }

    let ip = extract_ip(&headers);
    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);

    let mut dedup = state.dedup.lock().await;

    // Enrich, dedup, and sanitize events
    let events: Vec<_> = body
        .batch
        .into_iter()
        .map(|mut event| {
            event.context.ip = ip.clone();
            event.context.user_agent = user_agent.clone();
            event
        })
        .filter(|event| {
            let key = dedup_key(event);
            let dup = dedup.is_duplicate(&key);
            if dup {
                warn!(session_id = %event.context.session_id, "duplicate event dropped");
            }
            !dup
        })
        .map(sanitize_event)
        .collect();

    drop(dedup);

    if !events.is_empty() {
        let router = state.router.clone();
        tokio::spawn(async move {
            router.route(events).await;
        });
    }

    StatusCode::NO_CONTENT
}

pub async fn health_handler() -> impl IntoResponse {
    StatusCode::OK
}

fn extract_ip(headers: &HeaderMap) -> Option<String> {
    // Cloudflare → standard proxy chain
    for header in &["CF-Connecting-IP", "X-Real-IP", "X-Forwarded-For"] {
        if let Some(val) = headers.get(*header).and_then(|v| v.to_str().ok()) {
            // X-Forwarded-For may be comma-separated; take the first (leftmost = client)
            return Some(val.split(',').next().unwrap_or(val).trim().to_owned());
        }
    }
    None
}
