use nightshift_server::{build_app, config::EdgeConfig};
use tracing::info;
use tracing_subscriber::{EnvFilter, fmt};

#[tokio::main]
async fn main() {
    fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("nightshift=info".parse().unwrap()),
        )
        .json()
        .init();

    let config = EdgeConfig::from_env();
    let port = config.port;
    let app = build_app(config);

    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    info!(address = %addr, "nightshift-server listening");
    axum::serve(listener, app).await.unwrap();
}
