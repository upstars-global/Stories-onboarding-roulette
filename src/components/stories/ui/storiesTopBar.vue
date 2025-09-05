<template>
  <div class="top-bar">
    <div class="bar-container">
      <div class="stories-progress-bar">
        <div v-for="index in numberOfSegments" :key="index" class="progress-segment">
          <div class="progress-line-bg"></div>
          <div class="progress-line" :style="{ width: segmentProgress(index) }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  progress: {
    type: Number,
    required: true,
  },
  numberOfSegments: {
    type: Number,
    required: true,
  },
  currentIndex: {
    type: Number,
    default: 0,
  },
})

const progressBarWidth = ref(300)

const segmentWidth = computed(() => progressBarWidth.value / props.numberOfSegments)

const segmentProgress = index => {
  const segmentIndex = index - 1
  if (segmentIndex < props.currentIndex) return '100%'
  if (segmentIndex > props.currentIndex) return '0%'
  return `${props.progress}%`
}
</script>

<style lang="scss" scoped>
@import '@scss';

.top-bar {
  top: 0;
  left: 0;
  width: 100%;
  height: 3vh;
  position: relative;
  display: flex;
  justify-content: center;
  visibility: visible;
  z-index: 10;
  pointer-events: none;
  user-select: none;
  -moz-user-select: none;
  @include media(M) {
    top: 4%;
  }
}
.bar-container {
  top: 0;
  position: relative;
  width: to-percent-x(328px);
  @include media(M) {
    width: 52vh;
  }
}

.stories-progress-bar {
  margin-top: to-vh(16px);
  position: relative;
  top: 0;
  width: 100%;
  display: flex;
  z-index: 10;
  @include media(M) {
    width: 52vh;
  }
}

.progress-segment {
  position: relative;
  flex: 1;
  margin-right: to-vh(4px);
}

.progress-line-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: to-vh(4px);
  background-color: var(--color-progress-empty);
  border-radius: to-vh(4px);
}

.progress-line {
  position: absolute;
  top: 0;
  left: 0;
  height: to-vh(4px);
  background-color: var(--color-progress-filled);
  border-radius: to-vh(4px);
  transition: width 0.05s linear; // ← добавляем для плавности
}

.profile-row {
  position: relative;
  width: 100%;
  margin-top: 0.75rem;
  @include media(M) {
    width: 52vh;
  }
}

.profile-stroke {
  position: relative;
  display: flex;
  width: 3.25rem;
  height: 3.25rem;
  justify-content: center;
  align-items: center;
  background: var(--color-primary-gradient);
  border-radius: 4rem;
  z-index: 5;
}

.story-name {
  font-family: Rubik, system-ui, sans-serif;
  letter-spacing: 0.01rem;
  position: absolute;
  font-weight: $font-weight--bold;
  font-size: 1.25rem;
  left: 4rem;
  top: 0.25rem;
  z-index: 1;
}

.story-step {
  font-family: Rubik, system-ui, sans-serif;
  position: absolute;
  font-weight: $font-weight--normal;
  font-size: 0.75rem;
  left: 4rem;
  top: 1.75rem;
  z-index: 1;
}
</style>
