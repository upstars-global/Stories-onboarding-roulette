<template>
  <div :class="['control-button', positionClass]">
    <svg class="stories-arrow" viewBox="0 0 24 24">
      <path
        class="stories-arrow-shape"
        d="m15.645 16.855
                     -4.714-4.861 4.714-4.861
                     a1.275 1.275 0 0 0 0-1.767
                     a1.184 1.184 0 0 0-1.713 0
                     l-5.577 5.75
                     a1.275 1.275 0 0 0 0 1.767
                     l5.577 5.75
                     c.473.49 1.239.49 1.713 0
                     .461-.488 .474-1.29 0-1.778Z"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ControlPosition } from '@/types/ui';

interface Props {
  position?: ControlPosition;
}

const props = withDefaults(defineProps<Props>(), {
  position: 'left',
});

const positionClass = computed((): string => {
  return props.position === 'left' ? 'left' : 'right';
});
</script>

<style lang="scss" scoped>
@import '@scss';

.control-button {
  display: none;
  z-index: 500;
  @include media(M) {
    cursor: pointer;
    top: 50%;
    display: flex;
    background: var(--color-tertiary-6);
    border-radius: 5vh;
    width: 5vh;
    height: 5vh;
    position: absolute;
    z-index: 100;
    justify-content: center;
    align-items: center;
    transition: all 0.3s linear;
  }
}

.left {
  left: -37vh;
  z-index: 999;
  transform-origin: center;
  transform: translateY(-50%);
}

.right {
  left: 32vh;
  z-index: 999;
  transform-origin: center;
  transform: scaleX(-1) translateY(-50%);
}

.stories-arrow {
  height: 3vh;
  width: auto;
}

.stories-arrow-shape {
  fill: var(--color-text-alt);
  transition: all 0.3s linear;
}

.control-button:hover {
  background-color: var(--color-primary-1);
}

.control-button:hover .stories-arrow-shape {
  fill: var(--color-on-light-back);
}
</style>
