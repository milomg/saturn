import * as repl from 'repl'
import { consumeBackwards } from './alt-consume'

export interface SelectionIndex {
  line: number,
  index: number
}

export interface SelectionRange {
  startLine: number
  startIndex: number
  endLine: number
  endIndex: number
}

type LineData = string[]

interface UndoProvider {
  undo(data: LineData): LineData
}

class FullFrame implements UndoProvider {
  type: 'full' = 'full'

  undo(data: LineData): LineData {
    return this.lines
  }

  constructor(public lines: string[]) { }
}

class ReplaceFrame implements UndoProvider {
  type: 'replace' = 'replace'

  undo(data: LineData): LineData {
    const value = data.slice()

    value.splice(this.index, this.replaced, ...this.deleted)

    return value
  }

  constructor(
    public index: number, // line # where lines are deleted
    public deleted: string[],
    public replaced: number // # of lines
  ) { }
}

type Operation = FullFrame | ReplaceFrame
type Step = { op: Operation, cursor: SelectionIndex }

interface MergeResult {
  commit?: Operation
  merged: Operation
}

function collides(s1: number, e1: number, s2: number, e2: number) {
  return s1 <= e2 && s2 <= e1
}

function mergeReplaces(last: ReplaceFrame, next: ReplaceFrame): MergeResult {
  const lastStart = last.index
  const lastEnd = last.index + last.replaced
  const nextStart = next.index
  const nextEnd = next.index + next.deleted.length

  // Common Case
  if (lastStart == nextStart && last.replaced == next.deleted.length) {
    return { merged: last }
  }

  // Regular Case
  if (!collides(lastStart, lastEnd, nextStart, nextEnd)) {
    return { commit: last, merged: next }
  }

  const leadingSize = Math.max(0, last.index - next.index)
  const collidingSize = Math.max(0, Math.min(lastEnd, nextEnd) - Math.max(lastStart, nextStart))
  const leading = next.deleted.slice(0, leadingSize)
  const trailing = next.deleted.slice(leadingSize + collidingSize)

  const replaced = last.replaced + next.replaced - collidingSize
  const deleted = leading.concat(last.deleted).concat(trailing)

  const start = Math.min(last.index, next.index)

  return { merged: new ReplaceFrame(start, deleted, replaced) }
}

// Moves last, next
function merge(last: Operation, next: Operation): MergeResult {
  switch (last.type) {
    case 'full':
      return { merged: last }

    case 'replace':
      switch (next.type) {
        case 'full':
          next.lines = last.undo(next.lines)

          return { merged: next }

        case 'replace':
          return mergeReplaces(last, next)
      }
  }
}

export class Editor {
  current: Step | null = null
  operations: Step[] = []

  timeout: number | null = null
  uncommitted: number = 0

  lastLines: LineData | null = null

  private commit() {
    this.uncommitted = 0

    if (this.current) {
      this.operations.push(this.current)

      if (this.operations.length > this.backlog) {
        this.operations = this.operations.splice(
          0, this.operations.length - this.backlog
        )
      }

      this.current = null
    }
  }

  public push(step: Step) {
    // Assuming merging was properly done.
    this.current = step
    this.uncommitted++

    if (this.timeout) {
      window.clearTimeout(this.timeout)
    }

    if (this.uncommitted > this.commitInterval) {
      this.commit()
    } else {
      this.timeout = window.setTimeout(() => {
        this.commit()
      }, this.debounce)
    }
  }

  private mergedCursor() {
    // Not moved, kinda freaky!
    const lastCursor = this.current?.cursor

    if (lastCursor) {
      return lastCursor
    } else {
      const cursor = this.cursor()

      return {
        line: cursor.line,
        index: cursor.index
      }
    }
  }

  public frame() {
    this.push({
      op: new FullFrame(this.data.slice()),
      cursor: this.mergedCursor()
    })
  }

  public dirty(line: number, count: number, insert?: number) {
    const backup = this.data.slice(line, line + count)

    this.push({
      op: new ReplaceFrame(line, backup, insert ?? count), // replace with self
      cursor: this.mergedCursor()
    })
  }

  popStep(): Step | null {
    if (this.current) {
      const result = this.current

      this.current = null

      return result
    } else {
      return this.operations.pop() ?? null
    }
  }

  public undo(): { data: LineData, cursor: SelectionIndex } | null {
    const step = this.popStep()

    if (!step) {
      return null
    }

    return { data: step.op.undo(this.data), cursor: step.cursor }
  }

  public clear() {
    this.current = null
    this.operations = []
  }


  drop(range: SelectionRange) {
    // assert range.startLine >= range.endLine
    if (range.startLine == range.endLine) {
      const text = this.data[range.startLine]

      this.data[range.startLine] = text.substring(0, range.startIndex) + text.substring(range.endIndex)
    } else {
      const leading = this.data[range.startLine].substring(0, range.startIndex)
      const trailing = this.data[range.endLine].substring(range.endIndex)
      this.data[range.startLine] = leading + trailing

      // splice with multiple deleteCount seems bugged
      for (let a = range.startLine + 1; a <= range.endLine; a++) {
        this.data.splice(range.startLine + 1, 1)
      }
    }
  }

  put(index: SelectionIndex, character: string) {
    const line = this.data[index.line]
    const leading = line.substring(0, index.index)
    const trailing = line.substring(index.index)

    // Mutate
    this.data[index.line] = leading + character + trailing
  }

// Technical Debt: insert vs paste (concern: speed for splitting by \n)
  paste(index: SelectionIndex, text: string) {
    const textLines = text.split('\n')

    if (!textLines.length) {
      return
    }

    if (textLines.length === 1) {
      return this.put(index, text)
    }

    // at least two lines

    const line = this.data[index.line]
    const leading = line.substring(0, index.index)
    const trailing = line.substring(index.index)

    const first = textLines[0]
    const rest = textLines.slice(1)
    // const last = textLines[textLines.length - 1]
    rest[rest.length - 1] += trailing

    // Mutate
    this.data[index.line] = leading + first
    this.data.splice(index.line + 1, 0, ...rest)
  }

  dropTab(line: number, spacing: number): number {
    const regex = new RegExp(`^(\\s{0,${spacing}}|\\t)`, 'g')
    const match = this.data[line].match(regex)

    if (match && match.length) {
      const text = match[0]

      this.data[line] = this.data[line].substring(text.length)

      return text.length
    }

    return 0
  }

  newline(index: SelectionIndex) {
    const line = this.data[index.line]
    const leading = line.substring(0, index.index)
    const trailing = line.substring(index.index)

    const leadingSpacing = /^\s*/g
    const match = line.match(leadingSpacing)
    const endMatch = trailing.match(leadingSpacing)

    const spacing = match && match.length ? match[0] : ''
    const noSpace = endMatch && endMatch.length ? trailing.substring(endMatch[0].length) : trailing

    // Mutate
    this.data[index.line] = leading
    this.data.splice(index.line + 1, 0, spacing + noSpace)
  }

  backspace(index: SelectionIndex, alt: boolean = false) {
    const line = this.data[index.line]

    if (index.index > 0) {
      const consumption = alt ? consumeBackwards(line, index.index) : 1

      const leading = line.substring(0, index.index - consumption)
      const trailing = line.substring(index.index)

      // Mutate
      this.data[index.line] = leading + trailing
    } else if(index.line > 0) {
      const leading = this.data[index.line - 1]
      const trailing = this.data[index.line]

      this.data[index.line - 1] = leading + trailing

      this.data.splice(index.line, 1)
    }
  }

  // Immutable Line Methods
  grab(range: SelectionRange): string {
    // assert range.startLine >= range.endLine
    if (range.startLine == range.endLine) {
      const text = this.data[range.startLine]

      return text.substring(range.startIndex, range.endIndex)
    } else {
      const leading = this.data[range.startLine].substring(range.startIndex)
      const middle = this.data.slice(range.startLine + 1, range.endLine)
      const trailing = this.data[range.endLine].substring(0, range.endIndex)

      return [leading, ...middle, trailing].join('\n')
    }
  }

  lineCount(): number {
    return this.data.length
  }

  lineAt(index: number): string {
    return this.data[index]
  }

  constructor(
    public data: LineData,
    public cursor: () => SelectionIndex,
    private backlog: number = 50,
    private debounce: number = 800,
    private commitInterval: number = 30
  ) { }
}
