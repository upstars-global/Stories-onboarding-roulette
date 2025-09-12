<template>
  <div class="story-container">
    <StoriesTopBar
      :progress="progress"
      :number-of-segments="numberOfSegments"
      :current-index="currentIndex"
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

    <div
      id="text_container_stories"
      class="text_container"
      :class="{ 'custom-layout': currentIndex === 3 }"
    >
      <template v-for="(story, index) in stories" :key="`story-${index}`">
        <StorySlide
          v-if="currentIndex === index"
          :ref="(el: unknown) => setVideoRef(el as StorySlideRef | null, index)"
          :slide-number="index + 1"
          :texts="texts"
          :is-android="isAndroid"
          :h265-source="story.h265"
          :webm-source="story.webm"
          :autoplay="!isPaused"
          :muted="isMuted"
          @ended="onNext"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
        />
      </template>

      <CtaButton
        :button-text="
          currentIndex === 3 ? texts.cta_button_text : texts.start_game
        "
        @click="goToGame"
      />

      <div v-if="currentIndex === 3" class="help-text">
        {{ texts.help_text }}
        <a href="#" class="help-text-link">{{ texts.help_link }}</a>
      </div>
    </div>

    <a @click="closeStory">
      <div class="close_button"><CloseButton /></div>
    </a>

    <div class="mute_button">
      <MuteButton :muted="isMuted" @toggle="onToggleMute" />
    </div>

    <div class="pause_button">
      <DesktopPausePlayButton
        :paused="isPaused"
        @toggle="(val) => (val ? onPause() : onPlay())"
      />
    </div>

    <div id="story_controls" class="story_controls">
      <MobileControlArea
        ref="leftControlRef"
        position="left"
        @click="handlePrev"
      />
      <MobileControlArea
        ref="rightControlRef"
        position="right"
        @click="handleNext"
      />
      <DesktopControlButton position="left" @click="onPrev" />
      <DesktopControlButton position="right" @click="onNext" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  watch,
  computed,
  onMounted,
  onUnmounted,
  nextTick,
  type Ref,
} from 'vue';
import { onLongPress } from '@vueuse/core';
import type { Story, LocaleTexts, VideoElement, StorySlideRef } from '@/types';

import {
  StoriesTopBar,
  MobileControlArea,
  DesktopControlButton,
  DesktopPausePlayButton,
  MuteButton,
  CtaButton,
  CloseButton,
} from '@components/stories/ui';
import StorySlide from '@components/stories/StorySlide.vue';

import gsap from 'gsap';
import { TextPlugin } from 'gsap/TextPlugin';

import { useQueryParams } from '@/composables/useQueryParams';
import { useLocale } from '@/composables/useLocale';

import story_icon from '@/assets/images/icons/story_icon.webp';
import story_1_webm from '@/assets/videos/stories/en/story_1.webm';
import story_1_h265 from '@/assets/videos/stories/en/story_1-h265.mp4';
import story_2_webm from '@/assets/videos/stories/en/story_2.webm';
import story_2_h265 from '@/assets/videos/stories/en/story_2-h265.mp4';
import story_3_webm from '@/assets/videos/stories/en/story_3.webm';
import story_3_h265 from '@/assets/videos/stories/en/story_3-h265.mp4';
import story_4_webm from '@/assets/videos/stories/en/story_4.webm';
import story_4_h265 from '@/assets/videos/stories/en/story_4-h265.mp4';

gsap.registerPlugin(TextPlugin);

let tl = gsap.timeline({
  defaults: { duration: 0.7, ease: 'power1.inOut' },
  paused: true,
});

const isAndroid = computed(() => /android/i.test(navigator.userAgent));

const currentSlideText = computed(() => {
  const keys: (keyof LocaleTexts)[] = [
    'top_text1',
    'top_text2',
    'top_text3',
    'top_text4',
  ];
  const key = keys[currentIndex.value];
  return key ? texts.value[key] : texts.value.top_text1;
});

const currentIndex = ref<number>(0);
const progress = ref<number>(0);

// === SMOOTH PROGRESS BAR IMPLEMENTATION ===
// Instead of using rare 'timeupdate' events (4-5 times per second),
// we use requestVideoFrameCallback to sync progress with actual video frames.
// This provides smooth 24-60fps progress updates like in Instagram/TikTok.

type RVFC = () => number;
let rvfcCancel: (() => void) | null = null;
let rafId: number | null = null;

/**
 * Stops all progress tracking loops (both rVFC and rAF)
 * Called when pausing video or switching slides
 */
function stopProgressLoop() {
  if (rvfcCancel) {
    rvfcCancel();
    rvfcCancel = null;
  }
  if (rafId != null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/**
 * Starts smooth progress tracking for a specific video element
 * Uses requestVideoFrameCallback for frame-perfect sync, falls back to rAF
 * @param video - The video element to track progress for
 */
function startProgressLoopFor(video: HTMLVideoElement) {
  stopProgressLoop();

  // Check if browser supports requestVideoFrameCallback (Chrome 83+, Safari 15.4+)
  const hasRVFC =
    typeof (
      video as HTMLVideoElement & {
        requestVideoFrameCallback?: RVFC;
      }
    ).requestVideoFrameCallback === 'function';

  if (hasRVFC) {
    // Use requestVideoFrameCallback for perfect frame sync
    const v = video as HTMLVideoElement & {
      requestVideoFrameCallback: RVFC;
      // eslint-disable-next-line no-unused-vars
      cancelVideoFrameCallback?: (_: number) => void;
    };
    let handle = 0;
    const tick = () => {
      if (isPaused.value) return;
      const d = video.duration || 0;
      if (d > 0) progress.value = (video.currentTime / d) * 100;
      handle = v.requestVideoFrameCallback(tick);
    };
    handle = v.requestVideoFrameCallback(tick);
    rvfcCancel = () => {
      v.cancelVideoFrameCallback?.(handle);
    };
  } else {
    // Fallback: use requestAnimationFrame for 60fps updates
    const tick = () => {
      if (isPaused.value) {
        rafId = null;
        return;
      }
      const d = video.duration || 0;
      if (d > 0) progress.value = (video.currentTime / d) * 100;
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
  }
}
const isPaused = ref<boolean>(false);
const isMuted = ref<boolean>(true);
const wasLongPress = ref<boolean>(false);
const videoRefs = ref<VideoElement[]>([]);

// Control refs
const leftControlRef = ref<HTMLElement | null>(null);
const rightControlRef = ref<HTMLElement | null>(null);

const {
  userLanguage: qpLang,
  endLink: qpEnd,
  gameLink: qpGame,
} = useQueryParams();
const { texts } = useLocale(ref(qpLang));
const end_link = ref(qpEnd);
const game_link = ref(qpGame);

const stories: Story[] = [
  { h265: story_1_h265, webm: story_1_webm },
  { h265: story_2_h265, webm: story_2_webm },
  { h265: story_3_h265, webm: story_3_webm },
  { h265: story_4_h265, webm: story_4_webm },
];

const numberOfSegments = computed<number>(() => stories.length);

const deskKeys: (keyof LocaleTexts)[] = ['desk1', 'desk2', 'desk3', 'desk4'];

const buildSlideTimeline = (index: number) => {
  const slideNum = index + 1;
  const headerSel = `#header${slideNum}`;
  const deskSel = `#desk${slideNum}`;
  const deskKey = deskKeys[index];
  const deskText = deskKey ? texts.value[deskKey] : '';

  const seg = gsap.timeline();
  gsap.set([headerSel, deskSel], { opacity: 0, marginTop: '7dvh' });
  seg.to(headerSel, { opacity: 1, marginTop: '0dvh', duration: 0.4 });
  seg.to(deskSel, { opacity: 1, marginTop: '0dvh', duration: 0.4 }, '<0.1');
  seg.add(() => {
    const el = document.querySelector(deskSel);
    if (el) el.textContent = '';
  });
  seg.to(deskSel, {
    duration: 1,
    text: { value: deskText, padSpace: false, delimiter: '' },
    ease: 'none',
  });
  return seg;
};

const rebuildTimelineFor = async (index: number) => {
  await nextTick();
  tl.kill();
  tl = gsap.timeline({
    defaults: { duration: 0.7, ease: 'power1.inOut' },
    paused: true,
  });
  tl.add(buildSlideTimeline(index), 0);
  if (!isPaused.value) tl.restart(true, false);
};

const closeStory = () => {
  window.parent.postMessage('close', '*');
  if (end_link.value)
    setTimeout(
      () => window.parent.postMessage('go_to_link:' + end_link.value, '*'),
      300
    );
};

const goToGame = () => {
  window.parent.postMessage('start_game_btn', '*');
  if (game_link.value)
    setTimeout(
      () => window.parent.postMessage('go_to_link:' + game_link.value, '*'),
      300
    );
};

// Event handler for gift button - sends 'get_gift' message to parent window
// This function should be called when user clicks on gift/prize related buttons
// const getGift = () => {
//   window.parent.postMessage('get_gift', '*');
//   if (end_link.value)
//     setTimeout(
//       () => window.parent.postMessage('go_to_link:' + end_link.value, '*'),
//       300
//     );
// };

// Event handler for watch again button - sends 'watch_again' message to parent window
// This function should be called when user wants to replay the stories
// const watchAgain = () => {
//   window.parent.postMessage('watch_again', '*');
// };

const setVideoRef = (el: StorySlideRef | null, index: number) => {
  if (el && el.videoRef) {
    videoRefs.value[index] = el.videoRef as VideoElement;
  }
};

const onPlay = () => {
  if (!isPaused.value) return;
  isPaused.value = false;
  const video = videoRefs.value[currentIndex.value];
  if (video) {
    video.muted = isMuted.value;
    video
      .play()
      .then(() => {
        // Start smooth progress tracking once video actually starts playing
        startProgressLoopFor(video);
      })
      .catch(() => {});
  }
  tl.play();
};

const onPause = () => {
  if (isPaused.value) return;
  isPaused.value = true;
  const video = videoRefs.value[currentIndex.value];
  if (video) video.pause();
  // Stop progress tracking when pausing
  stopProgressLoop();
  tl.pause();
  window.parent.postMessage('click_pause', '*');
};

const onToggleMute = (muted: boolean) => {
  isMuted.value = muted;
  const video = videoRefs.value[currentIndex.value];
  if (video) {
    video.muted = muted;
  }
  window.parent.postMessage(muted ? 'mute_video' : 'unmute_video', '*');
};

const onNext = () => {
  if (currentIndex.value < stories.length - 1) {
    currentIndex.value++;
    progress.value = 0;
    window.parent.postMessage('click_forward', '*');
  }
};

const onPrev = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    progress.value = 0;
    window.parent.postMessage('click_backward', '*');
  }
};

const onLoadedMetadata = () => {
  progress.value = 0;
  const video = videoRefs.value[currentIndex.value];
  // Start smooth progress tracking for newly loaded video
  if (video && !isPaused.value) startProgressLoopFor(video);
};

const onTimeUpdate = (e: Event) => {
  if (!isPaused.value) {
    const video = e.target as HTMLVideoElement;
    if (video && video.duration) {
      progress.value = (video.currentTime / video.duration) * 100;
    }
  }
};

const handleLongPress = () => {
  onPause();
  wasLongPress.value = true;
};

const handlePrev = () => {
  if (wasLongPress.value) return (wasLongPress.value = false);
  onPrev();
};

const handleNext = () => {
  if (wasLongPress.value) return (wasLongPress.value = false);
  onNext();
};

onMounted(async () => {
  await rebuildTimelineFor(0);
  isPaused.value = false;
  tl.play();
  // Start progress tracking for the first video if it's already loaded
  const video = videoRefs.value[currentIndex.value];
  if (video) startProgressLoopFor(video);

  const setupLongPress = (ref: Ref<HTMLElement | null>) => {
    onLongPress(ref, handleLongPress, {
      delay: 500,
      modifiers: { prevent: true },
      onMouseUp: () => {
        if (wasLongPress.value && isPaused.value) {
          wasLongPress.value = false;
          onPlay();
        }
      },
    });
  };

  [leftControlRef, rightControlRef].forEach(setupLongPress);
});

onUnmounted(() => {
  tl.kill();
  // Clean up progress tracking loops
  stopProgressLoop();
});

watch(currentIndex, (i: number) => {
  rebuildTimelineFor(i);
  // Stop progress loop for previous slide when switching to new slide
  stopProgressLoop();
});
</script>

<style lang="scss" scoped>
@import './stories.scss';
</style>
