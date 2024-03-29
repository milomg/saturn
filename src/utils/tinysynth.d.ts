export class WebAudioTinySynth {
  ready(): Promise<void>

  constructor(options: {
    quality?: number
    useReverb?: number
    voices?: number
  })

  getAudioContext(): AudioContext
  setAudioContext(audioContext: AudioContext, destinationNode?: AudioNode): void
  getTimbreName(m: number, n: number): string
  setQuality(q: number): void
  setMasterVol(lev: number): void
  setReverbLev(lev: number): void
  setLoop(f: number): void
  setVoices(v: number): void
  loadMIDI(mididata: ArrayBuffer): void
  loadMIDIUrl(url: string): void
  playMIDI(): void
  stopMIDI(): void
  locateMIDI(tick: number): void
  getPlayStatus(): { play: number, curTick: number, maxTick: number }
  setTsMode(mode: number): void
  setTimbre(m: number, n: number, p: any): void
  reset(): void
  send(midiMessage: number[], t: number): void
  noteOn(ch: number, note: number, velo: number, t: number): void
  noteOff(ch: number, note: number, t: number): void
  setModulation(ch: number, val: number, t: number): void
  setChVol(ch: number, val: number, t: number): void
  setPan(ch: number, val: number, t: number): void
  setExpression(ch: number, val: number, t: number): void
  setSustain(ch: number, val: number, t: number): void
  setProgram(ch: number, pg: number): void
  setBend(ch: number, val: number, t: number): void
  setBendRange(ch: number, val: number): void
  allSoundOff(ch: number): void
  resetAllControllers(ch: number): void
}
