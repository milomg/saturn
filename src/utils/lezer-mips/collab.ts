import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { createState, EditorTab, Tabs } from '../tabs'
import { tabsState } from '../../state/state'
import { markRaw } from 'vue'
import { ChangeSpec, Compartment, Extension } from '@codemirror/state'
import { yCollab } from 'y-codemirror.next'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { diff } from 'fast-myers-diff'

export const usercolors = [
  { color: '#30bced', light: '#30bced33' },
  { color: '#6eeb83', light: '#6eeb8333' },
  { color: '#ffbc42', light: '#ffbc4233' },
  { color: '#ecd444', light: '#ecd44433' },
  { color: '#ee6352', light: '#ee635233' },
  { color: '#9ac2c9', light: '#9ac2c933' },
  { color: '#8acb88', light: '#8acb8833' },
  { color: '#1be7ff', light: '#1be7ff33' },
]

const collabCompartment = new Compartment()

export const createCollab = (collab: Extension) => collabCompartment.of(collab)

const myname = 'Anonymous ' + Math.floor(Math.random() * 100)
const random = Math.floor(Math.random() * usercolors.length)

// select a random color for this user
export const userColor = usercolors[random]

const syncPlugin = (ytext: Y.Text) =>
  ViewPlugin.fromClass(
    class {
      constructor(public view: EditorView) {
        if (view.state.doc.toString() != ytext.toString()) {
          const ystr = ytext.toString()
          const mydiff = diff(view.state.doc.toString(), ystr)
          const changes: ChangeSpec[] = []
          for (const [sx, ex, sy, ey] of mydiff) {
            changes.push({
              from: sx,
              to: ex,
              insert: ystr.slice(sy, ey),
            })
          }
          queueMicrotask(() => {
            view.dispatch({
              changes: changes,
            })
          })
        }
      }
    },
  )

export const hostYTab = (tab: EditorTab) => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText('codemirror')
  const provider = new WebrtcProvider(tab.uuid, ydoc, {
    signaling: ['ws://localhost:4444'],
  })
  provider.awareness.setLocalStateField('user', {
    name: myname,
    color: userColor.color,
    colorLight: userColor.light,
  })
  const undoManager = new Y.UndoManager(ytext)

  if (ytext.length === 0) {
    ytext.insert(0, tab.doc)
  }

  console.log(tab.uuid)

  return collabCompartment.reconfigure([
    yCollab(ytext, provider.awareness, { undoManager }),
    syncPlugin(ytext),
  ])
}

export const joinYTab = (editor: Tabs, join: string): EditorTab => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText('codemirror')
  const provider = new WebrtcProvider(join, ydoc, {
    signaling: ['ws://localhost:4444'],
  })
  provider.awareness.setLocalStateField('user', {
    name: myname,
    color: userColor.color,
    colorLight: userColor.light,
  })
  const undoManager = new Y.UndoManager(ytext)

  const content = ytext.toString()
  const named = '(remote tab)'

  const id = join

  const state = createState(editor, id, content, true, [
    yCollab(ytext, provider.awareness, { undoManager }),
    syncPlugin(ytext),
  ])

  const tab: EditorTab = {
    uuid: id,
    title: named,
    doc: content,
    state: markRaw(state),
    removed: false,
    path: `remote://${join}`,
    writable: true,
    marked: false,
    profile: { kind: 'asm' },
  }

  return tab
}

window.join = (x: string) => {
  const tab = joinYTab(tabsState, x)

  tabsState.tabs.push(tab)
  tabsState.selected = tab.uuid
}
