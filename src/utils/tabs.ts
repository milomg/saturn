import { computed, reactive, ref, Ref, watch, markRaw, Raw } from 'vue'

import { v4 as uuid } from 'uuid'
import {
  AssemblyExecutionProfile,
  ElfExecutionProfile,
  ExecutionProfile,
} from './mips/mips'
import { SelectionIndex, SelectionRange } from './editor'
import { PromptType } from './events/events'
import { SaveModalResult, useSaveModal } from './save-modal'
import { closeWindow } from './window'
import { accessReadText, accessSync } from './query/access-manager'
import { backend } from '../state/backend'
import { EditorState, Extension } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { breakpointGutter } from './breakpoints'
import { Mips } from './lezer-mips'
import {
  createDefaultMinimap,
  createDefaultTheme,
  createDefaultVim,
} from './lezer-mips/modes'
import { suggestionsContext } from './lezer-mips/suggestions'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { createCollab, joinYTab } from './lezer-mips/collab'
import { saveTab } from './events/events'

export type CursorState = SelectionIndex & {
  highlight: SelectionIndex | null
}

export function selectionRange(cursor: CursorState): SelectionRange | null {
  if (!cursor.highlight) {
    return null
  }

  // Took out technical debt here and the methods in EditorBody for selection.
  const highlightBeforeLine = cursor.highlight.line < cursor.line
  const highlightBeforeIndex =
    cursor.highlight.line === cursor.line &&
    cursor.highlight.index < cursor.index

  if (highlightBeforeLine || highlightBeforeIndex) {
    // assert cursor.highlight.line <= cursor.line
    return {
      startLine: cursor.highlight.line,
      startIndex: cursor.highlight.index,
      endLine: cursor.line,
      endIndex: cursor.index,
    }
  } else {
    // assert cursor.highlight.line >= cursor.line
    return {
      startLine: cursor.line,
      startIndex: cursor.index,
      endLine: cursor.highlight.line,
      endIndex: cursor.highlight.index,
    }
  }
}

export interface EditorTab {
  uuid: string
  title: string
  doc: string
  state: Raw<EditorState>
  removed: boolean
  path: string | null
  writable: boolean
  marked: boolean // needs saving
  profile: ExecutionProfile | null
}

export function collectLines(lines: string[]): string {
  return lines.join('\n')
}

let syncing = false
export function isSyncing(): boolean {
  return syncing
}
export function createState(
  editor: Tabs,
  uuid: string,
  doc: string,
  writable: boolean,
  collab: Extension = [],
): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      // vim needs to be before any other keymap
      createDefaultVim(),
      createDefaultMinimap(),
      createDefaultTheme(),
      suggestionsContext,
      keymap.of([indentWithTab]),
      EditorView.updateListener.of((update) => {
        const tab = editor.tabs.find((tab) => tab.uuid === uuid)
        if (!tab) {
          console.warn('Editor is rendering a tab that does not exist, strange')
          return
        }
        syncing = true
        if (update.docChanged) {
          tab.marked = true
          tab.doc = update.state.doc.toString()
        }
        tab.state = markRaw(update.state)
        syncing = false
      }),
      Mips(),
      createCollab(collab),
      breakpointGutter,
      basicSetup,
      writable ? [] : EditorState.readOnly.of(true),
    ],
  })
}

export interface Tabs {
  tabs: EditorTab[]
  selected: string | null
}

export interface TabsInterface {
  tab(): EditorTab | null
  closeTab(uuid: string): boolean
  createTab(
    named: string,
    content: string,
    path?: string,
    profile?: ExecutionProfile,
  ): void
  loadElf(named: string, elf: ArrayBufferLike): Promise<void>
}

export type TabsResult = TabsInterface & {
  tabsState: Tabs
  saveModal: SaveModalResult
  showSettings: Ref<boolean>
}

const restoreKey = 'saturn:tabs-state'
const backupKeyPrefix = 'saturn:tab-backup'
const backupNameKey = 'saturn:backup-keys'
const tabsVersion = 1
const maxBackupLength = 200000

function backupKey(uuid: string): string {
  return `${backupKeyPrefix}:${uuid}`
}

interface RestoreTab {
  uuid: string
  title?: string
  path: string | null
  breakpoints: number[]
  writable: boolean
  marked: boolean
  profile: ExecutionProfile | null
}

interface TabsRestoreState {
  version: number
  selected: string | null
  tabs: RestoreTab[]
}

export function useTabs(): TabsResult {
  const editor = reactive<Tabs>({
    tabs: [],
    selected: null,
  })

  function pushEmpty() {
    if (!editor.tabs.length) {
      createTab('Untitled', '')
    }
  }

  async function restore() {
    const item = localStorage.getItem(restoreKey)

    if (!item) {
      pushEmpty()
      return
    }

    const state = JSON.parse(item) as TabsRestoreState

    if (state.version != tabsVersion) {
      pushEmpty()
      return
    }

    editor.tabs = []
    editor.selected = null

    for (const tab of state.tabs) {
      const title = tab.title || 'Untitled'
      let data: string | null
      
      if (tab.path) {
        if (tab.path.startsWith('remote://')) {
          editor.tabs.push(joinYTab(editor, tab.path.replace('remote://', '')))
          continue
        }

        try {
          data = await accessReadText(tab.path)
        } catch (e) {
          console.error(
            `Could not resume tab ${tab.path ?? 'Untitled'} (${
              tab.uuid
            }) with error`,
          )
          console.error(e)

          // Discard tab.
          continue
        }
      } else {
        data = localStorage.getItem(backupKey(tab.uuid))
      }

      if (!data) {
        continue
      }

      const state = markRaw(createState(editor, tab.uuid, data, tab.writable))

      editor.tabs.push({
        uuid: tab.uuid,
        title,
        doc: data,
        path: tab.path,
        removed: false,
        writable: tab.writable,
        marked: tab.marked,
        profile: tab.profile,
        state,
      })
    }

    pushEmpty()

    if (editor.tabs.length) {
      const hasSelected = editor.tabs.some((x) => x.uuid === state.selected)
      editor.selected = hasSelected ? state.selected : editor.tabs[0].uuid
    }

    await accessSync(
      editor.tabs.map((x) => x.path).filter((x): x is string => x !== null),
    )
  }

  function updateBackups(map: Map<string, string>) {
    const values = localStorage.getItem(backupNameKey)

    if (values) {
      const list = JSON.parse(values)

      for (const item of list) {
        localStorage.removeItem(item)
      }
    }

    const result = []
    for (const key of map.keys()) {
      result.push(backupKey(key))
    }

    localStorage.setItem(backupNameKey, JSON.stringify(result))

    for (const [key, value] of map.entries()) {
      localStorage.setItem(backupKey(key), value)
    }
  }

  function backup() {
    const state = {
      version: tabsVersion,
      selected: editor.selected,
      tabs: [],
    } as TabsRestoreState

    const map = new Map<string, string>()

    for (const tab of editor.tabs) {
      const restore = {
        uuid: tab.uuid,
        title: tab.title,
        path: tab.path,
        writable: tab.writable,
        marked: tab.marked,
        profile: tab.profile,
      } as RestoreTab

      if (!tab.path) {
        const collect = tab.doc.toString()

        if (collect.length <= maxBackupLength) {
          map.set(tab.uuid, collect)
        }
      }

      state.tabs.push(restore)
    }

    updateBackups(map)

    localStorage.setItem(restoreKey, JSON.stringify(state))
  }

  restore().then(() => {})
  window.setInterval(backup, 1000)
  watch(() => editor.tabs.length, backup)

  const tab = computed(() => {
    if (editor.selected) {
      return editor.tabs.find((tab) => tab.uuid === editor.selected) ?? null
    }

    return null
  })

  async function discardTab(uuid: string) {
    const index = editor.tabs.findIndex((tab) => tab.uuid === uuid)

    if (index === undefined) {
      return
    }

    editor.tabs = editor.tabs.filter((tab) => tab.uuid !== uuid)

    if (editor.selected === uuid) {
      if (editor.tabs.length <= 0) {
        editor.selected = null

        await closeWindow()

        return
      }

      const point = Math.min(Math.max(index - 1, 0), editor.tabs.length - 1)

      editor.selected = editor.tabs[point].uuid
    }
  }

  // !! Not very functional on WebSaturn.
  const saveModal = useSaveModal(
    (tab) => saveTab(tab, PromptType.PromptWhenNeeded),
    (tab) => discardTab(tab.uuid),
  )

  const showSettings = ref(false)

  function closeTab(uuid: string): boolean {
    const tab = editor.tabs.find((tab) => tab.uuid === uuid)

    if (tab === undefined) {
      return true
    }

    if (tab.marked) {
      saveModal.present(tab)

      return false
    } else {
      discardTab(uuid).then(() => {})

      return true
    }
  }

  function defaultAssemblyProfile(): AssemblyExecutionProfile {
    return { kind: 'asm' }
  }

  function createTab(
    named: string,
    content: string,
    path: string | null = null,
    profile: ExecutionProfile | null = defaultAssemblyProfile(),
    writable: boolean = true,
  ) {
    const id = uuid()

    editor.tabs.push({
      uuid: id,
      title: named,
      doc: content,
      state: markRaw(createState(editor, id, content, writable)),
      removed: false,
      path,
      writable,
      marked: false,
      profile,
    })

    editor.selected = id
  }

  async function loadElf(named: string, elf: ArrayBufferLike) {
    const value = await backend.disassembleElf(named, elf)

    const bytes = new Uint8Array(elf)
    let binary = ''
    bytes.forEach((byte) => (binary += String.fromCharCode(byte)))

    const lines = value.error ? value.error : value.lines.join('\n')
    const profile = {
      kind: 'elf',
      elf: window.btoa(binary),
      breakpoints: value.breakpoints,
    } as ElfExecutionProfile

    createTab(named, lines, null, profile, false)
  }

  return {
    tabsState: editor,
    tab: () => tab.value,
    closeTab,
    createTab,
    loadElf,
    saveModal,
    showSettings,
  }
}
