<template>
  <DialogRoot v-model:open="showFileOpenDialog">
    <DialogPortal>
      <DialogOverlay
        class="fixed z-[350] w-screen h-screen bg-black bg-opacity-40 transition-opacity duration-500 data-[state=open]:opacity-100 opacity-0 inset-0"
      />
      <DialogContent
        class="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] dark:bg-neutral-900 bg-neutral-200 p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none z-[400]"
      >
        <DialogTitle
          class="dark:text-neutral-200 text-neutral-800 m-0 text-[17px] font-semibold"
        >
          Open File
        </DialogTitle>
        <DialogDescription
          class="dark:text-neutral-400 text-neutral-600 mt-[10px] mb-5 text-sm leading-normal"
        >
          Enter the name of the file you want to open below.
        </DialogDescription>

        <ComboboxRoot class="relative" v-model="fileName" :default-open="true">
          <ComboboxAnchor>
            <ComboboxInput
              class="dark:text-neutral-200 text-neutral-800 dark:bg-neutral-800 bg-neutral-100 dark:shadow-neutral-700 shadow-neutral-300 focus:shadow-orange-400 inline-flex h-[35px] w-full flex-1 items-center justify-center rounded-lg px-[10px] text-sm leading-none shadow-[0_0_0_1px] outline-none focus:shadow-[0_0_0_2px]"
            />
          </ComboboxAnchor>
          <ComboboxContent class="absolute w-full">
            <ComboboxViewport
              class="dark:bg-neutral-800 bg-neutral-100 rounded-lg p-2 mt-1 shadow-lg max-h-[300px] overflow-y-auto z-[500]"
            >
              <ComboboxEmpty
                class="text-sm dark:text-neutral-400 text-neutral-600 p-2"
                >No files found</ComboboxEmpty
              >
              <ComboboxItem
                v-for="file in myfiles"
                :key="file"
                :value="file"
                class="text-sm dark:text-neutral-200 text-neutral-800 p-2 rounded cursor-pointer outline-none dark:hover:bg-neutral-700 hover:bg-neutral-200 dark:data-[highlighted]:bg-neutral-700 data-[highlighted]:bg-neutral-200"
              >
                {{ file }}
              </ComboboxItem>
            </ComboboxViewport>
          </ComboboxContent>
        </ComboboxRoot>
        <div class="mt-[25px] flex justify-end gap-3">
          <DialogClose as-child>
            <button
              @click="cancel"
              class="dark:bg-neutral-800 bg-neutral-300 dark:text-neutral-200 text-neutral-800 dark:hover:bg-neutral-700 hover:bg-neutral-400 focus:shadow-orange-400 inline-flex h-[35px] items-center justify-center rounded-lg px-[15px] text-sm font-semibold leading-none focus:shadow-[0_0_0_2px] focus:outline-none"
            >
              Cancel
            </button>
          </DialogClose>
          <button
            @click="myConfirm"
            :disabled="!fileName"
            class="bg-orange-500 text-white hover:bg-orange-600 focus:shadow-orange-400 inline-flex h-[35px] items-center justify-center rounded-lg px-[15px] text-sm font-semibold leading-none focus:shadow-[0_0_0_2px] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Open
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxViewport,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxContent,
} from 'reka-ui'

import { onMounted, ref, watch } from 'vue'
import { showFileOpenDialog } from '../state/state'
import { confirm, getOpenableFiles } from '../utils/events/web-shortcuts'

const fileName = ref('')

const myfiles = ref<string[]>([])
const loading = ref(true)

onMounted(async () => {
  myfiles.value = await getOpenableFiles()
  loading.value = false
})

watch(showFileOpenDialog, async (value) => {
  if (value) {
    loading.value = true
    myfiles.value = await getOpenableFiles()
    loading.value = false
  }
})

const cancel = () => {
  confirm('')
}
const myConfirm = () => {
  confirm(fileName.value)
}
</script>
