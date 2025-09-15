<template>
  <div
    class="desktop-pause-play-button"
    @click.stop.prevent="handleClick"
    @mousedown.stop
    @mouseup.stop
    @touchstart.stop
    @touchend.stop
  >
    <svg v-if="paused" class="play-state-icon" viewBox="0 0 24 24">
      <path
        class="play-pause-icons"
        d="M7.546 3.109
                     a1 1 0 0 1 1.042.082
                     l11 8
                     a1 1 0 0 1 0 1.618
                     l-11 8
                     A1 1 0 0 1 7 20
                     V4
                     a1 1 0 0 1 .546-.891Z

                     M9 5.964
                     v12.072
                     L17.3 12
                     9 5.964Z"
      />
    </svg>
    <svg v-else class="play-state-icon" viewBox="0 0 24 24">
      <path
        class="play-pause-icons"
        d="M8 3
                     a1 1 0 0 0-1 1
                     v16
                     a1 1 0 1 0 2 0
                     V4
                     a1 1 0 0 0-1-1Z

                     m8 0
                     a1 1 0 0 0-1 1
                     v16
                     a1 1 0 1 0 2 0
                     V4
                     a1 1 0 0 0-1-1Z"
      />
    </svg>
    <div class="overlay" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  paused: boolean;
}

interface Emits {
  toggle: [nextPaused: boolean];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const handleClick = (): void => {
  emit('toggle', !props.paused);
};
</script>

<style lang="scss" scoped>
@import '@scss';

.desktop-pause-play-button {
  display: none;
  z-index: 500;
  @include media(M) {
    display: flex;
    position: absolute;
    top: 0;
    left: 0;
    height: to-dvh(24px, 900px);
    width: to-dvh(24px, 900px);
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
}

.play-state-icon {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: auto;
  z-index: 0;
}
.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
}

.play-pause-icons {
  fill: var(--color-text-alt);
  transition: fill 0.3s linear;
}

.desktop-pause-play-button:hover .play-pause-icons {
  fill: var(--color-text-alt);
}
</style>
