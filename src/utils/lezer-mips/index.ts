import { tags as t } from '@lezer/highlight'
import { autocompletion } from '@codemirror/autocomplete'
import {
  syntaxHighlighting,
  HighlightStyle,
} from '@codemirror/language'
import { Compartment, StateEffect, StateField } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { lang } from './stream-lang'

export const clearHighlightedLine = StateEffect.define<null>()
export const setHighlightedLine = StateEffect.define<number>()

const pausedLine = Decoration.line({
  attributes: {
    class: 'dark:bg-breakpoint-stopped bg-breakpoint-stopped-light',
  },
});

const highlightedLineState = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    if (!tr.changes.empty && value.size) {
      value = value.map(tr.changes)
    }
    for (const effect of tr.effects) {
      if (effect.is(clearHighlightedLine)) {
        value = Decoration.none
      } else if (effect.is(setHighlightedLine)) {
        value = Decoration.set([pausedLine.range(effect.value)])
      }
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

const cursor = '#fb923c'

const twHighlightStyle = HighlightStyle.define([
  { tag: [t.variableName], class: 'dark:text-white text-black' },
  { tag: [t.attributeName], class: 'dark:text-amber-400 text-amber-700' },
  { tag: [t.typeName], class: 'dark:text-orange-300 text-orange-800' },
  { tag: [t.number], class: 'dark:text-teal-300 text-teal-800' },
  { tag: [t.string], class: 'dark:text-lime-300 text-lime-800' },
  { tag: [t.keyword], class: 'dark:text-sky-400 text-sky-700' },
  { tag: [t.macroName], class: 'dark:text-red-400 text-red-700' },
  { tag: [t.lineComment], class: 'dark:text-neutral-400 text-neutral-500' },
])

export const darkTheme = EditorView.theme(
  {
    '.cm-content': {
      caretColor: cursor,
    },

    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: cursor,
      borderLeftWidth: '2px',
    },
    '.cm-gutters': {
      backgroundColor: 'inherit',
    },
    '.cm-completionDetail': {
      marginLeft: 'auto',
      color: 'rgb(115 115 115)' // text-neutral-400
    },
    '.cm-completionLabel': {
      marginRight: '1.5rem',
    },
    '.cm-tooltip-autocomplete': {
      borderRadius: '.5rem',
      border: '1px solid #333',
      backgroundColor: 'rgb(23 23 23)', // bg-neutral-900
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      padding: '.5rem',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
     backgroundColor: 'rgb(64 64 64)', // bg-neutral-700
    },
    '.cm-tooltip-autocomplete > ul > li': {
      padding: '.5rem 0px',
      borderRadius: '.25rem',
      height: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      width: '100%',
    },
  },
  { dark: true },
)

export const lightTheme = EditorView.theme(
  {
    '&': {
      fontSize: '18px',
    },

    '.cm-content': {
      caretColor: cursor,
    },

    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: cursor,
      borderLeftWidth: '2px',
    },
    '.cm-gutters': {
      backgroundColor: 'inherit',
    }
  },
  { dark: false },
)

export const editorTheme = new Compartment()

export function Mips() {
  return [
    syntaxHighlighting(twHighlightStyle),
    editorTheme.of(lightTheme),
    lang,
    autocompletion({ activateOnTyping: true }),
    highlightedLineState,
  ]
}
