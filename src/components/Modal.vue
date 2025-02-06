<template>
  <div
    class="fixed z-[350] w-screen h-screen bg-black bg-opacity-40 transition-opacity duration-500"
    :class="{ 'opacity-0 pointer-events-none': !show }"
    @click="emit('close')"
  />

  <div v-if="show" class="absolute z-[400] top-12 w-full pointer-events-none">
    <span class="pointer-events-auto">
      <slot />
    </span>
  </div>
</template>

<script setup lang="ts">
const { show } = defineProps<{ show: boolean }>()

const emit = defineEmits(['close'])
</script>
