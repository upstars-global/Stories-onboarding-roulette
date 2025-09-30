<template>
  <div class="top-bar">
    <div class="bar-container">
      <div class="stories-progress-bar">
        <div
          v-for="index in numberOfSegments"
          :key="index"
          class="progress-segment"
        >
          <div class="progress-line-bg"></div>
          <div
            class="progress-line"
            :style="{ width: segmentProgress(index) }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  progress: number;
  numberOfSegments: number;
  currentIndex?: number;
}

const props = withDefaults(defineProps<Props>(), {
  currentIndex: 0,
});

const segmentProgress = (index: number): string => {
  const segmentIndex = index - 1;
  if (segmentIndex < props.currentIndex) return '100%';
  if (segmentIndex > props.currentIndex) return '0%';
  return `${props.progress}%`;
};
</script>

<style lang="scss" scoped>
.top-bar {
  top: 0;
  left: 0;
  width: 100%;
  height: 3dvh;
  position: relative;
  display: flex;
  justify-content: center;
  visibility: visible;
  z-index: 10;
  pointer-events: none;
  user-select: none;
  -moz-user-select: none;
  @include media-up(md) {
    top: to-percent-y(63px, 900px);
  }
}

.bar-container {
  top: 0;
  position: relative;
  width: to-percent-x(328px);
  @include media-up(md) {
    width: to-dvh(394px, 900px);
  }
}

.stories-progress-bar {
  margin-top: to-dvh(16px);
  position: relative;
  top: 0;
  width: 100%;
  display: flex;
  z-index: 10;
  @include media-up(md) {
    width: to-dvh(394px, 900px);
    margin-top: to-dvh(24px, 900px);
  }
}

.progress-segment {
  position: relative;
  flex: 1;

  &:not(:last-child) {
    margin-right: to-dvh(4px);
    @include media-up(md) {
      margin-right: to-dvh(4px, 900px);
    }
  }
}

.progress-line-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: to-dvh(4px);
  background-color: var(--color-progress-empty);
  border-radius: $border-radius-xs;
}

.progress-line {
  position: absolute;
  top: 0;
  left: 0;
  height: to-dvh(4px);
  background-color: var(--color-progress-filled);
  border-radius: $border-radius-xs;
  transition: none;
  will-change: width;
}
</style>
