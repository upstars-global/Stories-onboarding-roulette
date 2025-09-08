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
        :src="h265Source"
        type="video/mp4"
        codecs="h265"
      />
      <source :src="webmSource" type="video/webm" />
    </video>
    <div :id="`header${slideNumber}`" class="h1">{{ headerText }}</div>
    <div :id="`desk${slideNumber}`" class="h2"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { LocaleTexts } from '@/types';

interface Props {
  slideNumber: number;
  texts: LocaleTexts;
  isAndroid: boolean;
  h265Source: string;
  webmSource: string;
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

const videoId = computed(() => `story_1${props.slideNumber}`);
const headerText = computed((): string => {
  const key = `header${props.slideNumber}` as keyof LocaleTexts;
  return props.texts[key] || '';
});

defineExpose({
  videoRef,
});
</script>

<style lang="scss">
@import './stories.scss';
</style>
