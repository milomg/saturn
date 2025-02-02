import { postBuildMessage } from '../debug'
import {
  selectOpenElf,
} from '../query/access-manager'
import { consoleData } from '../../state/console-data'
import { backend } from '../../state/backend'
import {
  closeTab,
  createTab,
  loadElf,
  showSettings,
  tab,
  tabsState,
} from '../../state/state'

export enum PromptType {
  NeverPrompt,
  PromptWhenNeeded,
  ForcePrompt,
}

export interface Accelerator {
  command: boolean
  shift: boolean
  key: string
}

// 'new-tab'
export function newTab() {
  createTab('Untitled', '')
}

// 'close-tab'
export function closeCurrentTab() {
  if (tabsState.selected) {
    closeTab(tabsState.selected)
  }
}

// 'build' - build
// 'run' - resume
// 'step' - step
// 'pause' - pause
// 'stop' - stop

// 'assemble'
export async function assemble() {
  const current = tab()

  const result = await backend.assembleWithBinary(
    current?.state?.doc?.toString() ?? '',
    current?.path ?? null,
  )

  if (result.binary) {
    const name = tab()?.title
    const extended = name ? `${name}.elf` : 'Untitled Elf'

    await loadElf(extended, result.binary.buffer)
  }

  consoleData.showConsole = true
  postBuildMessage(result.result)
}

// 'disassemble'
export async function disassemble() {
  const result = await selectOpenElf()

  if (!result) {
    return
  }

  const { name, data } = result

  await loadElf(name ?? 'Untitled', data.buffer)
}

// 'toggle-console'
export function toggleConsole() {
  consoleData.showConsole = !consoleData.showConsole
}

// 'toggle-settings'
export function toggleSettings() {
  showSettings.value = !showSettings.value
}
