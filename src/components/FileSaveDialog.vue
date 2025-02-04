<template>
  <DialogRoot v-model:open="showFileSaveDialog">
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
          Save File
        </DialogTitle>
        <DialogDescription
          class="dark:text-neutral-400 text-neutral-600 mt-[10px] mb-5 text-sm leading-normal"
        >
          Enter a name for your file below.
        </DialogDescription>
        <fieldset class="mb-[15px] flex items-center gap-5">
          <input
            v-model="fileName"
            type="text"
            placeholder="Enter file name"
            @keyup.enter="myConfirm"
            class="dark:text-neutral-200 text-neutral-800 dark:bg-neutral-800 bg-neutral-100 dark:shadow-neutral-700 shadow-neutral-300 focus:shadow-orange-400 inline-flex h-[35px] w-full flex-1 items-center justify-center rounded-lg px-[10px] text-sm leading-none shadow-[0_0_0_1px] outline-none focus:shadow-[0_0_0_2px]"
          />
        </fieldset>
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
            Save
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
} from 'reka-ui'

import { ref } from 'vue'
import { showFileSaveDialog } from '../state/state'
import { confirm } from '../utils/query/access-manager/access-manager-web'

const fileName = ref('')

const cancel = () => {
  confirm('')
}
const myConfirm = () => {
  confirm(fileName.value)
}
</script>
