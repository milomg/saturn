import {
  AssembledRegions,
  AssemblerResult,
  BinaryResult,
  BitmapConfig,
  Breakpoint,
  Breakpoints,
  DisassembleResult,
  ExecutionProfile,
  ExecutionResult,
  HexBinaryResult,
  InstructionDetails,
  InstructionLine,
  LastDisplay,
  MipsBackend,
  MipsCallbacks,
  MipsExecution,
} from './mips'
import { ExportRegionsOptions } from '../settings'

import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { MidiNote } from '../midi'

export class TauriExecution implements MipsExecution {
  configured: boolean = false
  public breakpoints: Breakpoints | null

  protocol = convertFileSrc('', 'display')

  async configure(): Promise<AssemblerResult | null> {
    if (this.configured) {
      return null
    }

    this.configured = true

    switch (this.profile.kind) {
      case 'elf': {
        const text = window.atob(this.profile.elf)

        const bytes = new Array(text.length)
        for (let i = 0; i < text.length; i++) {
          bytes[i] = text.charCodeAt(i)
        }

        const result = await invoke('configure_elf', {
          bytes,
          path: this.path,
          timeTravel: this.timeTravel,
        })

        return result
          ? { status: 'Success', breakpoints: [] }
          : {
              status: 'Error',
              message: 'Configured ELF was not valid',
              body: null,
              marker: null,
            }
      }

      case 'asm': {
        const result = (await invoke('configure_asm', {
          text: this.text,
          path: this.path,
          timeTravel: this.timeTravel,
        })) as AssemblerResult

        if (result.status === 'Success') {
          this.breakpoints = new Breakpoints(result.breakpoints)
        }

        return result
      }

      default:
        break
    }

    throw new Error()
  }

  // Requires Time Travel
  public async lastPc(): Promise<number | null> {
    return await invoke('last_pc')
  }

  public async rewind(count: number): Promise<ExecutionResult | null> {
    return await invoke('rewind', { count })
  }

  public async resume(
    count: number | null,
    breakpoints: number[] | null,
  ): Promise<ExecutionResult | null> {
    if (!this.configured) {
      console.error('Not configured yet, cannot resume.')

      return null
    }

    const mappedBreakpoints = breakpoints
      ? (this.breakpoints?.mapLines(breakpoints) ?? [])
      : []

    const result = await invoke('resume', {
      breakpoints: mappedBreakpoints,
      count,
    })

    return result as ExecutionResult
  }

  // For setting new breakpoints WHILE the machine is running.
  // There's a distinction for some weird technical reason.
  public async setBreakpoints(breakpoints: number[]) {
    if (!this.configured) {
      // Have to invoke resume() with breakpoints anyway.
      return
    }

    await invoke('swap_breakpoints', {
      breakpoints: this.breakpoints?.mapLines(breakpoints) ?? [],
    })
  }

  public async pause() {
    await invoke('pause')
  }

  public async stop() {
    await invoke('stop')
  }

  public async postKey(key: string, up: boolean) {
    if (key.length !== 1) {
      return
    }

    await invoke('post_key', { key, up })
  }

  public async postInput(text: string) {
    if (text.length <= 0) {
      return
    }

    await invoke('post_input', { text })
  }

  public async memoryAt(
    address: number,
    count: number,
  ): Promise<(number | null)[] | null> {
    const result = await invoke('read_bytes', { address, count })

    return result as (number | null)[] | null
  }

  // register: 32 -> hi, 33 -> lo, 34 -> pc
  public async setRegister(register: number, value: number) {
    await invoke('set_register', { register, value })
  }

  public async setMemory(address: number, bytes: number[]) {
    await invoke('write_bytes', { address, bytes })
  }

  async readDisplay(
    width: number,
    height: number,
    address: number,
    register: number | null,
  ): Promise<Uint8Array | null> {
    const headers = {
      width: width.toString(),
      height: height.toString(),
      address: address.toString(),
      ...(register != null ? { register: register.toString() } : {}),
    }

    const result = await fetch(this.protocol, {
      headers,
      mode: 'cors',
      cache: 'no-cache',
    })

    return new Uint8Array(await result.arrayBuffer())
  }

  public constructor(
    public text: string,
    public path: string | null,
    public timeTravel: boolean,
    public profile: ExecutionProfile,
  ) {
    switch (profile.kind) {
      case 'elf': {
        const breakpoints = Object.entries(profile.breakpoints).map(
          ([pc, line]) => ({ line, pcs: [parseInt(pc)] }) as Breakpoint,
        )

        this.breakpoints = new Breakpoints(breakpoints)

        break
      }

      default:
        this.breakpoints = null
        break
    }
  }
}

interface PrintPayload {
  text: string
  error: boolean
}

export class TauriBackend implements MipsBackend {
  unListen: (() => void)[] = []

  async setCallbacks(callbacks: MipsCallbacks) {
    this.clearCallbacks()

    this.unListen = [
      await listen('print', (event) => {
        let payload = event.payload as PrintPayload

        callbacks.consoleWrite(payload.text, payload.error)
      }),

      await listen('play-midi', async (event) => {
        callbacks.midiPlay(event.payload as MidiNote)
      }),
    ]
  }

  clearCallbacks() {
    for (const entry of this.unListen) {
      entry()
    }

    this.unListen = []
  }

  waitReady(): Promise<void> {
    return Promise.resolve()
  }

  async assembleRegions(
    text: string,
    path: string | null,
    options: ExportRegionsOptions,
  ): Promise<HexBinaryResult> {
    const value = (await invoke('assemble_regions', {
      text,
      path,
      options,
    })) as [AssembledRegions | null, AssemblerResult]

    const [regions, result] = value

    return {
      regions,
      result,
    }
  }

  async assembleText(
    text: string,
    path: string | null,
  ): Promise<AssemblerResult> {
    const result = await invoke('assemble', { text, path })

    return result as AssemblerResult
  }

  async assembleWithBinary(
    text: string,
    path: string | null,
  ): Promise<BinaryResult> {
    const result = (await invoke('assemble_binary', { text, path })) as [
      number[] | null,
      AssemblerResult,
    ]

    const [binary, assemblerResult] = result

    return {
      binary: binary ? Uint8Array.from(binary) : null,
      result: assemblerResult,
    }
  }

  async configureDisplay(config: BitmapConfig): Promise<void> {
    await invoke('configure_display', {
      width: config.width,
      height: config.height,
      address: config.address,
      register: config.register,
    })
  }

  async decodeInstruction(
    pc: number,
    instruction: number,
  ): Promise<InstructionDetails | null> {
    return (await invoke('decode_instruction', { pc, instruction })) ?? null
  }

  async disassembleElf(
    named: string,
    elf: ArrayBuffer,
  ): Promise<DisassembleResult> {
    const bytes = Array.from(new Uint8Array(elf))

    const value = await invoke('disassemble', { named, bytes })

    return value as DisassembleResult
  }

  async disassemblyDetails(bytes: ArrayBuffer): Promise<InstructionLine[]> {
    return await invoke('detailed_disassemble', {
      bytes: Array.from(new Uint8Array(bytes)),
    })
  }

  async lastDisplay(): Promise<LastDisplay> {
    const result = await invoke('last_display')

    return result as LastDisplay
  }

  async wakeSync(): Promise<void> {
    await invoke('wake_sync')
  }

  createExecution(
    text: string,
    path: string | null,
    timeTravel: boolean,
    profile: ExecutionProfile,
  ): Promise<MipsExecution> {
    return Promise.resolve(new TauriExecution(text, path, timeTravel, profile))
  }

  close() {
    this.clearCallbacks()
  }
}
