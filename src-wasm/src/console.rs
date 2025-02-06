use crate::EventHandler;
use saturn_backend::syscall::ConsoleHandler;
use std::sync::Arc;

pub struct WasmConsole {
    pub events: Arc<EventHandler>,
}

impl ConsoleHandler for WasmConsole {
    fn print(&mut self, text: &str, error: bool) {
        self.events.send_console_write(text, error)
    }
}
