<template>
  <div class="stories-segment">
    <video
      ref="videoRef"
      :id="videoId"
      class="bg_video"
      :muted="muted"
      :autoplay="autoplay"
      playsinline
      preload="metadata"
      @ended="$emit('ended')"
      @timeupdate="$emit('timeupdate', $event)"
      @loadedmetadata="$emit('loadedmetadata')"
    >
      <source
        v-if="!isAndroid"
        :src="story.video.h265"
        type="video/mp4"
        codecs="h265"
      />
      <source :src="story.video.webm" type="video/webm" />
    </video>
    <div :id="`header${currentIndex + 1}`" class="h1">{{ headerText }}</div>
    <div :id="`desk${currentIndex + 1}`" class="h2">{{ descriptionText }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { LocaleTexts, StoryData } from '@/types';

interface Props {
  story: StoryData;
  texts: LocaleTexts;
  isAndroid: boolean;
  currentIndex: number;
  autoplay?: boolean;
  muted?: boolean;
}

const props = defineProps<Props>();

interface Emits {
  ended: [];
  timeupdate: [event: Event];
  loadedmetadata: [];
}

defineEmits<Emits>();

const videoRef = ref<HTMLVideoElement | null>(null);

const videoId = computed(() => `story_${props.currentIndex + 1}`);
const headerText = computed((): string => {
  const key = props.story.header as keyof LocaleTexts;
  const value = props.texts[key];
  return typeof value === 'string' ? value : '';
});

const descriptionText = computed((): string => {
  const key = props.story.description as keyof LocaleTexts;
  const value = props.texts[key];
  return typeof value === 'string' ? value : '';
});

defineExpose({
  videoRef,
});
</script>

<style lang="scss">
@import './stories.scss';
</style>
