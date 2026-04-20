use async_trait::async_trait;
use futures::future::join_all;
use nightshift_core::event::BatchedEvent;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AdapterError {
    #[error("HTTP {status}: {body}")]
    Http { status: u16, body: String },
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("network error: {0}")]
    Network(String),
    #[error("config error: {0}")]
    Config(String),
}

#[async_trait]
pub trait Adapter: Send + Sync {
    fn name(&self) -> &'static str;

    fn accepts(&self, _event: &BatchedEvent) -> bool {
        true
    }

    async fn send(&self, event: &BatchedEvent) -> Result<(), AdapterError>;
}

pub struct AdapterRouter {
    adapters: Vec<Box<dyn Adapter>>,
}

impl AdapterRouter {
    pub fn new(adapters: Vec<Box<dyn Adapter>>) -> Self {
        Self { adapters }
    }

    pub async fn route(&self, events: Vec<BatchedEvent>) {
        let futs: Vec<_> = events
            .iter()
            .flat_map(|event| {
                self.adapters
                    .iter()
                    .filter(|a| a.accepts(event))
                    .map(move |a| a.send(event))
            })
            .collect();

        let results = join_all(futs).await;
        for result in results {
            if let Err(e) = result {
                tracing::error!(error = %e, "adapter fan-out error");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nightshift_core::event::{BatchedEvent, EventContext, EventType};
    use std::sync::{Arc, Mutex};

    struct RecordingAdapter {
        calls: Arc<Mutex<Vec<String>>>,
    }

    #[async_trait]
    impl Adapter for RecordingAdapter {
        fn name(&self) -> &'static str {
            "recording"
        }
        async fn send(&self, event: &BatchedEvent) -> Result<(), AdapterError> {
            self.calls
                .lock()
                .unwrap()
                .push(event.event.clone().unwrap_or_default());
            Ok(())
        }
    }

    struct FailingAdapter;

    #[async_trait]
    impl Adapter for FailingAdapter {
        fn name(&self) -> &'static str {
            "failing"
        }
        async fn send(&self, _event: &BatchedEvent) -> Result<(), AdapterError> {
            Err(AdapterError::Network("always fails".to_string()))
        }
    }

    fn make_event(name: &str) -> BatchedEvent {
        BatchedEvent {
            event_type: EventType::Track,
            event: Some(name.to_string()),
            user_id: None,
            properties: None,
            traits: None,
            error: None,
            context: EventContext {
                viewport: "1x1".to_string(),
                url: "/".to_string(),
                session_id: "anon_test".to_string(),
                app_version: "v1".to_string(),
                timestamp: 0,
                ip: None,
                user_agent: None,
                country: None,
            },
        }
    }

    #[tokio::test]
    async fn routes_to_all_adapters() {
        let calls = Arc::new(Mutex::new(Vec::new()));
        let router = AdapterRouter::new(vec![
            Box::new(RecordingAdapter { calls: calls.clone() }),
            Box::new(RecordingAdapter { calls: calls.clone() }),
        ]);
        router.route(vec![make_event("Click")]).await;
        assert_eq!(calls.lock().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn failing_adapter_does_not_abort_others() {
        let calls = Arc::new(Mutex::new(Vec::new()));
        let router = AdapterRouter::new(vec![
            Box::new(FailingAdapter),
            Box::new(RecordingAdapter { calls: calls.clone() }),
        ]);
        router.route(vec![make_event("Click")]).await;
        assert_eq!(calls.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn accepts_filter_skips_adapter() {
        struct TrackOnlyAdapter {
            calls: Arc<Mutex<Vec<String>>>,
        }

        #[async_trait]
        impl Adapter for TrackOnlyAdapter {
            fn name(&self) -> &'static str {
                "track-only"
            }
            fn accepts(&self, event: &BatchedEvent) -> bool {
                matches!(event.event_type, EventType::Track)
            }
            async fn send(&self, event: &BatchedEvent) -> Result<(), AdapterError> {
                self.calls
                    .lock()
                    .unwrap()
                    .push(event.event.clone().unwrap_or_default());
                Ok(())
            }
        }

        let calls = Arc::new(Mutex::new(Vec::new()));
        let router = AdapterRouter::new(vec![Box::new(TrackOnlyAdapter {
            calls: calls.clone(),
        })]);

        let mut error_event = make_event("oops");
        error_event.event_type = EventType::Error;

        router.route(vec![make_event("Click"), error_event]).await;

        assert_eq!(calls.lock().unwrap().len(), 1);
    }
}
