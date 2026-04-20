pub mod config;
pub mod routes;

use std::sync::Arc;

use axum::{Router, routing::get, routing::post};
use nightshift_adapters::{
    adapter::AdapterRouter,
    ga4::Ga4Adapter,
    mixpanel::MixpanelAdapter,
    posthog::PostHogAdapter,
    sentry::SentryAdapter,
    webhook::WebhookAdapter,
};
use nightshift_core::dedup::InMemoryDedupCache;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{info, warn};

use crate::config::EdgeConfig;
use crate::routes::{AppState, health_handler, ingest_handler};

pub fn build_app(config: EdgeConfig) -> Router {
    let mut adapters: Vec<Box<dyn nightshift_adapters::adapter::Adapter>> = Vec::new();

    if let (Some(mid), Some(secret)) = (&config.ga4_measurement_id, &config.ga4_api_secret) {
        let mut adapter = Ga4Adapter::new(mid, secret);
        if config.debug {
            adapter = adapter.with_debug();
        }
        adapters.push(Box::new(adapter));
        info!("GA4 adapter enabled");
    }

    if let Some(url) = &config.webhook_url {
        let mut adapter = WebhookAdapter::new(url);
        if let Some(secret) = &config.webhook_secret {
            adapter = adapter.with_secret("X-Webhook-Secret", secret);
        }
        adapters.push(Box::new(adapter));
        info!("Webhook adapter enabled");
    }

    if let Some(dsn) = &config.sentry_dsn {
        match SentryAdapter::new(dsn) {
            Ok(mut adapter) => {
                if let Some(r) = &config.sentry_release {
                    adapter = adapter.with_release(r);
                }
                if let Some(e) = &config.sentry_environment {
                    adapter = adapter.with_environment(e);
                }
                adapters.push(Box::new(adapter));
                info!("Sentry adapter enabled");
            }
            Err(e) => warn!(error = %e, "Sentry adapter disabled — invalid DSN"),
        }
    }

    if let Some(token) = &config.mixpanel_token {
        adapters.push(Box::new(MixpanelAdapter::new(token)));
        info!("Mixpanel adapter enabled");
    }

    if let Some(key) = &config.posthog_api_key {
        let mut adapter = PostHogAdapter::new(key);
        if let Some(endpoint) = &config.posthog_endpoint {
            adapter = adapter.with_endpoint(endpoint);
        }
        adapters.push(Box::new(adapter));
        info!("PostHog adapter enabled");
    }

    let state = Arc::new(AppState {
        router: Arc::new(AdapterRouter::new(adapters)),
        dedup: Arc::new(Mutex::new(
            Box::new(InMemoryDedupCache::new(config.dedup_ttl_secs))
                as Box<dyn nightshift_core::dedup::DedupCache>,
        )),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/ingest", post(ingest_handler))
        .route("/health", get(health_handler))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
