use async_trait::async_trait;
use saturn_backend::syscall::TimeHandler;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::sleep;

pub struct TokioTimeHandler {}

impl TokioTimeHandler {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl TimeHandler for TokioTimeHandler {
    fn time(&self) -> Option<Duration> {
        SystemTime::now().duration_since(UNIX_EPOCH).ok()
    }

    async fn sleep(&self, duration: Duration) {
        sleep(duration).await;
    }
}
