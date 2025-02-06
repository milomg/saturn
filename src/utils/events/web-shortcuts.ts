import { hasActionKey } from '../query/shortcut-key'
import { Accelerator, closeCurrentTab, newTab, toggleConsole, toggleSettings } from './events'
import { build, pause, resume, step, stop } from '../debug'

function command(key: string, shift?: boolean): Accelerator {
  return {
    command: true, // isn't command always true?
    shift: shift ?? false,
    key,
  }
}

// cmd + N, cmd + T, cmd + W, cmd + L are not preventDefault'able
// do we want to rebind?
const bindings: [Accelerator, () => void][] = [
  [command('N'), newTab],
  // [command('O'), openTab], // tauri required
  [command('W'), closeCurrentTab],
  // [command('S'), saveCurrentTab], // tauri required
  // [command('S', true), saveAs], // tauri required
  // [command('F'), () => {}], // not listened to, handled by editor
  [command('B'), build],
  [command('K'), resume],
  [command('L'), step],
  [command('J'), pause],
  [command('P'), stop],
  [command('O'), toggleConsole],
  [command(','), toggleSettings],
]

export function setupWebShortcuts() {
  window.addEventListener('keydown', async (event) => {
    const key = event.key.toUpperCase()

    const shortcut = bindings.find(([accelerator, _]) => {
      return (
        accelerator.key === key &&
        accelerator.command == hasActionKey(event) &&
        accelerator.shift == event.shiftKey
      )
    })

    if (!shortcut) {
      return
    }

    const [_, callback] = shortcut

    event.preventDefault()
    callback()
  })
}