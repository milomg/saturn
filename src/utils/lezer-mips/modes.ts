import { Compartment } from '@codemirror/state'
import { showMinimap } from '@replit/codemirror-minimap'
import { vim as vimSetup } from '@replit/codemirror-vim'

export const vimCompartment = new Compartment()
export const minimapCompartment = new Compartment()

export const vim = vimSetup()

export const setVim = (value: boolean) =>
  vimCompartment.reconfigure(value ? vim : [])

export const minimap = showMinimap.compute(['doc'], () => {
  return {
    create: () => {
      const dom = document.createElement('div')
      return { dom }
    },
    displayText: 'blocks',
    showOverlay: 'always',
  }
})

export const setMinimap = (value: boolean) =>
  minimapCompartment.reconfigure(value ? minimap : [])
