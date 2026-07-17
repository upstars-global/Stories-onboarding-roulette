<template>
  <button
    class="call-to-action-button"
    :class="{ 'call-to-action-button--custom': customPosition }"
  >
    {{ buttonText }}
  </button>
</template>

<script setup>
defineProps({
  buttonText: {
    type: String,
  },
  // When true (help-text slide), lift button just above the help row.
  customPosition: {
    type: Boolean,
    default: false,
  },
});
</script>

<style lang="scss" scoped>
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
  @include media-up(md) {
    bottom: to-dvh(17px, 900px);
    width: to-dvh(394px, 900px);
    height: to-dvh(48.24px, 900px);
    font-size: to-dvh(17px, 900px);
  }
}

@supports (height: 100dvh) {
  .call-to-action-button:not(.call-to-action-button--custom) {
    bottom: to-dvh(16px);
  }
}

.call-to-action-button:hover {
  background: linear-gradient(
    270deg,
    var(--color-primary-3),
    var(--color-primary-3) 100%
  );
}

// Help-text slide: clear the help row + small breathing gap above help-text,
// while staying low enough not to cover video art. Legacy to-percent-y(70px)
// ≈ 17% of frame was far too high; 52px lifts button ~12px above help-text row.
.custom-layout .call-to-action-button,
.call-to-action-button--custom {
  bottom: to-percent-y(52px);

  @include media-up(md) {
    bottom: to-dvh(52px, 900px);
  }
}

@supports (height: 100dvh) {
  .custom-layout .call-to-action-button,
  .call-to-action-button--custom {
    bottom: to-dvh(52px);

    @include media-up(md) {
      bottom: to-dvh(52px, 900px);
    }
  }
}
</style>
