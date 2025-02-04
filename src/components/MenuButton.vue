<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger>
      <button
        class="w-10 h-10 dark:hover:bg-slate-800 hover:bg-slate-300 dark:text-slate-300 text-slate-800 shrink-0 flex items-center justify-center font-black"
      >
        <Bars3Icon class="w-4 h-4" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        class="bg-neutral-200 dark:bg-neutral-900 dark:text-slate-300 text-slate-800 rounded-lg rounded-tl-none border dark:border-neutral-700 gap-2 shadow-md ml-2 p-2 text-sm w-60"
      >
        <DropdownMenuItem
          @click="showSettings = true"
          value="Settings"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <CogIcon class="w-4 h-4 m-2" />
          Settings
          <div class="ml-auto mr-1 pl-[20px] font-mono">⌘+,</div>
        </DropdownMenuItem>

        <DropdownMenuItem
          @click="showExportRegionsDialog = true"
          value="Export"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <ArrowUpLeftIcon class="w-4 h-4 m-2" />
          Export
          <div class="ml-auto mr-1 pl-[20px] font-mono">⌘+E</div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import {
  Bars3Icon,
  CogIcon,
  ArrowUpLeftIcon,
} from '@heroicons/vue/24/solid'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { showSettings, showExportRegionsDialog } from '../state/state'
</script>
