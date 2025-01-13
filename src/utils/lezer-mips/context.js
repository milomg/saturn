import { StateEffect, StateField } from '@codemirror/state'
import { EditorView } from 'codemirror'
import { MipsHighlighter } from '../languages/mips/language'
const insightUpdateEffect = StateEffect.define()
// Used for deriving suggestions. Should probably be replaced with our syntax.grammar lexer soon.
// Don't really see a reason the syntax.grammar highlighter can't be used here.
const highlighter = new MipsHighlighter()
function inspect(startLine, endLine, doc) {
  const postCount = endLine - startLine + 1
  const results = []
  for (let a = 0; a < postCount; a++) {
    // Hopefully no OOB here.
    const line = startLine + a
    const details = doc.line(line)
    const result = highlighter.highlight(details.text)
    results.push(result.suggestions)
  }
  return results
}
export const suggestions = StateField.define({
  create() {
    // Assumption: Switching tabs will also create new StateFields (it almost definitely does).
    return null
  },
  update(value, tr) {
    let lines
    if (value === null) {
      // suddenly value is zero indexed
      // value.length == tr.startState.doc.lines
      lines = inspect(1, tr.startState.doc.lines, tr.startState.doc)
    } else {
      const { lines: other } = value
      lines = other
    }
    // back-to-back splices are not good, lets do everything by start index and hope they don't overlap
    // a RangeSet would probably handle ALL OF THIS for us...
    // Do we even need a RangeSet? Presumably we don't want a giant list of all insights.
    // But we do a flatMap anyway, throwing away any kind of benefit we had...
    const insightUpdates = tr.effects
      .filter((effect) => effect.is(insightUpdateEffect))
      .map((effect) => effect.value)
      .sort((a, b) => a.startLine - b.startLine)
    for (const update of insightUpdates) {
      // - 1 for 1-indexing
      lines.splice(update.startLine - 1, update.count, ...update.updates)
    }
    const all = lines.flatMap((x) => x)
    return { lines, all }
  },
})
export const suggestionsContext = [
  EditorView.updateListener.of((update) => {
    if (!update.docChanged) {
      return
    }
    const insights = []
    update.changes.iterChanges((fromA, toA, fromB, toB) => {
      const startA = update.startState.doc.lineAt(fromA).number
      const endA = update.startState.doc.lineAt(toA).number
      const startB = update.state.doc.lineAt(fromB).number
      const endB = update.state.doc.lineAt(toB).number
      // This is almost absolutely for sure supposed to be done with a RangeSet.
      // Why didn't I use a RangeSet?
      // ...
      console.assert(startA == startB)
      // we can pass these details here to an LSP if needed, we probably just want to debounce the request
      // here we will deal with them synchronously
      const count = endA - startA + 1
      const updates = inspect(startB, endB, update.state.doc)
      insights.push({
        startLine: startA,
        count,
        updates,
      })
    })
    update.view.dispatch({
      effects: insights.map((insight) => insightUpdateEffect.of(insight)),
    })
  }),
  suggestions,
]
//# sourceMappingURL=context.js.map
