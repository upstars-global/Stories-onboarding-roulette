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
      @error="$emit('failed')"
    >
      <source
        v-for="source in sources"
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
import type { VideoSource } from '@/composables/useVideoFormat';

interface Props {
  story: StoryData;
  texts: { userLanguage: string };
  /** The clip's encodes this browser can play, best first. */
  sources: VideoSource[];
  currentIndex: number;
  autoplay?: boolean;
  muted?: boolean;
  videoLocked?: boolean;
  /** 0 = primary header/description, 1 = secondHeader/secondDescription */
  textPhase?: number;
}

const props = withDefaults(defineProps<Props>(), {
  textPhase: 0,
});

interface Emits {
  ended: [];
  timeupdate: [event: Event];
  loadedmetadata: [];
  /** The chosen source broke mid-decode; a missing file never gets here, the
   *  browser just moves on to the next <source>. */
  failed: [];
}

defineEmits<Emits>();

const videoRef = ref<HTMLVideoElement | null>(null);

const videoId = computed(() => `story_${props.currentIndex + 1}`);

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
