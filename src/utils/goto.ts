import { HighlightsResult } from './highlights'
import {
  findTokenIndex,
  MarkedSuggestion,
  SuggestionType,
} from './languages/suggestions'
import { StorageResult } from './storage'
import { SelectionIndex } from './editor'
import { Token } from './languages/language'

export interface GotoMessage {
  label: string
  line: number
  index: number
  type?: SuggestionType
}

export interface GotoInterface {
  dismiss(): void
  jump(): SelectionIndex | null
}

interface SearchStorageResult {
  suggestion: MarkedSuggestion
  line: number
}

interface GotoCache {
  line: number
  index: number // tokenIndex
  token: Token
  match: SearchStorageResult | null
}

export function useGoto(
  highlights: HighlightsResult<GotoMessage>,
  storage: StorageResult,
): GotoInterface {
  function searchStorage(
    text: string,
    body: MarkedSuggestion[][],
  ): SearchStorageResult | null {
    for (const [index, line] of body.entries()) {
      const item = line.find((x) => x.replace == text)

      if (item) {
        return { line: index, suggestion: item }
      }
    }

    return null
  }

  let cache = null as GotoCache | null

  function dismiss() {
    cache = null
    highlights.dismissHighlight()
  }

  function jump(): SelectionIndex | null {
    highlights.dismissHighlight()

    // Relying on cache is probably not great, but no point in looking up things again.
    if (!cache || !cache.match) {
      return null
    }

    return {
      line: cache.match.line,
      index: cache.match.suggestion.index,
    }
  }

  return {
    dismiss,
    jump,
  }
}
