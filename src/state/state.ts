import { useSettings } from '../utils/settings'
import { useHighlights } from '../utils/highlights'
import { regular } from '../utils/query/text-size'
import { useStorage } from '../utils/storage'
import { useTabs } from '../utils/tabs'
import { GotoMessage, useGoto } from '../utils/goto'
import { ref } from 'vue'
import { InstructionLine } from '../utils/mips/mips'

export const settings = useSettings()

export const {
  tabsState,
  tab,
  createTab,
  closeTab,
  loadElf,
  saveModal,
  showSettings,
} = useTabs()

export const errorHighlights = useHighlights()
export const gotoHighlights = useHighlights<GotoMessage>()

const storageResult = useStorage(errorHighlights, tab)

export const { editor, storage, suggestionsStorage } = storageResult

// watch(() => {
//   // const cursor = cursorIndex()
//   // const line = tab()?.lines[cursor.line]

//   // const index = line ? Math.min(line.length, cursor.index) : cursor.index

//   // return { line: cursor.line, index }
// }, updateCursorSymbol)

export const goto = useGoto(gotoHighlights, storageResult)

export const showExportRegionsDialog = ref(false)

export const buildLines = ref(null as InstructionLine[] | null)
