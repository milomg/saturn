use crate::midi::install_instruments;
use saturn_backend::midi::instruments::to_instrument;
use saturn_backend::midi::note::MidiNote;
use saturn_backend::syscall::{MidiHandler, MidiRequest};
use std::collections::HashSet;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri::{AppHandle, Manager, Wry};

#[derive(Clone)]
pub struct ForwardMidi {
    app: AppHandle<Wry>,
    installed: Arc<Mutex<HashSet<u32>>>,
}

impl ForwardMidi {
    pub fn new(app: AppHandle<Wry>) -> ForwardMidi {
        ForwardMidi {
            app,
            installed: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    async fn install_async(&self, instrument: u32) -> bool {
        let Some(name) = to_instrument(instrument as usize) else {
            return false;
        };
        let instruments = Some(vec![name.into()]);

        let result = install_instruments(None, instruments, &self.app)
            .await
            .is_some();

        if result {
            self.installed.lock().unwrap().insert(instrument);
        }

        result
    }
}

impl MidiHandler for ForwardMidi {
    fn play(&mut self, request: &MidiRequest, sync: bool) {
        let Some(name) = to_instrument(request.instrument as usize) else {
            return;
        };

        self.app
            .emit(
                "play-midi",
                MidiNote {
                    sync,
                    name: name.into(),
                    instrument: request.instrument as u64,
                    note: request.pitch as u64,
                    duration: request.duration as f64 / 1000f64,
                    volume: request.volume as u64,
                },
            )
            .ok();
    }

    fn install(&mut self, instrument: u32) -> Pin<Box<dyn Future<Output = bool> + Send>> {
        let clone = self.clone();

        Box::into_pin(Box::new(async move {
            ForwardMidi::install_async(&clone, instrument).await
        }))
    }

    fn installed(&mut self, instrument: u32) -> bool {
        let mut installed = self.installed.lock().unwrap();

        if installed.contains(&instrument) {
            return true;
        }

        let Some(name) = to_instrument(instrument as usize) else {
            return false;
        };

        let Ok(mut directory) = self.app.path().app_local_data_dir() else {
            return false;
        };

        directory.push(format!("midi/{}-mp3.js", name));

        let result = directory.exists();

        if result {
            installed.insert(instrument);
        }

        result
    }
}
