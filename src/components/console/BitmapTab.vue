<template>
  <div
    class="text-sm overflow-auto flex whitespace-pre content-start p-2 w-full h-full"
  >
    <div
      class="p-4 flex flex-col content-center mr-auto"
      :class="{ 'sm:block': !state.small }"
    >
      <div class="text-base font-bold mb-4 flex items-center">
        Bitmap Display
      </div>

      <div class="dark:text-neutral-300 text-neutral-700 ml-2">
        <div class="py-1">
          <label class="inline-block font-bold pr-4 w-32">Display Width</label>

          <NumberField
            v-model="settings.bitmap.displayWidth"
            :clean-only="true"
            :checker="sizeCheck"
            classes="text-xs w-32"
          />

          <span
            class="dark:text-neutral-400 text-neutral-600 mx-3 text-xs font-bold"
          >
            Units
          </span>

          <NumberField
            v-model="settings.bitmap.unitWidth"
            :clean-only="true"
            :checker="unitCheck"
            classes="text-xs w-20"
          />
        </div>

        <div class="py-1">
          <label class="inline-block font-bold pr-4 w-32">Display Height</label>

          <NumberField
            v-model="settings.bitmap.displayHeight"
            :clean-only="true"
            :checker="sizeCheck"
            classes="text-xs w-32"
          />

          <span
            class="dark:text-neutral-400 text-neutral-600 mx-3 text-xs font-bold"
          >
            Units
          </span>

          <NumberField
            v-model="settings.bitmap.unitHeight"
            :clean-only="true"
            :checker="unitCheck"
            classes="text-xs w-20"
          />
        </div>

        <div class="py-1">
          <label class="inline-block font-bold pr-4 w-32">Address</label>
          <NumberField
            v-model="settings.bitmap.address"
            :hex="true"
            :checker="memoryCheck"
            :editable="settings.bitmap.register === undefined"
            :classes="`text-xs w-32 ${settings.bitmap.register !== undefined ? 'opacity-30' : ''}`"
          />

          <button
            class="rounded px-2 py-1 border border-neutral-700 font-bold text-xs ml-4 dark:active:bg-slate-700 active:bg-slate-400"
            :class="{
              'dark:bg-slate-800 bg-slate-300':
                settings.bitmap.register !== undefined,
              'dark:hover:bg-neutral-800':
                settings.bitmap.register === undefined,
            }"
            @click="selectGp"
          >
            $gp
          </button>
        </div>
      </div>

      <div
        v-if="state.keyboardLive"
        class="text-gray-500 mt-4 flex items-center"
      >
        <ArrowRightIcon class="w-4 h-4 mr-2" />

        Press keys now to create keyboard events.
      </div>

      <div v-else class="text-neutral-500 mt-4 flex items-center">
        <ArrowRightIcon class="w-4 h-4 mr-2" />

        To connect the keyboard, click on the display.
      </div>

      <div
        v-if="!state.useProtocol"
        class="text-neutral-500 pt-4 flex items-center mt-auto"
      >
        <ExclamationCircleIcon class="w-6 h-6 mr-2" />

        <div>
          <div>Using fallback protocol. Performance may be affected.</div>

          <div>
            Please file a bug at
            <a
              target="_blank"
              href="https://github.com/1whatleytay/saturn"
              class="underline hover:text-gray-300"
            >
              https://github.com/1whatleytay/saturn </a
            >.
          </div>
        </div>
      </div>
    </div>

    <div
      ref="wrapper"
      @click="focusSelf"
      @focusin="state.keyboardLive = true"
      @focusout="state.keyboardLive = false"
      @keydown="(e) => handleKey(e, false)"
      @keyup="(e) => handleKey(e, true)"
      tabindex="0"
      class="outline-none overflow-visible focus:ring-4 border border-neutral-700 rounded h-full shrink-0 max-w-3/4 self-end"
      :style="{ width: `${correctedWidth}px` }"
    >
      <canvas
        ref="canvas"
        class="w-full h-full bitmap-display rounded"
        :width="config.width"
        :height="config.height"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import { ArrowRightIcon } from '@heroicons/vue/24/solid'
import { ExclamationCircleIcon } from '@heroicons/vue/24/outline'
import { consoleData } from '../../state/console-data'
import { backend } from '../../state/backend'

import { settings } from '../../state/state'
import NumberField from './NumberField.vue'
import { displayConfig } from '../../utils/settings'
import { MipsExecution } from '../../utils/mips/mips'

const gpRegisterNumber = 28

function selectGp() {
  if (settings.bitmap.register !== undefined) {
    settings.bitmap.register = undefined
  } else {
    settings.bitmap.register = gpRegisterNumber
  }
}

const wrapper = ref(null as HTMLElement | null)
const canvas = ref(null as HTMLCanvasElement | null)

const config = computed(() => displayConfig(settings.bitmap))

let lastHeight = config.value.height
const correctedWidth = ref(config.value.width)

const state = reactive({
  interval: null as number | null,
  small: false as boolean,
  useProtocol: true,
  keyboardLive: false,
})

function memoryCheck(value: number): string | null {
  if ((value & 0b11) !== 0) {
    return 'This field must be divisible by 4'
  }

  if (value < 0 || value > 0xffffffff) {
    return 'This field must be in the 32-bit address range'
  }

  return null
}

function sizeCheck(value: number): string | null {
  if (value <= 0 || value > 512) {
    return 'This field must be in the 1-512 range'
  }

  return null
}

function unitCheck(value: number): string | null {
  if (value <= 0 || value > 32) {
    return 'This field must be in the 1-32 range'
  }

  return null
}

function mapKey(key: string): string | null {
  const lower = key.toLowerCase()

  if (lower.length <= 1) {
    return lower
  } else {
    switch (key) {
      case 'Enter':
        return '\n'
      case 'Space':
        return ' '
      default:
        return null
    }
  }
}

async function handleKey(event: KeyboardEvent, up: boolean) {
  if (!consoleData.execution) {
    return
  }

  const mapped = mapKey(event.key)

  if (mapped !== null) {
    await consoleData.execution.postKey(mapped, up)
  }
}

function focusSelf() {
  wrapper.value?.focus()
}

let observer = null as ResizeObserver | null

function fixWidth(height: number) {
  const width = (height / config.value.height) * config.value.width

  lastHeight = height

  state.small = height < 140

  // Should not re-trigger this statement.
  correctedWidth.value = width
}

function recheckWidth() {
  if (wrapper.value) {
    fixWidth(wrapper.value.clientHeight)
  }
}

onMounted(() => {
  reloadDisplay()
  checkConnected()

  observer = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target.clientHeight != lastHeight) {
        setTimeout(() => fixWidth(entry.target.clientHeight))
      }
    })
  })

  if (wrapper.value) {
    fixWidth(wrapper.value.clientHeight)

    observer.observe(wrapper.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()

  if (state.interval) {
    window.clearInterval(state.interval)
  }
})

watch(() => settings.bitmap, recheckWidth, { deep: true })

function checkConnected() {
  if (consoleData.execution) {
    inflight = false
    state.interval = window.setInterval(() => {
      reloadDisplay()
    }, 20)
  } else {
    inflight = false
    reloadDisplay()

    if (state.interval) {
      window.clearInterval(state.interval)
      state.interval = null
    }
  }
}

watch(() => consoleData.execution, checkConnected)

async function renderFrameFallback(
  context: CanvasRenderingContext2D,
  execution: MipsExecution,
) {
  const { width, height, address } = config.value

  const memory = await execution.memoryAt(address, width * height * 4)

  const pixels = width * height * 4

  if (!memory || memory.length !== pixels) {
    console.error('No memory at address')
    return
  }

  const mappedMemory = memory.map((byte) => byte ?? 0)

  const data = context.createImageData(width, height)

  for (let pixel = 0; pixel < width * height; pixel++) {
    const i = pixel * 4
    data.data[i] = mappedMemory[i + 2]
    data.data[i + 1] = mappedMemory[i + 1]
    data.data[i + 2] = mappedMemory[i]
    data.data[i + 3] = 255
  }

  context.putImageData(data, 0, 0)
}

function renderOrdered(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  memory: Uint8Array,
) {
  const data = context.createImageData(width, height)

  for (let a = 0; a < memory.length; a++) {
    data.data[a] = memory[a]
  }

  context.putImageData(data, 0, 0)
}

async function renderFrameProtocol(context: CanvasRenderingContext2D) {
  const { width, height, address, register } = config.value

  if (consoleData.execution) {
    const memory = await consoleData.execution.readDisplay(
      width,
      height,
      address,
      register,
    )

    if (memory) {
      renderOrdered(context, width, height, memory)
    }
  }
}

async function renderLastDisplay(context: CanvasRenderingContext2D) {
  const last = await backend.lastDisplay()

  // No data, don't render.
  if (!last.data) {
    return
  }

  renderOrdered(context, last.width, last.height, Uint8Array.from(last.data))
}

let inflight = false

async function reloadDisplay() {
  if (inflight) {
    return
  }

  inflight = true

  try {
    const context = canvas.value?.getContext('2d')
    const execution = consoleData.execution

    if (!context) {
      return
    }

    if (!execution) {
      return await renderLastDisplay(context)
    }

    if (state.useProtocol) {
      try {
        await renderFrameProtocol(context)
      } catch (e) {
        console.error(e)

        state.useProtocol = false
        await renderFrameFallback(context, execution)
      }
    } else {
      await renderFrameFallback(context, execution)
    }
  } catch (e) {}

  inflight = false
}
</script>

<style scoped>
.bitmap-display {
  image-rendering: pixelated;
}
</style>
