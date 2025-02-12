<template>
  <div v-if="profile ?? false" class="flex items-center">
    <button
      v-if="!consoleData.execution && tab()?.profile?.kind === 'asm'"
      class="w-10 h-10 dark:hover:bg-slate-800 hover:bg-slate-300 shrink-0 flex items-center justify-center font-black dark:text-sky-300 text-sky-700"
      @click="build()"
      title="Build"
    >
      <ArrowDownIcon class="w-4 h-4" />
    </button>

    <button
      v-if="!!consoleData.execution"
      class="w-10 h-10 dark:hover:bg-slate-800 hover:bg-slate-300 shrink-0 flex items-center justify-center font-black dark:text-red-300 text-red-700"
      @click="stop()"
      title="Stop"
    >
      <StopIcon class="w-4 h-4" />
    </button>

    <button
      v-if="!!consoleData.execution"
      class="w-10 h-10 dark:hover:bg-slate-800 hover:bg-slate-300 shrink-0 flex items-center justify-center font-black dark:text-yellow-200 text-yellow-800"
      @click="pause()"
      title="Pause"
    >
      <PauseIcon class="w-4 h-4" />
    </button>

    <button
      v-if="!!consoleData.execution && consoleData.execution.timeTravel"
      class="w-10 h-10 shrink-0 flex items-center justify-center font-black"
      @click="rewind()"
      :class="{
        'dark:text-gray-300 text-gray-700 cursor-default': !allowRewind,
        'dark:text-teal-300 text-teal-700 dark:hover:bg-slate-800 hover:bg-slate-300':
          allowRewind,
      }"
      :disabled="!allowRewind"
      title="Step Back"
    >
      <ChevronLeftIcon class="w-4 h-4" />
    </button>

    <button
      v-if="!!consoleData.execution"
      class="w-10 h-10 shrink-0 flex items-center justify-center font-black"
      @click="step()"
      :class="{
        'dark:text-gray-300 text-gray-700 cursor-default': !allowResume,
        'dark:text-teal-300 text-teal-700 dark:hover:bg-slate-800 hover:bg-slate-300':
          allowResume,
      }"
      :disabled="!allowResume"
      title="Step"
    >
      <ChevronRightIcon class="w-4 h-4" />
    </button>

    <button
      class="w-10 h-10 shrink-0 flex items-center justify-center font-black"
      :class="{
        'dark:text-gray-300 text-gray-700 cursor-default dark:bg-neutral-800 bg-neutral-400':
          !allowResume,
        'dark:text-green-300 text-green-700 dark:hover:bg-slate-800 hover:bg-slate-300':
          allowResume,
      }"
      @click="resume()"
      :disabled="!allowResume"
      title="Run"
    >
      <PlayIcon class="w-4 h-4" />
    </button>

    <div
      v-if="profileText"
      class="h-10 px-4 flex items-center text-xs font-medium max-w-xs text-neutral-600 shrink-0"
    >
      {{ profileText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { consoleData } from '../state/console-data'
import {
  build,
  pause,
  resume,
  step,
  rewind,
  stop,
  allowResume,
  allowRewind,
} from '../utils/debug'
import { tab } from '../state/state'

import {
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/vue/24/solid'

const profile = computed(() => tab()?.profile)

const profileText = computed((): string | null => {
  switch (profile.value?.kind) {
    case 'asm':
      return 'MIPS Assembly'
    case 'elf':
      return 'ELF Debug'
  }

  return null
})
</script>
