<template>
  <div :class="['control-area', positionClass]" />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  position: {
    type: String,
    default: 'left',
    validator: value => ['left', 'right'].includes(value),
  },
})

const positionClass = computed(() => {
  return props.position === 'left' ? 'left' : 'right'
})
</script>

<style lang="scss" scoped>
@import '@scss';

.control-area {
  position: absolute;
  height: 100%;
  width: 50%;
  cursor: pointer;
  top: 0;
  z-index: 9996;
  user-select: none;
  @include media(M) {
    display: none;
  }
}

.left {
  left: 0;
}
.right {
  left: 50%;
}
</style>
