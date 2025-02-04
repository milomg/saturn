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

        <DropdownMenuSeparator
          class="my-2 border-t border-neutral-300 dark:border-neutral-700"
        />

        <!-- New tab, open file, close tab -->
        <DropdownMenuItem
          @click="emit('create')"
          value="New Tab"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <FolderPlusIcon class="w-4 h-4 m-2" />
          New Tab
          <div class="ml-auto mr-1 pl-[20px] font-mono">⌘+T</div>
        </DropdownMenuItem>

        <DropdownMenuItem
          @click="openTab"
          value="Open File"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <DocumentArrowDownIcon class="w-4 h-4 m-2" />
          Open File
          <div class="ml-auto mr-1 pl-[20px] font-mono">⌘+O</div>
        </DropdownMenuItem>

        <DropdownMenuItem
          @click="saveCurrentTab"
          value="Save File"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <DocumentArrowUpIcon class="w-4 h-4 m-2" />
          Save File
          <div class="ml-auto mr-1 pl-[20px] font-mono">⌘+S</div>
        </DropdownMenuItem>

        <DropdownMenuSeparator
          class="my-2 border-t border-neutral-300 dark:border-neutral-700"
        />

        <DropdownMenuItem
          @click="build"
          value="Build"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <CogIcon class="w-4 h-4 m-2" />
          Build
          <div class="ml-auto mr-1 pl-[20px] font-mono">⌘+B</div>
        </DropdownMenuItem>

        <DropdownMenuItem
          @click="resume"
          value="Run"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <CogIcon class="w-4 h-4 m-2" />
          Run
          <div class="ml-auto mr-1 pl-[20px] font-mono">⌘+K</div>
        </DropdownMenuItem>

        <DropdownMenuItem
          @click="step"
          value="Step"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <CogIcon class="w-4 h-4 m-2" />
          Step
          <div class="ml-auto mr-1 pl-[20px] font-mono">⌘+L</div>
        </DropdownMenuItem>

        <DropdownMenuItem
          @click="pause"
          value="Pause"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <CogIcon class="w-4 h-4 m-2" />
          Pause
          <div class="ml-auto mr-1 pl-[20px] font-mono">⌘+J</div>
        </DropdownMenuItem>

        <DropdownMenuItem
          @click="stop"
          value="Stop"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <CogIcon class="w-4 h-4 m-2" />
          Stop
          <div class="ml-auto mr-1 pl-[20px] font-mono">⌘+P</div>
        </DropdownMenuItem>

        <DropdownMenuSeparator
          class="my-2 border-t border-neutral-300 dark:border-neutral-700"
        />

        <!-- Assemble elf, disassemble elf, export elf, export regions -->
        <DropdownMenuItem
          @click="showExportRegionsDialog = true"
          value="Assemble ELF"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <ArrowUpLeftIcon class="w-4 h-4 m-2" />
          Assemble ELF
        </DropdownMenuItem>

        <DropdownMenuItem
          @click="showExportRegionsDialog = true"
          value="Disassemble ELF"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <ArrowUpLeftIcon class="w-4 h-4 m-2" />
          Disassemble ELF
        </DropdownMenuItem>

        <DropdownMenuItem
          @click="showExportRegionsDialog = true"
          value="Export ELF"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <ArrowUpLeftIcon class="w-4 h-4 m-2" />
          Export ELF
        </DropdownMenuItem>

        <DropdownMenuItem
          @click="showExportRegionsDialog = true"
          value="Export Regions"
          class="dark:hover:bg-neutral-700 hover:bg-neutral-300 rounded flex items-center"
        >
          <ArrowUpLeftIcon class="w-4 h-4 m-2" />
          Export Regions
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
  FolderPlusIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
} from '@heroicons/vue/24/solid'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import {
  showSettings,
  showExportRegionsDialog,
  showFileOpenDialog,
  showFileSaveDialog,
} from '../state/state'
import { build, pause, resume, step, stop } from '../utils/debug'
import { openTab, saveCurrentTab } from '../utils/events/web-shortcuts'

const emit = defineEmits(['create'])
</script>
