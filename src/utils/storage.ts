import { computed, ComputedRef, reactive, watch } from 'vue'
import { Editor } from './editor'
import { collectLines, EditorTab } from './tabs'
import { Language, Token } from './languages/language'
import { MipsHighlighter } from './languages/mips/language'
import { HighlightsInterface } from './highlights'
import { SuggestionsStorage } from './languages/suggestions'
import { backend } from '../state/backend'

export interface StorageState {
  // editor: Editor
  highlights: Token[][]
  debounce: number | null
}

export interface StorageInterface {
  suggestionsStorage(): SuggestionsStorage
}

export type StorageResult = StorageInterface & {
  editor: ComputedRef<Editor>
  storage: StorageState
}

type ShiftCallback = (line: number, deleted: number, insert: string[]) => void

export function useStorage(
  error: HighlightsInterface,
  tab: () => EditorTab | null,
): StorageResult {
  const storage = reactive({
    editor: createEditor(),
    highlights: [] as Token[][],
    debounce: null as number | null,
  } as StorageState)

  // Not reactive.
  let suggestions = new SuggestionsStorage()

  async function checkSyntax() {
    const current = tab()

    const result = await backend.assembleText(
      current?.state.doc.toString() ?? '',
      current?.path ?? null,
    )

    if (result.status === 'Error' && result.marker) {
      const tokens = storage.highlights[result.marker.line]

      error.setHighlight(
        result.marker.line,
        result.marker.offset,
        result.message,
      )
    } else {
      error.dismissHighlight()
    }
  }

  function dispatchCheckSyntax() {
    if (tab()?.profile?.kind === 'asm') {
      if (storage.debounce) {
        window.clearTimeout(storage.debounce)
      }

      storage.debounce = window.setTimeout(checkSyntax, 500)
    }
  }

  function createEditor(): Editor {
    const current = tab()

    return new Editor(
      current?.state.doc.toString().split('\n') ?? ['Nothing yet.'],
      { line: 0, index: 0 },
      (current?.writable ?? false) ? undefined : () => false, // weird
    )
  }

  const editor = computed(() => {
    return createEditor()
  })

  function highlightAll() {
    // Might need to look at tab file extension to pick languages
    // storage.editor = createEditor()
    storage.highlights = [] // needs highlighting here

    dispatchCheckSyntax()

    error.dismissHighlight()
  }

  watch(
    () => tab()?.doc,
    (tab) => highlightAll(),
    { immediate: true },
  )

  return {
    editor,
    storage,
    suggestionsStorage: () => suggestions,
  } as StorageResult
}
