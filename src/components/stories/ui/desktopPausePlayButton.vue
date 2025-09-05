<template>
  <div class="desktop-pause-play-button" @click="handleClick">
    <svg v-if="!playState" class="play-state-icon" viewBox="0 0 24 24">
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
    <svg v-else class="play-state-icon" viewBox="0 0 24 24">
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
    <div class="overlay" />
  </div>
</template>

<script setup>
const props = defineProps({
  playState: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['play', 'pause'])

const handleClick = () => {
  if (props.playState) {
    emit('play')
  } else {
    emit('pause')
  }
}
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
    height: 2.8vh;
    width: 2.8vh;
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
