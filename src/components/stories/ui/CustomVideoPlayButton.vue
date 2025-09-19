<template>
  <div
    class="play-button"
    @click.stop.prevent="handleClick"
    @mousedown.stop
    @mouseup.stop
    @touchstart.stop
    @touchend.stop
  >
    <svg class="play-icon" viewBox="0 0 24 24">
      <path
        class="play-icon-path"
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

<script setup lang="ts">
interface Emits {
  play: [];
}

const emit = defineEmits<Emits>();

const handleClick = (): void => {
  emit('play');
};
</script>

<style lang="scss" scoped>
@import '@scss';

.play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: $z-max;
  display: flex;
  justify-content: center;
  align-items: center;
  width: to-dvh(50px);
  height: to-dvh(50px);
  background: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  @include media(M) {
    width: to-dvh(50px, 900px);
    height: to-dvh(50px, 900px);
  }
}

.play-button:hover {
  background: rgba(0, 0, 0, 0.5);
  transform: translate(-50%, -50%) scale(1.1);
}

.play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: to-dvh(24px);
  height: to-dvh(24px);
  z-index: 1;
  @include media(M) {
    width: to-dvh(24px, 900px);
    height: to-dvh(24px, 900px);
  }
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  z-index: 2;
}

.play-icon-path {
  fill: #ffffff;
  transition: fill 0.3s linear;
}

/* Custom video play button fade-scale transition */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
