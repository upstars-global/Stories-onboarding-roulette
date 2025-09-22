<template>
  <div class="story-container">
    <StoriesTopBar
      :progress
      :number-of-segments="numberOfSegments"
      :current-index="currentStoryIndex"
    />
    <div class="info_row">
      <img :src="assets.storyIcon" class="story_icon" alt="" />
      <div class="story_icon_top_text">
        <b>{{ getLocalizedText(title, userLanguage) }} </b>
        <br />
        <div class="icon_bottom_text" id="icon_bottom_text">
          <div
            id="top_text_1"
            v-html="getLocalizedText(currentStory?.topText, userLanguage)"
          />
        </div>
      </div>
    </div>
    <div
      id="text_container_stories"
      class="text_container"
      :class="{
        'has-help-text': currentStory?.helpText?.enabled,
      }"
    >
      <template v-for="(story, index) in stories" :key="`story-${story.id}`">
        <StorySlide
          v-if="currentStoryIndex === index"
          :ref="(el: unknown) => setVideoRef(el as StorySlideRef | null, index)"
          :story
          :texts="{ userLanguage }"
          :is-android="isAndroid"
          :current-index="currentStoryIndex"
          :autoplay="!isPaused"
          :muted="isMuted"
          :video-locked="showVideoPlayButton"
          @ended="onNext"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
        />
      </template>

      <CtaButton
        v-if="currentStory?.ctaButton?.enabled"
        :button-text="
          currentStory?.ctaButton?.text
            ? getLocalizedText(currentStory.ctaButton.text, userLanguage)
            : 'Start game'
        "
        @click="goToGame"
      />

      <div
        v-if="currentStory?.helpText?.enabled"
        class="help-text"
        style="display: none"
      >
        {{
          currentStory.helpText.text
            ? getLocalizedText(currentStory.helpText.text, userLanguage)
            : 'Need more info? '
        }}
        <a href="#" class="help-text-link">
          {{
            currentStory.helpText.link
              ? getLocalizedText(currentStory.helpText.link, userLanguage)
              : 'Read our guide'
          }}
        </a>
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
        @click.stop.prevent="handlePrev"
      />
      <MobileControlArea
        ref="rightControlRef"
        position="right"
        @click.stop.prevent="handleNext"
      />
      <DesktopControlButton position="left" @click="onPrev" />
      <DesktopControlButton position="right" @click="onNext" />
    </div>

    <!-- Custom video play button for autoplay fallback -->
    <Transition name="fade-scale" mode="out-in">
      <CustomVideoPlayButton v-if="isUserPlayRequired" @play="onPlay" />
    </Transition>
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
import { onLongPress, useEventListener } from '@vueuse/core';
import type { VideoElement, StorySlideRef } from '@/types';

import {
  StoriesTopBar,
  MobileControlArea,
  DesktopControlButton,
  DesktopPausePlayButton,
  MuteButton,
  CtaButton,
  CloseButton,
  CustomVideoPlayButton,
} from '@components/stories/ui';
import StorySlide from '@components/stories/StorySlide.vue';

import gsap from 'gsap';
import { TextPlugin } from 'gsap/TextPlugin';

import { useQueryParams } from '@/composables/useQueryParams';
import { useLocale } from '@/composables/useLocale';
import { useStoriesData } from '@/composables/useStoriesData';

gsap.registerPlugin(TextPlugin);

// === CONSTANTS ===
const LONG_PRESS_DELAY = 350;

let tl = gsap.timeline({
  defaults: { duration: 0.7, ease: 'power1.inOut' },
  paused: true,
});

// === REFS ===
const progress = ref<number>(0);
const isPaused = ref<boolean>(false);
const isMuted = ref<boolean>(true);
const wasLongPress = ref<boolean>(false);
const suppressNextClickUntil = ref<number>(0);
const isLongPressing = ref<boolean>(false);
const videoRefs = ref<VideoElement[]>([]);
const currentStoryIndex = ref(0);
const showVideoPlayButton = ref<boolean>(false);

const leftControlRef = ref<HTMLElement | null>(null);
const rightControlRef = ref<HTMLElement | null>(null);

let rvfcCancel: (() => void) | null = null;
let rafId: number | null = null;

// === COMPOSABLES ===
const {
  userLanguage: qpLang,
  endLink: qpEnd,
  gameLink: qpGame,
} = useQueryParams();
useLocale(ref(qpLang));
const { assets, title, stories } = useStoriesData();
const userLanguage = qpLang;

const end_link = ref(qpEnd);
const game_link = ref(qpGame);

// === COMPUTED ===
const isAndroid = computed(() => /android/i.test(navigator.userAgent));
const currentStory = computed(() => stories.value[currentStoryIndex.value]);
const numberOfSegments = computed<number>(() => stories.value.length);
// true, if explicit user action (Play) is required to start video
const isUserPlayRequired = computed(() => showVideoPlayButton.value);

// === METHODS ===
const getLocalizedText = (
  text: Record<string, string> | undefined,
  lang: string
): string => {
  return text?.[lang] || '';
};

/**
 * Stops all progress tracking loops (both rVFC and rAF)
 * Called when pausing video or switching stories
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (video as any).requestVideoFrameCallback === 'function';

  if (hasRVFC) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = video as any;
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

const buildStoryTimeline = (index: number) => {
  const storyNum = index + 1;
  const headerSel = `#header${storyNum}`;
  const deskSel = `#desk${storyNum}`;
  const deskText = currentStory.value?.description
    ? getLocalizedText(currentStory.value.description, userLanguage)
    : '';

  const seg = gsap.timeline();
  gsap.set([headerSel, deskSel], { opacity: 0, marginTop: '7dvh' });
  seg.to(headerSel, { opacity: 1, marginTop: '0dvh', duration: 0.4 });
  seg.to(deskSel, { marginTop: '0dvh', duration: 0.4 }, '<0.1');
  seg.add(() => {
    const el = document.querySelector(deskSel);
    if (el) el.textContent = '';
  });
  seg.to(deskSel, {
    opacity: 1,
  });
  seg.to(deskSel, {
    duration: 1,
    text: { value: deskText || '', padSpace: false, delimiter: '' },
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
  // Add story timeline to main timeline (paused by default)
  tl.add(buildStoryTimeline(index), 0);
};

const setVideoRef = (el: StorySlideRef | null, index: number) => {
  if (el && el.videoRef) {
    videoRefs.value[index] = el.videoRef as VideoElement;
  }
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

const onPlay = () => {
  isPaused.value = false;
  showVideoPlayButton.value = false;

  const video = videoRefs.value[currentStoryIndex.value];
  if (video) {
    video.muted = isMuted.value;
    video
      .play()
      .then(() => {
        // Start smooth progress tracking once video actually starts playing
        startProgressLoopFor(video);
        tl.play(); // start text animation only after video starts
      })
      .catch(() => {
        // Still blocked (e.g., not a "real" user gesture) → keep button visible
        showVideoPlayButton.value = true;
        isPaused.value = true;
      });
  }
};

const onPause = () => {
  if (isPaused.value) return;
  isPaused.value = true;
  const video = videoRefs.value[currentStoryIndex.value];
  if (video) video.pause();
  // Stop progress tracking when pausing
  stopProgressLoop();
  tl.pause();
  window.parent.postMessage('click_pause', '*');
};

const onToggleMute = (muted: boolean) => {
  // When custom play button is visible (user play required),
  // block mute/unmute action to prevent desync:
  // don't change volume, don't start animations, don't move progress.
  if (isUserPlayRequired.value) {
    return;
  }

  isMuted.value = muted;
  const video = videoRefs.value[currentStoryIndex.value];
  if (video) {
    video.muted = muted;
  }
  window.parent.postMessage(muted ? 'mute_video' : 'unmute_video', '*');
};

const onNext = () => {
  if (isUserPlayRequired.value) return; // block forward navigation until user starts video
  if (currentStoryIndex.value < stories.value.length - 1) {
    currentStoryIndex.value++;
    progress.value = 0;
    window.parent.postMessage('click_forward', '*');
  }
};

const onPrev = () => {
  if (isUserPlayRequired.value) return; // block backward navigation until user starts video
  if (currentStoryIndex.value > 0) {
    currentStoryIndex.value--;
    progress.value = 0;
    window.parent.postMessage('click_backward', '*');
  }
};

const onLoadedMetadata = () => {
  progress.value = 0;
  const video = videoRefs.value[currentStoryIndex.value];
  if (!video) return;

  video.muted = isMuted.value;

  if (!isPaused.value) {
    video
      .play()
      .then(() => {
        // Only now start the progress loop
        startProgressLoopFor(video);
        showVideoPlayButton.value = false;
        tl.play(); // synchronous start text animation on autoplay
      })
      .catch(() => {
        // Autoplay blocked → show custom button
        showVideoPlayButton.value = true;
      });
  }
};

const onTimeUpdate = (e: Event) => {
  if (!isPaused.value) {
    const video = e.target as HTMLVideoElement;
    if (video && video.duration) {
      progress.value = (video.currentTime / video.duration) * 100;
    }
  }
};

/**
 * Checks if the next click should be suppressed to prevent "ghost clicks"
 * that browsers generate after touchend events on mobile devices
 */
const shouldSuppressClick = () =>
  window.performance.now() < suppressNextClickUntil.value;

const handleLongPress = () => {
  // Ignore long-press until user starts playback (to avoid "fake pause")
  if (isUserPlayRequired.value) return;

  isLongPressing.value = true;
  wasLongPress.value = true;
  onPause();
};

const handlePrev = () => {
  if (isUserPlayRequired.value) {
    // block navigation until user starts video
    isLongPressing.value = false;
    return;
  }
  if (isLongPressing.value || shouldSuppressClick()) {
    isLongPressing.value = false;
    return;
  }
  onPrev();
};

const handleNext = () => {
  if (isUserPlayRequired.value) {
    // block navigation until user starts video
    isLongPressing.value = false;
    return;
  }
  if (isLongPressing.value || shouldSuppressClick()) {
    isLongPressing.value = false;
    return;
  }
  onNext();
};

/**
 * Global pointerup event listener to handle finger release anywhere on screen
 * Resumes playback when long press is released and blocks ghost clicks
 */
const offUp = useEventListener(
  window,
  'pointerup',
  () => {
    if (isLongPressing.value) {
      suppressNextClickUntil.value =
        window.performance.now() + Math.max(250, LONG_PRESS_DELAY - 50);
      isLongPressing.value = false;
      wasLongPress.value = false;
      if (isPaused.value) onPlay();
    }
  },
  { capture: true }
);

/**
 * Global pointercancel event listener to handle interrupted gestures
 * Resumes playback when gesture is cancelled (finger moved outside bounds, system interruption)
 */
const offCancel = useEventListener(window, 'pointercancel', () => {
  if (isLongPressing.value && isPaused.value) onPlay();
  isLongPressing.value = false;
});

/**
 * Sets up long press detection for a specific element
 * @param refEl - Reference to the DOM element to monitor for long press
 */
const setupLongPress = (refEl: Ref<HTMLElement | null>) => {
  onLongPress(refEl, handleLongPress, {
    delay: LONG_PRESS_DELAY,
    modifiers: { prevent: true, stop: true },
  });
};

// === LIFECYCLE HOOKS ===
onMounted(async () => {
  await rebuildTimelineFor(0);
  isPaused.value = false;

  const video = videoRefs.value[currentStoryIndex.value];
  if (video) {
    // If metadata is already loaded, try to start immediately
    try {
      await video.play();
      // Start progress tracking for the first video if it's already loaded
      startProgressLoopFor(video);
      showVideoPlayButton.value = false;
      tl.play(); // start text animation only after video starts
    } catch {
      showVideoPlayButton.value = true; // Autoplay blocked → show custom button
    }
  }

  [leftControlRef, rightControlRef].forEach(setupLongPress);

  // Disable context menu during long press
  useEventListener(
    window,
    'contextmenu',
    (e) => {
      if (isLongPressing.value) e.preventDefault();
    },
    { capture: true }
  );
});

onUnmounted(() => {
  tl.kill();
  // Clean up progress tracking loops
  stopProgressLoop();
  // Clean up event listeners
  offUp();
  offCancel();
});

// === WATCHERS ===
watch(currentStoryIndex, (i: number) => {
  // Stop progress loop for previous story when switching to new story
  stopProgressLoop();
  rebuildTimelineFor(i);
});
</script>

<style lang="scss" scoped>
@import './stories.scss';
</style>
