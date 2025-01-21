import { useSettings } from '../utils/settings'
import { useHighlights } from '../utils/highlights'
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

export const goto = useGoto(gotoHighlights)

export const showExportRegionsDialog = ref(false)

export const buildLines = ref(null as InstructionLine[] | null)
