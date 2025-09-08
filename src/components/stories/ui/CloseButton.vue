<template>
  <div class="close-button">
    <img class="icon-itself full_size" :src="close_btn" alt="Close button" />
  </div>
</template>

<script setup lang="ts">
const close_btn: string = '/src/assets/images/icons/close.svg';
</script>

<style lang="scss" scoped>
@import '@scss';

.close-button {
  position: absolute;
  display: flex;
  top: to-vh(3px);
  left: 0;
  width: to-vh(24px);
  height: to-vh(24px);
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: $z-max;
  @include media(M) {
    top: 0;
    left: 0;
    height: 3vh;
    width: 3vh;
  }
}

.full_size {
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.icon-itself {
  fill: var(--color-text-alt);
  transition: fill 0.3s linear;
}

.close-button:hover .icon-itself {
  fill: var(--color-primary-1);
  filter: hue-rotate(252deg) brightness(1.5);
}
</style>
