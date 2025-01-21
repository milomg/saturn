import { HighlightResult, Language, style, TokenType } from './language'
import { Suggestion } from './suggestions'

export class PlainHighlighter implements Language {
  highlight(line: string): HighlightResult {
    return {
      tokens: [
        {
          start: 0,
          text: line,
          type: TokenType.Nothing,
          color: style.nothing,
        },
      ],
      suggestions: [],
    }
  }

  inspect(): Suggestion[] {
    return []
  }

  suggest(): Suggestion[] {
    return []
  }
}
