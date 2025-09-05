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
      <source v-if="!isAndroid" :src="h265Source" type="video/mp4" codecs="h265" />
      <source :src="webmSource" type="video/webm" />
    </video>
    <div :id="`header${slideNumber}`" class="h1">{{ headerText }}</div>
    <div :id="`desk${slideNumber}`" class="h2"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  slideNumber: { type: Number, required: true },
  texts: { type: Object, required: true },
  isAndroid: { type: Boolean, required: true },
  h265Source: { type: String, required: true },
  webmSource: { type: String, required: true },
  autoplay: { type: Boolean, default: true },
  muted: { type: Boolean, default: true },
  setVideoRef: { type: Function, default: null },
})

defineEmits(['ended', 'timeupdate', 'loadedmetadata'])

const videoRef = ref(null)

const videoId = computed(() => `story_1${props.slideNumber}`)
const headerText = computed(() => props.texts[`header${props.slideNumber}`])

onMounted(() => {
  if (props.setVideoRef && videoRef.value) {
    props.setVideoRef(videoRef.value)
  }
})
</script>

<style lang="scss">
@import './Stories.scss';
</style>
