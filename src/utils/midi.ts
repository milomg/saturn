import { tauri } from '@tauri-apps/api'
import { WebAudioTinySynth } from './tinysynth'

const synth = new WebAudioTinySynth({})

export interface MidiNote {
  sync: boolean
  name: string
  instrument: number
  note: number
  duration: number
  volume: number
}

let ch = 0
export async function playNote(note: MidiNote) {
  const wake = async () => await tauri.invoke('wake_sync')

  await synth.ready()

  if (note.duration > 0) {
    synth.setChVol(ch, note.volume, 0)
    synth.setProgram(ch, note.instrument)
    synth.noteOn(ch, note.note, 127, 0)
    synth.noteOff(ch, note.note, note.duration)
    ch = (ch + 1) % 16
  }

  if (note.sync) {
    if (note.duration > 0) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, note.duration * 1000)
      )
    }

    await wake()
  }
}
