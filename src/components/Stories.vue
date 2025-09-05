<template>
  <div ref="playerRef" class="story-container">
    <StoriesTopBar
      :progress="videoProgress"
      :number-of-segments="4"
      :current-index="videoCurrentIndex"
    />
    <div class="info_row">
      <img :src="story_icon" class="story_icon" alt="" />
      <div class="story_icon_top_text">
        <b>{{ texts.top_text }} </b>
        <br />
        <div class="icon_bottom_text" id="icon_bottom_text">
          <div id="top_text_1" v-html="currentSlideText" />
        </div>
      </div>
    </div>

    <div id="text_container_stories" class="text_container">
      <template v-for="(slide, index) in slides" :key="`slide-${index}`">
        <StorySlide
          v-if="videoCurrentIndex === index"
          :slide-number="index + 1"
          :texts="texts"
          :is-android="isAndroid"
          :h265-source="slide.h265"
          :webm-source="slide.webm"
          :autoplay="!videoPaused.value"
          :muted="videoIsMuted"
          :set-video-ref="el => setVideoRef(el, index)"
          @ended="onNext"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
        />
      </template>

      <div id="start_game_btn" class="bottom_btn" @click="goToGame">
        {{ texts.start_game }}
      </div>
    </div>

    <a @click="closeStory"
      ><div class="close_button"><CloseButton /></div
    ></a>

    <div class="pause_button">
      <desktopPausePlayButton :playState="videoPaused" @play="onPlay" @pause="onPause" />
    </div>

    <div id="story_controls" class="story_controls">
      <div @click="handlePrev">
        <mobileControlArea position="left" />
      </div>
      <div @click="handleNext">
        <mobileControlArea position="right" />
      </div>
      <div @click="onPrev"><desktopControlButton position="left" /></div>
      <div @click="onNext"><desktopControlButton position="right" /></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { onLongPress } from '@vueuse/core'

import StoriesTopBar from '@components/UI/storiesTopBar.vue'
import mobileControlArea from '@components/UI/mobileControlArea.vue'
import desktopControlButton from '@components/UI/desktopControlButton.vue'
import desktopPausePlayButton from '@components/UI/desktopPausePlayButton.vue'
import CloseButton from '@components/UI/closeButton.vue'
import StorySlide from '@components/StorySlide.vue'

import gsap from 'gsap'
import { TextPlugin } from 'gsap/TextPlugin'

import { useQueryParams } from '@/composables/useQueryParams'
import { useLocale } from '@/composables/useLocale'

import story_icon from '@/assets/images/icons/story_icon.webp'
import story_11_webm from '@/assets/videos/stories/en/story_11.webm'
import story_11_h265 from '@/assets/videos/stories/en/story_11-h265.mp4'
import story_12_webm from '@/assets/videos/stories/en/story_12.webm'
import story_12_h265 from '@/assets/videos/stories/en/story_12-h265.mp4'
import story_13_webm from '@/assets/videos/stories/en/story_13.webm'
import story_13_h265 from '@/assets/videos/stories/en/story_13-h265.mp4'

gsap.registerPlugin(TextPlugin)

let tl = gsap.timeline({
  defaults: { duration: 0.7, ease: 'power1.inOut' },
  paused: true,
})

const isAndroid = computed(() => /android/i.test(navigator.userAgent))

const currentSlideText = computed(() => {
  const keys = ['top_text11', 'top_text12', 'top_text13', 'top_text14']
  return texts.value[keys[videoCurrentIndex.value]] ?? texts.value.top_text11
})

const videoCurrentIndex = ref(0)
const videoProgress = ref(0)
const videoPaused = ref(false)
const videoIsMuted = ref(true)
const videoWasLongPress = ref(false)
const videoRefs = ref([])
const playerRef = ref(null)

const {
  userLanguage: qpLang,
  currency: qpCurrency,
  endLink: qpEnd,
  gameLink: qpGame,
} = useQueryParams()
const { texts: textsRef } = useLocale(ref(qpLang))
const texts = textsRef
const currency = ref(qpCurrency)
const end_link = ref(qpEnd)
const game_link = ref(qpGame)

const slides = [
  { h265: story_11_h265, webm: story_11_webm },
  { h265: story_12_h265, webm: story_12_webm },
  { h265: story_13_h265, webm: story_13_webm },
  { h265: story_13_h265, webm: story_13_webm },
]

const deskKeys = ['desk1', 'desk2', 'desk3', 'desk4']

const buildSlideTimeline = index => {
  const n = index + 1
  const headerSel = `#header${n}`
  const deskSel = `#desk${n}`
  const deskText = texts.value[deskKeys[index]]

  const seg = gsap.timeline()
  gsap.set([headerSel, deskSel], { opacity: 0, marginTop: '7dvh' })
  seg.to(headerSel, { opacity: 1, marginTop: '0dvh', duration: 0.4 })
  seg.to(deskSel, { opacity: 1, marginTop: '0dvh', duration: 0.4 }, '<0.1')
  seg.add(() => {
    const el = document.querySelector(deskSel)
    if (el) el.textContent = ''
  })
  seg.to(deskSel, {
    duration: 1,
    text: { value: deskText, padSpace: false, delimiter: '' },
    ease: 'none',
  })
  return seg
}

const rebuildTimelineFor = async index => {
  await nextTick()
  tl.kill()
  tl = gsap.timeline({
    defaults: { duration: 0.7, ease: 'power1.inOut' },
    paused: true,
  })
  tl.add(buildSlideTimeline(index), 0)
  if (!videoPaused.value) tl.restart(true, false)
}

const closeStory = () => {
  window.parent.postMessage('close', '*')
  if (end_link.value)
    setTimeout(() => window.parent.postMessage('go_to_link:' + end_link.value, '*'), 300)
}

const goToGame = () => {
  window.parent.postMessage('start_game_btn', '*')
  if (game_link.value)
    setTimeout(() => window.parent.postMessage('go_to_link:' + game_link.value, '*'), 300)
}

// Event handler for gift button - sends 'get_gift' message to parent window
// This function should be called when user clicks on gift/prize related buttons
const getGift = () => {
  window.parent.postMessage('get_gift', '*')
}

// Event handler for watch again button - sends 'watch_again' message to parent window
// This function should be called when user wants to replay the stories
const watchAgain = () => {
  window.parent.postMessage('watch_again', '*')
}

const setVideoRef = (el, index) => {
  if (el instanceof HTMLVideoElement) {
    videoRefs.value[index] = el
  }
}

const onPlay = () => {
  videoPaused.value = false
  const currentVideo = videoRefs.value[videoCurrentIndex.value]
  if (currentVideo) {
    currentVideo.muted = videoIsMuted.value
    currentVideo.play()
  }
  tl.play()
}

const onPause = () => {
  videoPaused.value = true
  const currentVideo = videoRefs.value[videoCurrentIndex.value]
  if (currentVideo) currentVideo.pause()
  tl.pause()
  window.parent.postMessage('click_pause', '*')
}

const onNext = () => {
  if (videoCurrentIndex.value < slides.length - 1) {
    videoCurrentIndex.value++
    videoProgress.value = 0
    window.parent.postMessage('click_forward', '*')
  }
}

const onPrev = () => {
  if (videoCurrentIndex.value > 0) {
    videoCurrentIndex.value--
    videoProgress.value = 0
    window.parent.postMessage('click_backward', '*')
  }
}

const onLoadedMetadata = () => {
  videoProgress.value = 0
}

const onTimeUpdate = e => {
  if (!videoPaused.value) {
    const video = e.target
    videoProgress.value = (video.currentTime / video.duration) * 100
  }
}

const handleLongPress = () => {
  onPause()
  videoWasLongPress.value = true
}

const handlePrev = () => {
  if (videoWasLongPress.value) return (videoWasLongPress.value = false)
  onPrev()
}

const handleNext = () => {
  if (videoWasLongPress.value) return (videoWasLongPress.value = false)
  onNext()
}

onMounted(async () => {
  await rebuildTimelineFor(0)
  videoPaused.value = false
  tl.play()

  onLongPress(playerRef, handleLongPress, {
    delay: 500,
    modifiers: { prevent: true },
    onMouseUp: ev => {
      if (videoPaused.value && ev?.target && !ev.target.closest('.pause_button')) onPlay()
    },
  })
})

onUnmounted(() => {
  tl.kill()
})

watch(videoCurrentIndex, i => {
  rebuildTimelineFor(i)
})
</script>

<style lang="scss" scoped>
@import './Stories.scss';
</style>
