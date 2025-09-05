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
})
</script>

<style lang="scss" scoped>
@import '@scss';

.call-to-action-button {
  position: absolute;
  z-index: 9999;
  font-family:
    Roboto Slab,
    Rubik,
    sans-serif;
  left: 50%;
  transform: translate(-50%);
  top: 90%;
  line-height: 150%;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.5rem 1.5rem;
  font-weight: $font-weight--normal;
  transition:
    box-shadow 0.15s ease-in-out,
    color 0.15s ease-in-out,
    background-color 0.15s ease-in-out;
  text-align: center;
  cursor: pointer;
  outline: none;
  box-shadow: none;
  box-sizing: border-box;
  border-radius: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: max-content;
  white-space: nowrap;
  border: none;
  color: var(--color-button-text-primary);
  background: var(--color-primary-gradient);
  padding: (0.75rem 2.5rem);
  font-size: 1.25rem;
  @include media(M) {
    top: 48rem;
    font-size: 1.25rem;
    padding: (0.75rem 5rem 0.75rem 5rem);
  }
}
.call-to-action-button:hover {
  background: linear-gradient(270deg, var(--color-primary-3), var(--color-primary-3) 100%);
}
</style>
