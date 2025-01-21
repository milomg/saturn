import { HighlightsResult } from './highlights'
import { MarkedSuggestion, SuggestionType } from './languages/suggestions'
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
): GotoInterface {
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
