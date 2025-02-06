import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { hasActionKey } from './query/shortcut-key'
import { invoke } from '@tauri-apps/api/core'

export function setupWindow() {
  if (window.__TAURI_INTERNALS__) {
    window.addEventListener('keydown', (event) => {
      // Prevent the Ctrl + R refresh.
      if (hasActionKey(event) && event.key === 'r') {
        event.preventDefault()
      }
    })

    const handler = (event: Event) => {
      // Don't bring up the "reload" context menu. It's not great!
      event.preventDefault()
    }

    invoke('is_debug').then((debug) => {
      if (!debug) {
        window.addEventListener('contextmenu', handler)
      }
    })
  }
}

// Restricting tauri calls to certain files.
export async function closeWindow() {
  const appWindow = getCurrentWebviewWindow()
  await appWindow.close()
}
