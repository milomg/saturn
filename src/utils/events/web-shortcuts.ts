import { hasActionKey } from '../query/shortcut-key'
import {
  Accelerator,
  closeCurrentTab,
  newTab,
  toggleConsole,
  toggleSettings,
} from './events'
import { build, pause, resume, step, stop } from '../debug'
import {
  createTab,
  loadElf,
  showFileOpenDialog,
  showFileSaveDialog,
  tab,
  tabsState,
} from '../../state/state'

const storage = navigator.storage.getDirectory()

let showFileSaveResolve: ((t: string) => void) | null = null
export const confirm = (t: string) => {
  showFileSaveResolve?.(t)
}

export const getOpenableFiles = async () => {
  const files = (await storage).keys()
  const out = []
  for await (const key of files) {
    out.push(key)
  }
  return out
}

export async function saveCurrentTab() {
  const current = tab()
  if (!current) {
    return
  }

  if (!current.path) {
    showFileSaveDialog.value = true
    const name = await new Promise<string>((resolve) => {
      showFileSaveResolve = resolve
    })
    showFileSaveDialog.value = false

    if (name) {
      current.path = name
      current.title = name
    }

    if (!current.path) {
      return
    }
  }

  const name = current.path
  const astorage = await storage
  const file = await astorage.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  const value = current.doc.toString()
  await writable.write(value)
  await writable.close()
  current.marked = false
}

export async function openTab() {
  showFileOpenDialog.value = true
  const name = await new Promise<string>((resolve) => {
    showFileSaveResolve = resolve
  })
  showFileOpenDialog.value = false

  if (!name) {
    return
  }

  const astorage = await storage
  const file = await astorage.getFileHandle(name)
  const fileContents = await file.getFile()

  const existing = tabsState.tabs.find((tab) => tab.path === name)

  if (existing) {
    tabsState.selected = existing.uuid
    return
  }
  if (name.endsWith('.asm')) {
    const contents = await fileContents.text()
    createTab(name, contents, name)
  } else {
    const data = await fileContents.arrayBuffer()
    await loadElf(name, data)
  }
}

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
  [command('O'), openTab], // tauri required
  [command('W'), closeCurrentTab],
  [command('S'), saveCurrentTab],
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
