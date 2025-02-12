import * as backend from './wasm/saturn_wasm'
import {
  ExecutionModeType,
  type AssembledRegions,
  type AssemblerResult,
  type BinaryResult,
  type DisassembleResult,
  type ExecutionResult,
  type HexBinaryResult,
  type InstructionDetails,
  type InstructionLine,
  type LastDisplay,
} from './mips'
import {
  AssembleBinaryData,
  AssembleRegionsData,
  AssembleTextData,
  ConfigureAsmData,
  ConfigureDisplayData,
  ConfigureElfData,
  DecodeInstructionData,
  DetailedDisassembleData,
  DisassembleData,
  Message,
  MessageData,
  MessageEventData,
  MessageEventOp,
  MessageOp,
  MessageResponse,
  MessageResponseKind,
  PostInputData,
  PostKeyData,
  ReadBytesData,
  ReadDisplayData,
  ResumeData,
  RewindData,
  SetBreakpointsData,
  SetRegisterData,
  WriteBytesData,
} from './wasm-worker-message'
import { type MidiNote } from '../midi'

function sendConsoleWrite(text: string, error: boolean) {
  postEvent({
    op: MessageEventOp.ConsoleWrite,
    text,
    error,
  })
}

function sendMidiPlay(note: MidiNote) {
  postEvent({
    op: MessageEventOp.MidiPlay,
    note,
  })
}

// Runner/Execution State (Automatically Freed with the Worker Memory)
const runner = new backend.Runner(
  new backend.EventHandler(sendConsoleWrite, sendMidiPlay),
)

function assembleRegions({
  text,
  options,
}: AssembleRegionsData): HexBinaryResult {
  const [regions, result] = backend.assemble_regions(text, options) as [
    AssembledRegions | null,
    AssemblerResult,
  ]

  return {
    regions,
    result,
  }
}

function assembleText({ text }: AssembleTextData): AssemblerResult {
  return backend.assemble_text(text) as AssemblerResult
}

function assembleBinary({ text }: AssembleBinaryData): BinaryResult {
  return backend.assemble_binary(text) as BinaryResult
}

function decodeInstruction({
  pc,
  instruction,
}: DecodeInstructionData): InstructionDetails | null {
  return backend.decode_instruction(
    pc,
    instruction,
  ) as InstructionDetails | null
}

function disassemble({ named, bytes }: DisassembleData): DisassembleResult {
  return backend.disassemble(named ?? undefined, bytes) as DisassembleResult
}

function detailedDisassemble({
  bytes,
}: DetailedDisassembleData): InstructionLine[] {
  return backend.detailed_disassemble(bytes) as InstructionLine[]
}

function configureDisplay({ config }: ConfigureDisplayData) {
  runner.configure_display(
    config.address,
    config.register ?? undefined,
    config.width,
    config.height,
  )
}

function lastDisplay(): LastDisplay {
  return runner.last_display()
}

function configureElf({ bytes, timeTravel }: ConfigureElfData): boolean {
  return runner.configure_elf(bytes, timeTravel)
}

function configureAsm({ text, timeTravel }: ConfigureAsmData): AssemblerResult {
  return runner.configure_asm(text, timeTravel)
}

// Thanks to Milo
// https://github.com/facebook/react/blob/66cf2cfc8a8c4b09d2b783fd7302ae6b24150935/packages/scheduler/src/forks/Scheduler.js#L534-L540
const channel = new MessageChannel()
const port = channel.port2
let currentResolve: (() => void) | null = null
channel.port1.onmessage = () => currentResolve!()

function awaitMacrotaskFast(): Promise<void> {
  return new Promise<void>((resolve) => {
    currentResolve = resolve
    port.postMessage(null)
  })
}

async function resume({
  count,
  breakpoints,
}: ResumeData): Promise<ExecutionResult | null> {
  const batchSize = 120000 // worth adjusting this batch size

  let instructionsExecuted = 0

  const breaks = breakpoints === null ? undefined : new Uint32Array(breakpoints)

  let result: ExecutionResult | null = null

  let firstRun = true

  while (count === null || instructionsExecuted < count) {
    const instructionsToExecute =
      count === null
        ? batchSize
        : Math.min(count - instructionsExecuted, batchSize)

    result = (await runner.resume(
      instructionsToExecute,
      firstRun ? breaks : undefined,
      firstRun,
      count !== null,
    )) as ExecutionResult | null

    firstRun = false

    if (result === null) {
      return null
    }

    if (result.mode.type !== ExecutionModeType.Running) {
      return result
    }

    instructionsExecuted += batchSize

    await awaitMacrotaskFast()
  }

  return result
}

function stop() {
  runner.stop()
}

function pause() {
  runner.pause()
}

function lastPc(): number | null {
  return runner.last_pc() ?? null
}

function readBytes({
  address,
  count,
}: ReadBytesData): (number | null)[] | null {
  return runner.read_bytes(address, count)
}

function writeBytes({ address, bytes }: WriteBytesData) {
  runner.write_bytes(address, bytes)
}

function setRegister({ register, value }: SetRegisterData) {
  runner.set_register(register, value)
}

function setBreakpoints({ breakpoints }: SetBreakpointsData) {
  runner.set_breakpoints(breakpoints)
}

function postInput({ text }: PostInputData) {
  runner.post_input(text)
}

function postKey({ key, up }: PostKeyData) {
  runner.post_key(key, up)
}

function wakeSync() {
  runner.wake_sync()
}

function rewind({ count }: RewindData): ExecutionResult | null {
  return runner.rewind(count)
}

function readDisplay({ width, height, address, register }: ReadDisplayData) {
  return runner.read_display(address, register ?? undefined, width, height)
}

async function dispatchOp(data: MessageData): Promise<any> {
  switch (data.op) {
    case MessageOp.AssembleRegions:
      return assembleRegions(data)
    case MessageOp.AssembleText:
      return assembleText(data)
    case MessageOp.AssembleBinary:
      return assembleBinary(data)
    case MessageOp.DecodeInstruction:
      return decodeInstruction(data)
    case MessageOp.Disassemble:
      return disassemble(data)
    case MessageOp.DetailedDisassemble:
      return detailedDisassemble(data)
    case MessageOp.ConfigureDisplay:
      return configureDisplay(data)
    case MessageOp.LastDisplay:
      return lastDisplay()
    case MessageOp.ConfigureElf:
      return configureElf(data)
    case MessageOp.ConfigureAsm:
      return configureAsm(data)
    case MessageOp.Resume:
      return await resume(data)
    case MessageOp.Stop:
      return stop()
    case MessageOp.Pause:
      return pause()
    case MessageOp.LastPc:
      return lastPc()
    case MessageOp.ReadBytes:
      return readBytes(data)
    case MessageOp.WriteBytes:
      return writeBytes(data)
    case MessageOp.SetRegister:
      return setRegister(data)
    case MessageOp.SetBreakpoints:
      return setBreakpoints(data)
    case MessageOp.PostInput:
      return postInput(data)
    case MessageOp.PostKey:
      return postKey(data)
    case MessageOp.WakeSync:
      return wakeSync()
    case MessageOp.Rewind:
      return rewind(data)
    case MessageOp.ReadDisplay:
      return readDisplay(data)
  }
}

function postEvent(data: MessageEventData) {
  postMessage({
    kind: MessageResponseKind.Event,
    data,
  } satisfies MessageResponse)
}

async function handleMessage(event: MessageEvent) {
  const { id, data } = event.data as Message

  try {
    const value = await dispatchOp(data)

    postMessage({
      id,
      kind: MessageResponseKind.Success,
      data: value,
    } satisfies MessageResponse)
  } catch (error) {
    postMessage({
      id,
      kind: MessageResponseKind.Failure,
      error,
    } satisfies MessageResponse)
  }
}

onmessage = handleMessage

backend.initialize()

postEvent({
  op: MessageEventOp.Ready,
})
