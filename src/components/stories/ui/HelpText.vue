<template>
  <div class="help-text">
    <span class="help-text-main">{{ helpText }}</span>
    <a href="#" class="help-text-link">{{ helpLink }}</a>
  </div>
</template>

<script setup>
defineProps({
  helpText: {
    type: String,
    required: true,
  },
  helpLink: {
    type: String,
    required: true,
  },
});
</script>

<style lang="scss" scoped>
@import '@scss';

.help-text {
  position: absolute;
  bottom: to-dvh(16px);
  left: 50%;
  transform: translate(-50%);
  z-index: 9999;
  width: 100%;
  font-family: $font-family-primary;
  font-size: to-dvh(14px);
  font-style: normal;
  text-align: center;
  line-height: $line-height-loose;
}

.help-text-main {
  display: block;
  color: var(--color-text-alt, #f7f7f7);
  text-align: center;
  font-size: to-dvh(14px);
  font-style: normal;
  font-weight: $font-weight-normal;
}

.help-text-link {
  display: block;
  color: var(--color-text-link-default, #00eda6);
  font-weight: $font-weight-bold;
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: none;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}
</style>
