use nightshift_adapters::{
    adapter::AdapterRouter,
    ga4::Ga4Adapter,
    mixpanel::MixpanelAdapter,
    posthog::PostHogAdapter,
    sentry::SentryAdapter,
    webhook::WebhookAdapter,
};
use nightshift_core::{
    dedup::{DedupCache, InMemoryDedupCache, dedup_key},
    event::IngestBatch,
    pii::sanitize_event,
};
use std::sync::Mutex;
use worker::*;

/// Builds the AdapterRouter from Cloudflare Worker environment bindings.
/// Each adapter is enabled only if its required secrets are present.
fn build_router(env: &Env) -> AdapterRouter {
    let mut adapters: Vec<Box<dyn nightshift_adapters::adapter::Adapter>> = Vec::new();

    if let (Ok(mid), Ok(secret)) = (env.var("GA4_MEASUREMENT_ID"), env.var("GA4_API_SECRET")) {
        adapters.push(Box::new(Ga4Adapter::new(mid.to_string(), secret.to_string())));
    }

    if let Ok(url) = env.var("WEBHOOK_URL") {
        let mut adapter = WebhookAdapter::new(url.to_string());
        if let Ok(s) = env.var("WEBHOOK_SECRET") {
            adapter = adapter.with_secret("X-Webhook-Secret", s.to_string());
        }
        adapters.push(Box::new(adapter));
    }

    if let Ok(dsn) = env.var("SENTRY_DSN") {
        if let Ok(mut adapter) = SentryAdapter::new(&dsn.to_string()) {
            if let Ok(r) = env.var("SENTRY_RELEASE") {
                adapter = adapter.with_release(r.to_string());
            }
            if let Ok(e) = env.var("SENTRY_ENVIRONMENT") {
                adapter = adapter.with_environment(e.to_string());
            }
            adapters.push(Box::new(adapter));
        }
    }

    if let Ok(token) = env.var("MIXPANEL_TOKEN") {
        adapters.push(Box::new(MixpanelAdapter::new(token.to_string())));
    }

    if let Ok(key) = env.var("POSTHOG_API_KEY") {
        let mut adapter = PostHogAdapter::new(key.to_string());
        if let Ok(endpoint) = env.var("POSTHOG_ENDPOINT") {
            adapter = adapter.with_endpoint(endpoint.to_string());
        }
        adapters.push(Box::new(adapter));
    }

    AdapterRouter::new(adapters)
}

#[event(fetch)]
async fn main(mut req: Request, env: Env, _ctx: Context) -> Result<Response> {
    // CORS preflight
    if req.method() == Method::Options {
        return Response::empty()
            .map(|r| r.with_headers(cors_headers()));
    }

    if req.path() == "/health" && req.method() == Method::Get {
        return Response::ok("ok");
    }

    if req.path() != "/ingest" || req.method() != Method::Post {
        return Response::error("Not Found", 404);
    }

    let body: IngestBatch = match req.json().await {
        Ok(b) => b,
        Err(_) => return Response::error("Bad Request", 400),
    };

    if body.batch.is_empty() {
        return Response::error("Bad Request", 400);
    }

    // Extract client IP from Cloudflare-injected header
    let ip = req
        .headers()
        .get("CF-Connecting-IP")
        .ok()
        .flatten();
    let user_agent = req
        .headers()
        .get("User-Agent")
        .ok()
        .flatten();
    let country = req
        .headers()
        .get("CF-IPCountry")
        .ok()
        .flatten();

    // Dedup — use a request-scoped cache (Workers are stateless; for true cross-request
    // dedup deploy a Durable Object or KV, but per-request is still useful for batch duplicates)
    let mut dedup = InMemoryDedupCache::new(5);

    let events: Vec<_> = body
        .batch
        .into_iter()
        .map(|mut event| {
            event.context.ip = ip.clone();
            event.context.user_agent = user_agent.clone();
            event.context.country = country.clone();
            event
        })
        .filter(|event| !dedup.is_duplicate(&dedup_key(event)))
        .map(sanitize_event)
        .collect();

    if !events.is_empty() {
        let router = build_router(&env);
        router.route(events).await;
    }

    Response::empty()
        .map(|r| r.with_status(204).with_headers(cors_headers()))
}

fn cors_headers() -> Headers {
    let mut headers = Headers::new();
    let _ = headers.set("Access-Control-Allow-Origin", "*");
    let _ = headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    let _ = headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers
}
