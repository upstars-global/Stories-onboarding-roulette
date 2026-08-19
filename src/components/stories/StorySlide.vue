<template>
  <div class="stories-segment">
    <video
      ref="videoRef"
      class="bg_video"
      :class="{ locked: videoLocked }"
      :id="videoId"
      :muted
      :autoplay
      playsinline
      preload="metadata"
      @ended="$emit('ended')"
      @timeupdate="$emit('timeupdate', $event)"
      @loadedmetadata="$emit('loadedmetadata')"
    >
      <source
        v-for="source in videoSources"
        :key="source.src"
        :src="source.src"
        :type="source.type"
      />
    </video>
    <div :id="`header${currentIndex + 1}`" class="h1">{{ headerText }}</div>
    <div :id="`desk${currentIndex + 1}`" class="h2">{{ descriptionText }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { StoryData } from '@/types';

interface VideoSource {
  src: string;
  type: string;
}

interface Props {
  story: StoryData;
  texts: { userLanguage: string };
  isAndroid: boolean;
  /** WebKit does not support alpha in VP9; it needs HEVC as the first source. */
  prefersH265?: boolean;
  currentIndex: number;
  autoplay?: boolean;
  muted?: boolean;
  videoLocked?: boolean;
  /** 0 = primary header/description, 1 = secondHeader/secondDescription */
  textPhase?: number;
}

const props = withDefaults(defineProps<Props>(), {
  prefersH265: false,
  textPhase: 0,
});

interface Emits {
  ended: [];
  timeupdate: [event: Event];
  loadedmetadata: [];
}

defineEmits<Emits>();

const videoRef = ref<HTMLVideoElement | null>(null);

const videoId = computed(() => `story_${props.currentIndex + 1}`);

const videoSources = computed((): VideoSource[] => {
  const webm: VideoSource = { src: props.story.video.webm, type: 'video/webm' };
  if (props.isAndroid) return [webm];

  const h265: VideoSource = {
    src: props.story.video.h265,
    type: 'video/mp4; codecs=hvc1',
  };
  return props.prefersH265 ? [h265, webm] : [webm, h265];
});

const lang = computed(() => props.texts.userLanguage);

const headerText = computed((): string => {
  if (props.textPhase === 1 && props.story.secondHeader) {
    return props.story.secondHeader[lang.value] || props.story.secondHeader.en;
  }
  return props.story.header[lang.value] || props.story.header.en;
});

const descriptionText = computed((): string => {
  if (props.textPhase === 1 && props.story.secondDescription) {
    return (
      props.story.secondDescription[lang.value] ||
      props.story.secondDescription.en
    );
  }
  return props.story.description[lang.value] || props.story.description.en;
});

defineExpose({
  videoRef,
});
</script>

<style lang="scss">
@import './stories.scss';
</style>
