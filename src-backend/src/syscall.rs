use crate::channels::ByteChannel;
use crate::channels::ByteChannelConsumption::{ConsumeAndContinue, ConsumeAndStop, IgnoreAndStop};
use crate::syscall::SyscallResult::{
    Aborted, Completed, Exception, Failure, Terminated, Unimplemented, Unknown,
};
use async_trait::async_trait;
use futures::channel::oneshot;
use futures::future::FusedFuture;
use futures::{select, FutureExt};
use rand::Rng;
use rand_chacha::rand_core::SeedableRng;
use rand_chacha::ChaCha8Rng;
use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::future::Future;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::pin::{pin, Pin};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use titan::cpu::error::Error;
use titan::cpu::error::Error::{CpuSyscall, CpuTrap};
use titan::cpu::state::Registers;
use titan::cpu::Memory;
use titan::execution::executor::DebugFrame;
use titan::execution::executor::ExecutorMode::Invalid;
use titan::execution::trackers::Tracker;
use titan::execution::Executor;

pub struct MidiRequest {
    pub pitch: u32,      // 0 - 127
    pub duration: u32,   // in ms
    pub instrument: u32, // 0 - 127
    pub volume: u32,     // 0 - 127
}

#[derive(Debug)]
pub enum SyscallResult {
    Completed,          // Syscall completed successfully.
    Failure(String),    // Failed to complete with message.
    Terminated(u32),    // User asked process to be terminated!
    Aborted,            // User paused/stopped/asked the program to stop ASAP.
    Unimplemented(u32), // User executed a recognized syscall that is not implemented yet.
    Unknown(u32),       // User executed a totally unknown syscall.
    Exception(Error),   // Some Memory/CPU error should be reported.
}

pub trait ConsoleHandler {
    fn print(&mut self, text: &str, error: bool);
}

pub trait MidiHandler {
    fn play(&mut self, request: &MidiRequest, sync: bool);
    fn install(&mut self, instrument: u32) -> Pin<Box<dyn Future<Output = bool> + Send>>;
    fn installed(&mut self, instrument: u32) -> bool;
}

#[async_trait]
pub trait TimeHandler {
    fn time(&self) -> Option<Duration>;
    async fn sleep(&self, duration: Duration);
}

// Sync problems probably require something like this.
pub enum CancelToken {
    None,
    Cancelled,
    Token(oneshot::Sender<()>),
}

pub struct SyscallState {
    pub cancel_token: CancelToken,
    pub input_buffer: Arc<ByteChannel>,
    pub sync_wake: Option<oneshot::Sender<()>>,
    current_directory: Option<String>, // for filesystem requests
    heap_start: u32,
    console: Box<dyn ConsoleHandler + Send + Sync>,
    midi: Box<dyn MidiHandler + Send + Sync>,
    time: Arc<dyn TimeHandler + Send + Sync>,
    generators: HashMap<u32, ChaCha8Rng>,
    next_file: u32,
    file_map: HashMap<u32, File>,
}

impl SyscallState {
    pub fn new(
        console: Box<dyn ConsoleHandler + Send + Sync>,
        midi: Box<dyn MidiHandler + Send + Sync>,
        time: Arc<dyn TimeHandler + Send + Sync>,
        current_directory: Option<String>,
    ) -> SyscallState {
        SyscallState {
            cancel_token: CancelToken::None,
            input_buffer: Arc::new(ByteChannel::default()),
            sync_wake: None,
            heap_start: 0x20000000,
            current_directory,
            console,
            midi,
            time,
            generators: HashMap::from([(0, ChaCha8Rng::from_entropy())]),
            next_file: 3,
            file_map: HashMap::new(),
        }
    }

    pub fn clear_cancelled(&mut self) {
        self.cancel_token = CancelToken::None
    }

    pub fn grab_cancel(&mut self) -> Option<oneshot::Receiver<()>> {
        if let CancelToken::Cancelled = self.cancel_token {
            None
        } else {
            let (sender, receiver) = oneshot::channel();

            self.cancel_token = CancelToken::Token(sender);

            Some(receiver)
        }
    }

    pub fn cancel(&mut self) {
        let token = std::mem::replace(&mut self.cancel_token, CancelToken::Cancelled);

        if let CancelToken::Token(token) = token {
            token.send(()).ok();
        }
    }
}

pub struct SyscallDelegate {
    pub state: Arc<Mutex<SyscallState>>,
}

fn reg<Mem: Memory, Track: Tracker<Mem>>(debugger: &Executor<Mem, Track>, index: usize) -> u32 {
    debugger.with_state(|s| s.registers.line[index])
}

const V0_REG: usize = 2;
const A0_REG: usize = 4;
const A1_REG: usize = 5;
const A2_REG: usize = 6;
const A3_REG: usize = 7;

fn a0<Mem: Memory, Track: Tracker<Mem>>(state: &Executor<Mem, Track>) -> u32 {
    reg(state, A0_REG)
}

fn midi_request(registers: &Registers) -> MidiRequest {
    MidiRequest {
        pitch: registers.line[A0_REG],
        duration: registers.line[A1_REG],
        instrument: registers.line[A2_REG],
        volume: registers.line[A3_REG],
    }
}

const PRINT_BUFFER_TIME: Duration = Duration::from_millis(5);

impl SyscallDelegate {
    pub fn new(state: Arc<Mutex<SyscallState>>) -> SyscallDelegate {
        SyscallDelegate { state }
    }

    async fn send_print(&self, text: &str) {
        self.state.lock().unwrap().console.print(text, false);

        let time = self.state.lock().unwrap().time.clone();

        time.sleep(PRINT_BUFFER_TIME).await;
    }

    fn play_installed(&self, request: &MidiRequest, sync: bool) -> bool {
        let mut syscall = self.state.lock().unwrap();

        if syscall.midi.installed(request.instrument) {
            syscall.midi.play(request, sync);

            true
        } else {
            false
        }
    }

    async fn print_integer<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        state: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let value = a0(state);
        self.send_print(&format!("{}", value as i32)).await;

        Completed
    }

    async fn print_float<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        _: &Executor<Mem, Track>,
    ) -> SyscallResult {
        Unimplemented(2)
    }

    async fn print_double<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        _: &Executor<Mem, Track>,
    ) -> SyscallResult {
        Unimplemented(3)
    }

    fn grab_string<Mem: Memory>(
        mut address: u32,
        memory: &Mem,
        max: Option<usize>,
    ) -> Result<String, Error> {
        let mut buffer = String::new();

        loop {
            if max.map(|max| buffer.len() >= max).unwrap_or(false) {
                break;
            }

            let byte = memory.get(address)?;

            if byte == 0 {
                break;
            }

            buffer.push(byte as char);

            let Some(next_address) = address.checked_add(1) else {
                return Err(CpuTrap);
            };

            address = next_address
        }

        Ok(buffer)
    }

    async fn print_string<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let buffer = {
            let address = a0(debugger);

            let result = debugger.with_memory(|m| Self::grab_string(address, m, Some(1000)));

            match result {
                Ok(buffer) => buffer,
                Err(error) => return Exception(error),
            }
        };

        self.send_print(&buffer).await;

        Completed
    }

    fn lock_input(&self) -> Arc<ByteChannel> {
        self.state.lock().unwrap().input_buffer.clone()
    }

    async fn read_integer<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let buffer = self.lock_input();

        let mut positive = Option::<bool>::None;
        let mut value: i64 = 0;

        fn sign(c: char) -> Option<bool> {
            match c {
                '+' => Some(true),
                '-' => Some(false),
                _ => None,
            }
        }

        let result = buffer
            .read_until(|b| {
                // No regards to utf8.
                let c = b as char;

                if positive.is_none() {
                    if c.is_whitespace() {
                        return ConsumeAndContinue; // just consume leading whitespace
                    }

                    let position = sign(c);

                    positive = position.or(Some(true));

                    if position.is_some() {
                        return ConsumeAndContinue;
                    }
                }

                if let Some(digit) = c.to_digit(10) {
                    value *= 10;
                    value += digit as i64;

                    ConsumeAndContinue
                } else {
                    IgnoreAndStop
                }
            })
            .await;

        if result.is_none() {
            return Aborted;
        }

        let sign_value = if positive.unwrap_or(true) {
            1i64
        } else {
            -1i64
        };

        let final_value = sign_value * value;

        debugger.with_state(|s| s.registers.line[V0_REG] = final_value as u32);

        Completed
    }

    async fn read_float<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        _: &Executor<Mem, Track>,
    ) -> SyscallResult {
        Unimplemented(6)
    }

    async fn read_double<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        _: &Executor<Mem, Track>,
    ) -> SyscallResult {
        Unimplemented(7)
    }

    async fn read_string<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let (address, count) =
            debugger.with_state(|s| (s.registers.line[A0_REG], s.registers.line[A1_REG]));

        let count = count as usize;

        if count < 1 {
            return Completed;
        }

        let data = {
            let input_buffer = self.lock_input();

            let mut data: Vec<u8> = vec![];

            input_buffer
                .read_until(|b| {
                    let c = b as char;

                    if data.len() >= count - 1 {
                        // buffer is full or done
                        return IgnoreAndStop;
                    }

                    if c == '\n' {
                        return ConsumeAndStop;
                    }

                    data.push(b);

                    ConsumeAndContinue
                })
                .await;

            data.push(0); // null character

            assert!(data.len() <= count);

            data
        };

        debugger.with_memory(|memory| {
            for (i, b) in data.into_iter().enumerate() {
                let result = memory.set(address.wrapping_add(i as u32), b);

                if let Err(error) = result {
                    return Exception(error);
                }
            }

            Completed
        })
    }

    async fn alloc_heap<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let count = a0(debugger);

        // Primitive Heap Alloc, assuming 0x20000000 is safe heap.
        let mut syscall = self.state.lock().unwrap();
        let pointer = syscall.heap_start;
        syscall.heap_start += count;

        debugger.with_state(|s| s.registers.line[V0_REG] = pointer);

        Completed
    }

    async fn terminate<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        _: &Executor<Mem, Track>,
    ) -> SyscallResult {
        Terminated(0)
    }

    async fn print_character<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let character = a0(debugger) as u8 as char;

        self.send_print(&character.to_string()).await;

        Completed
    }

    async fn read_character<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let buffer = self.lock_input();

        let result = buffer.read(1).await;

        let Some(result) = result else { return Aborted };

        if result.len() != 1 {
            return Aborted;
        }

        debugger.with_state(|s| s.registers.line[V0_REG] = result[0] as u32);

        Completed
    }

    async fn open_file<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let (address, flags) =
            debugger.with_state(|s| (s.registers.line[A0_REG], s.registers.line[A1_REG]));

        // Mode/$a2 is ignored.

        let result = debugger.with_memory(|memory| Self::grab_string(address, memory, Some(400)));

        let filename = match result {
            Ok(buffer) => buffer,
            Err(error) => return Exception(error),
        };

        let filename_path = PathBuf::from(&filename);

        let absolute_path = if filename_path.is_relative() {
            let current_directory = {
                self.state
                    .lock()
                    .unwrap()
                    .current_directory
                    .as_ref()
                    .map(PathBuf::from)
            };

            if let Some(mut current_directory) = current_directory {
                current_directory.extend(&filename_path);

                Some(current_directory)
            } else {
                // Cursed duplication.
                None
            }
        } else {
            None
        };

        let resolved_path = absolute_path.as_ref().unwrap_or(&filename_path);

        let file = match flags {
            0 => File::open(resolved_path),
            1 => File::create(resolved_path),
            9 => OpenOptions::new().append(true).open(resolved_path),
            _ => {
                return Failure(format!(
                    "Invalid flags {} for opening file {}",
                    flags, filename
                ))
            }
        };

        let Ok(file) = file else {
            debugger.with_state(|s| s.registers.line[V0_REG] = (-1i32) as u32);

            return Completed;
        };

        let mut syscall = self.state.lock().unwrap();

        let descriptor = syscall.next_file;

        syscall.next_file += 1;
        syscall.file_map.insert(descriptor, file);

        debugger.with_state(|s| s.registers.line[V0_REG] = descriptor);

        Completed
    }

    fn file_parameters<Mem: Memory, Track: Tracker<Mem>>(
        debugger: &Executor<Mem, Track>,
    ) -> (u32, u32, u32) {
        debugger.with_state(|s| {
            (
                s.registers.line[A0_REG],
                s.registers.line[A1_REG],
                s.registers.line[A2_REG],
            )
        })
    }

    // Duplicate Code Abstraction
    fn get_file<'a, Mem: Memory, Track: Tracker<Mem>>(
        syscall: &'a mut SyscallState,
        descriptor: u32,
        debugger: &Executor<Mem, Track>,
    ) -> Option<&'a mut File> {
        let result = syscall.file_map.get_mut(&descriptor);

        if result.is_none() {
            // descriptor does not exist
            debugger.with_state(|s| s.registers.line[V0_REG] = -1i32 as u32)
        }

        result
    }

    async fn read_file<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let (descriptor, address, size) = Self::file_parameters(debugger);

        let mut syscall = self.state.lock().unwrap();

        let Some(file) = Self::get_file(&mut syscall, descriptor, debugger) else {
            return Completed;
        };

        let mut buffer = vec![0u8; size as usize];

        let Ok(bytes) = file.read(buffer.as_mut_slice()) else {
            // file is not opened for read
            debugger.with_state(|s| s.registers.line[V0_REG] = -2i32 as u32);

            return Completed;
        };

        for (i, byte) in buffer[0..bytes].iter().enumerate() {
            let Some(next) = address.checked_add(i as u32) else {
                return Exception(CpuTrap);
            };

            let result = debugger.with_memory(|m| m.set(next, *byte));

            if let Err(error) = result {
                return Exception(error);
            }
        }

        debugger.with_state(|s| s.registers.line[V0_REG] = bytes as u32);

        Completed
    }

    async fn write_file<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let (descriptor, address, size) = Self::file_parameters(debugger);

        let mut syscall = self.state.lock().unwrap();

        let Some(file) = Self::get_file(&mut syscall, descriptor, debugger) else {
            return Completed;
        };

        let mut buffer = vec![0u8; size as usize];

        for i in 0..size {
            let Some(next) = address.checked_add(i) else {
                return Exception(CpuTrap);
            };

            match debugger.with_memory(|m| m.get(next)) {
                Ok(byte) => buffer[i as usize] = byte,
                Err(error) => return Exception(error),
            }
        }

        let Ok(bytes) = file.write(buffer.as_slice()) else {
            // file was not opened for writing
            debugger.with_state(|s| s.registers.line[V0_REG] = -2i32 as u32);

            return Completed;
        };

        debugger.with_state(|s| s.registers.line[V0_REG] = bytes as u32);

        Completed
    }

    async fn close_file<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        state: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let descriptor = a0(state);

        let mut syscall = self.state.lock().unwrap();
        syscall.file_map.remove(&descriptor);

        Completed
    }

    async fn terminate_valued<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        Terminated(a0(debugger))
    }

    async fn system_time<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        match self.state.lock().unwrap().time.time() {
            Some(time) => {
                let millis = time.as_millis() as u64;

                debugger.with_state(|debugger_state| {
                    debugger_state.registers.line[A0_REG] = (millis & 0xFFFFFFFF) as u32;
                    debugger_state.registers.line[A1_REG] = millis.wrapping_shr(32) as u32;
                });

                Completed
            }
            None => Failure("System clock failed to get current time.".into()),
        }
    }

    async fn midi_out<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let request = debugger.with_state(|s| midi_request(&s.registers));

        if self.play_installed(&request, false) {
            return Completed;
        }

        let state_clone = self.state.clone();

        let install = {
            let mut lock = state_clone.lock().unwrap();

            lock.midi.install(request.instrument)
        };

        if install.await {
            state_clone.lock().unwrap().midi.play(&request, false)
        }

        Completed
    }

    async fn sleep_for_duration(&self, time: u64) {
        let duration = Duration::from_millis(time);

        let time = self.state.lock().unwrap().time.clone();

        time.sleep(duration).await;
    }

    async fn sleep<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        // Not trusting sleep to be exact, so we're using Instant to keep track of the time.
        let time = a0(debugger) as u64;

        self.sleep_for_duration(time).await;

        Completed
    }

    async fn midi_out_sync<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let request = debugger.with_state(|s| midi_request(&s.registers));

        let (sender, receiver) = oneshot::channel();

        self.state.lock().unwrap().sync_wake = Some(sender);

        if self.play_installed(&request, true) {
            receiver.await.ok();

            return Completed;
        }

        let install = self.state.lock().unwrap().midi.install(request.instrument);

        if install.await {
            self.state.lock().unwrap().midi.play(&request, true);

            receiver.await.ok();
        }

        Completed
    }

    async fn print_hexadecimal<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        state: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let value = a0(state);
        self.send_print(&format!("{:x}", value as i32)).await;

        Completed
    }

    async fn print_binary<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        state: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let value = a0(state);
        self.send_print(&format!("{:b}", value as i32)).await;

        Completed
    }

    async fn print_unsigned<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        state: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let value = a0(state);
        self.send_print(&format!("{}", value)).await;

        Completed
    }

    async fn set_seed<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let mut syscall = self.state.lock().unwrap();

        let (id, seed) =
            debugger.with_state(|s| (s.registers.line[A0_REG], s.registers.line[A1_REG]));

        syscall
            .generators
            .insert(id, ChaCha8Rng::seed_from_u64(seed as u64));

        Completed
    }

    fn fail_generator(id: u32) -> SyscallResult {
        Failure(format!(
            "No generator initialized for id {}, try using the default $a0 = 0 generator or create one with syscall 40.",
            id
        ))
    }

    async fn random_int<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let mut syscall = self.state.lock().unwrap();

        let id = a0(debugger);
        let Some(generator) = syscall.generators.get_mut(&id) else {
            return Self::fail_generator(id);
        };

        let value: u32 = generator.gen();

        debugger.with_state(|s| s.registers.line[A0_REG] = value);

        Completed
    }

    async fn random_int_ranged<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
    ) -> SyscallResult {
        let mut syscall = self.state.lock().unwrap();

        let (id, max) =
            debugger.with_state(|s| (s.registers.line[A0_REG], s.registers.line[A1_REG]));
        let Some(generator) = syscall.generators.get_mut(&id) else {
            return Self::fail_generator(id);
        };

        if max <= 0 {
            return Failure(
                "Empty range for random int, please set $a0 to a value greater than 0.".to_string(),
            );
        }

        let value: u32 = generator.gen_range(0..max);

        debugger.with_state(|s| s.registers.line[A0_REG] = value);

        Completed
    }

    async fn random_float<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        _: &Executor<Mem, Track>,
    ) -> SyscallResult {
        Unimplemented(43)
    }

    async fn random_double<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        _: &Executor<Mem, Track>,
    ) -> SyscallResult {
        Unimplemented(44)
    }

    async fn wrap_cancel<F: FusedFuture<Output = SyscallResult>>(&self, f: F) -> SyscallResult {
        // This is *really* bad code.
        let Some(receiver) = self.state.lock().unwrap().grab_cancel() else {
            return Aborted;
        };

        let result = select! {
            result = pin!(f) => result,
            _ = receiver.fuse() => Aborted
        };

        result
    }

    pub async fn dispatch<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        state: &Executor<Mem, Track>,
        code: u32,
    ) -> SyscallResult {
        match code {
            1 => self.wrap_cancel(self.print_integer(state).fuse()).await,
            2 => self.wrap_cancel(self.print_float(state).fuse()).await,
            3 => self.wrap_cancel(self.print_double(state).fuse()).await,
            4 => self.wrap_cancel(self.print_string(state).fuse()).await,
            5 => self.wrap_cancel(self.read_integer(state).fuse()).await,
            6 => self.wrap_cancel(self.read_float(state).fuse()).await,
            7 => self.wrap_cancel(self.read_double(state).fuse()).await,
            8 => self.wrap_cancel(self.read_string(state).fuse()).await,
            9 => self.wrap_cancel(self.alloc_heap(state).fuse()).await,
            10 => self.wrap_cancel(self.terminate(state).fuse()).await,
            11 => self.wrap_cancel(self.print_character(state).fuse()).await,
            12 => self.wrap_cancel(self.read_character(state).fuse()).await,
            13 => self.wrap_cancel(self.open_file(state).fuse()).await,
            14 => self.wrap_cancel(self.read_file(state).fuse()).await,
            15 => self.wrap_cancel(self.write_file(state).fuse()).await,
            16 => self.wrap_cancel(self.close_file(state).fuse()).await,
            17 => self.wrap_cancel(self.terminate_valued(state).fuse()).await,
            30 => self.wrap_cancel(self.system_time(state).fuse()).await,
            31 => self.wrap_cancel(self.midi_out(state).fuse()).await,
            32 => self.wrap_cancel(self.sleep(state).fuse()).await,
            33 => self.wrap_cancel(self.midi_out_sync(state).fuse()).await,
            34 => self.wrap_cancel(self.print_hexadecimal(state).fuse()).await,
            35 => self.wrap_cancel(self.print_binary(state).fuse()).await,
            36 => self.wrap_cancel(self.print_unsigned(state).fuse()).await,
            40 => self.wrap_cancel(self.set_seed(state).fuse()).await,
            41 => self.wrap_cancel(self.random_int(state).fuse()).await,
            42 => self.wrap_cancel(self.random_int_ranged(state).fuse()).await,
            43 => self.wrap_cancel(self.random_float(state).fuse()).await,
            44 => self.wrap_cancel(self.random_double(state).fuse()).await,
            _ => Unknown(code),
        }
    }

    async fn handle_frame<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
        frame: DebugFrame,
    ) -> (Option<DebugFrame>, Option<SyscallResult>, bool) {
        match frame.mode {
            Invalid(CpuSyscall) => {
                // $v0
                let code = debugger.with_state(|s| s.registers.line[V0_REG]);
                let result = self.dispatch(debugger, code).await;

                match result {
                    Completed => {
                        debugger.syscall_handled();

                        (None, Some(result), true)
                    }
                    _ => (Some(frame), Some(result), false),
                }
            }
            _ => (Some(frame), None, false),
        }
    }

    // A syscall will interrupt a batch!
    pub async fn run_batch<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
        batch: usize,
        should_skip_first: bool,
        allow_interrupt: bool,
    ) -> Option<(DebugFrame, Option<SyscallResult>)> {
        if !debugger
            .run_batched(batch, should_skip_first, allow_interrupt)
            .interrupted
        {
            return None; // no interruption, batch completed successfully
        }

        let frame_in = debugger.frame();

        let (frame, result, recovered) = self.handle_frame(debugger, frame_in).await;

        if let Some(frame) = frame {
            return Some((frame, result));
        }

        if !recovered {
            return Some((debugger.frame(), None));
        }

        None
    }

    pub async fn run<Mem: Memory, Track: Tracker<Mem>>(
        &self,
        debugger: &Executor<Mem, Track>,
        mut should_skip_first: bool,
    ) -> (DebugFrame, Option<SyscallResult>) {
        loop {
            let frame = debugger.run(should_skip_first);
            let (frame, result, recovered) = self.handle_frame(debugger, frame).await;

            should_skip_first = false;

            if let Some(frame) = frame {
                return (frame, result);
            }

            if !recovered {
                return (debugger.frame(), None);
            }
        }
    }
}
