export interface Highlight {
  text: string,
  color: string
}

interface Item {
  color: string,
  next: number
}

const style = {
  comment: 'text-blue-200',
  comma: 'text-yellow-200',
  directive: 'text-red-200',
  register: 'text-orange-200',
  numeric: 'text-teal-200',
  symbol: 'text-purple-200',
  text: 'text-magenta-200',
  nothing: 'text-white'
}

// Port of https://github.com/1whatleytay/titan/blob/main/src/assembler/lexer.rs
function takeCount(input: string, index: number, take: (c: string) => boolean): number {
  let size = 0

  for (let k = index; k < input.length; k++) {
    if (!take(input[k])) {
      break
    }

    // No UTF8 worries?
    size += 1
  }

  return size
}

const allHard = new Set([
  ':', ';', ',', '.', '{', '}', '+', '-',
  '=', '/', '@', '#', '$', '%', '^', '&',
  '|', '*', '(', ')', '!', '?', '<', '>',
  '~', '[', ']', '\\', '\"', '\''
])

function isWhitespace(c: string): boolean {
  return /\s/.test(c)
}

function takeName(input: string, index: number): number {
  return takeCount(input, index, c => !allHard.has(c) && !isWhitespace(c))
}

function takeSpace(input: string, index: number): number {
  return takeCount(input, index, c => isWhitespace(c))
}

function takeSome(input: string, index: number): number {
  if (index >= input.length) {
    return 0
  }

  const some = (c: string) => allHard.has(c) || isWhitespace(c)
  const isHard = some(input[index])

  return takeCount(input, index + 1, c => some(c) == isHard) + 1
}

function takeStringBody(input: string, index: number, quote: string): number {
  let count = 0

  while (index + count < input.length) {
    const c = input[index + count]

    if (c == quote) {
      break
    } else if (c == '\\') {
      count += 1
    }

    count += 1
  }

  return count
}

function readItem(line: string, index: number): Item {
  // assert index < line.length

  const start = takeSpace(line, index)

  if (start >= line.length) {
    return {
      color: style.nothing,
      next: start
    }
  }

  const first = line[start]

  switch (first) {
    case '#': {
      const count = takeCount(line, start + 1, c => c != '\n')

      return {
        color: style.comment,
        next: start + 1 + count
      }
    }

    case '.': {
      const count = takeName(line, start + 1)

      return {
        color: style.directive,
        next: start + 1 + count
      }
    }

    case '%': {
      const count = takeName(line, start + 1)

      return {
        color: style.directive,
        next: start + 1 + count
      }
    }

    case '$': {
      const count = takeName(line, start + 1)

      return {
        color: style.register,
        next: start + 1 + count
      }
    }

    case ',':
    case '(':
    case ')':
    case ':':
      return {
        color: style.comma,
        next: start + 1
      }

    case '\'':
    case '\"': {
      const count = takeStringBody(line, start + 1, first)

      return {
        color: style.text,
        next: Math.min(start + 1 + count + 1, line.length)
      }
    }

    default: {
      const count = takeName(line, start + 1)

      if (/\d/.test(first)) {
        // digit
        return {
          color: style.numeric,
          next: start + count
        }
      } else {
        return {
          color: style.symbol,
          next: start + count
        }
      }
    }

//   '0'..='9' | '-' | '+' | '\'' => integer_literal(input)
//     .map(|(out, value)| Some((out, IntegerLiteral(value))))
// .ok_or(ImproperLiteral),
//     '\"' => string_body(after_leading, '\"')
//     .map(|(out, body)| Some((&out[1..], StringLiteral(body))))
// .ok_or(InvalidString),
  }
}

export function highlight(line: string): Highlight[] {
  const result = []

  let index = 0

  while (index < line.length) {
    const { color, next } = readItem(line, index)

    if (index === next) {
      const some = takeSome(line, next)

      result.push({
        text: line.substring(index, index + some),
        color: style.nothing
      })

      index += some
    } else {
      result.push({ text: line.substring(index, next), color })

      index = next
    }
  }

  return result
}