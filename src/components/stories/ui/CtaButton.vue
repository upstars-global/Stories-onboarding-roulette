<template>
  <button class="call-to-action-button">
    {{ buttonText }}
  </button>
</template>

<script setup>
defineProps({
  buttonText: {
    type: String,
  },
  customPosition: {
    type: Boolean,
    default: false,
  },
});
</script>

<style lang="scss" scoped>
@import '@scss';

.call-to-action-button {
  position: absolute;
  bottom: to-percent-y(16px);
  left: 50%;
  transform: translate(-50%);
  width: to-percent-x(328px);
  height: to-dvh(40px);
  z-index: 9999;
  justify-content: center;
  align-items: center;
  border-radius: to-dvh(19px);
  background-color: var(--color-primary-1);
  color: var(--color-on-light-back);
  font-size: to-dvh(14px);
  font-family: $font-family-primary;
  font-style: normal;
  font-weight: $font-weight-bold;
  line-height: $line-height-loose;
  display: flex;
  cursor: pointer;
  border: none;
  outline: none;
  box-shadow: none;
  box-sizing: border-box;
  white-space: nowrap;
  text-align: center;
  @include media(M) {
    bottom: to-dvh(17px, 900px);
    width: to-dvh(394px, 900px);
    height: to-dvh(48.24px, 900px);
    font-size: to-dvh(17px, 900px);
  }
}
@supports (height: 100dvh) {
  .call-to-action-button {
    bottom: to-dvh(16px, 900px);
  }
}

.call-to-action-button:hover {
  background: linear-gradient(
    270deg,
    var(--color-primary-3),
    var(--color-primary-3) 100%
  );
}

.custom-layout .call-to-action-button {
  bottom: to-percent-y(70px);

  @include media(M) {
    bottom: to-dvh(62px, 900px);
  }
}
</style>
