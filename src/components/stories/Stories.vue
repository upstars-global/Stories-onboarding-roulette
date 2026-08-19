<template>
  <div class="story-container">
    <OrientationWarning
      :user-language="userLanguage"
      @warning-visible="onWarningVisible"
    />

    <StoriesTopBar
      :progress="segmentProgress"
      :number-of-segments="numberOfSegments"
      :current-index="currentSegmentIndex"
    />
    <div class="info_row">
      <img :src="ui.storyIcon" class="story_icon" alt="" />
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
        // has-help-text → video offset in stories.scss
        // custom-layout → lifts CTA above help-text (CtaButton.vue, all branches)
        'has-help-text': currentStory?.helpText?.enabled,
        'custom-layout': currentStory?.helpText?.enabled,
        'first-slide': currentStoryIndex === 0,
        'is-compact-body': currentStory?.id === 'story5',
      }"
    >
      <template v-for="(story, index) in stories" :key="`story-${story.id}`">
        <StorySlide
          v-if="currentStoryIndex === index"
          :ref="(el: unknown) => setVideoRef(el as StorySlideRef | null, index)"
          :story
          :texts="{ userLanguage }"
          :is-android="isAndroid"
          :prefers-h265="prefersH265"
          :current-index="currentStoryIndex"
          :autoplay="!isPaused"
          :muted="isMuted"
          :video-locked="showVideoPlayButton"
          :text-phase="textPhase"
          @ended="onNext"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
        />
      </template>

      <CtaButton
        v-if="currentStory?.ctaButton?.enabled"
        :button-text="getLocalizedText(ui.ctaButton.text, userLanguage)"
        :custom-position="!!currentStory?.helpText?.enabled"
        @click="goToGame"
      />

      <div v-if="currentStory?.helpText?.enabled" class="help-text">
        {{ getLocalizedText(ui.helpText.text, userLanguage) }}
        <a href="#" class="help-text-link" @click.prevent="goToDiscover">
          {{ getLocalizedText(ui.helpText.link, userLanguage) }}
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
  OrientationWarning,
} from '@components/stories/ui';
import StorySlide from '@components/stories/StorySlide.vue';

import { gsap } from 'gsap';
import { TextPlugin } from 'gsap/TextPlugin';

import { useQueryParams } from '@/composables/useQueryParams';
import { useLocale } from '@/composables/useLocale';
import { useStoriesData } from '@/composables/useStoriesData';
import { useVideoPrefetch } from '@/composables/useVideoPrefetch';

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
/** 0 = first text block, 1 = second mid-video phase (glued clip) */
const textPhase = ref(0);
let secondPhaseStarted = false;

const leftControlRef = ref<HTMLElement | null>(null);
const rightControlRef = ref<HTMLElement | null>(null);

let rvfcCancel: (() => void) | null = null;
let rafId: number | null = null;

// === COMPOSABLES ===
const {
  userLanguage: qpLang,
  endLink: qpEnd,
  gameLink: qpGame,
  discoverLink: qpDiscover,
} = useQueryParams();
useLocale(ref(qpLang));
const { title, ui, stories } = useStoriesData();
const { prefetch } = useVideoPrefetch();
const userLanguage = qpLang;

const end_link = ref(qpEnd);
const game_link = ref(qpGame);
const discover_link = ref(qpDiscover);

// === COMPUTED ===
const isAndroid = computed(() => /android/i.test(navigator.userAgent));

// The story background is drawn by the app; the video is transparent around the card.
// WebKit plays VP9 but ignores its alpha: transparent areas turn black and the
// background does not show through. So for Safari and all iOS browsers HEVC with
// alpha is placed first in the source list; for everyone else WebM stays first.
const prefersH265 = computed(() => {
  const ua = navigator.userAgent;
  const isIOS = /iP(hone|ad|od)/.test(ua);
  const isSafari =
    /safari/i.test(ua) && !/chrome|chromium|android|crios|fxios|edg/i.test(ua);
  return isIOS || isSafari;
});
const currentStory = computed(() => stories.value[currentStoryIndex.value]);

// Maps each story index to its progress-bar segment index. Stories flagged
// with `mergeProgressWithPrevious` reuse the previous story's segment, so two
// sub-scenes (e.g. Player/Banker third-card rules) share one progress step.
const segmentIndexByStory = computed<number[]>(() => {
  let seg = 0;
  return stories.value.map((s, i) => {
    if (i > 0 && !s.mergeProgressWithPrevious) seg++;
    return seg;
  });
});
const numberOfSegments = computed<number>(() => {
  const arr = segmentIndexByStory.value;
  return (arr[arr.length - 1] ?? 0) + 1;
});
const currentSegmentIndex = computed<number>(
  () => segmentIndexByStory.value[currentStoryIndex.value] ?? 0
);
// Progress of the current segment (0-100). For grouped segments each sub-scene
// gets an equal slice, so the bar keeps advancing across the auto-advance.
const segmentProgress = computed<number>(() => {
  const seg = currentSegmentIndex.value;
  const indices = segmentIndexByStory.value.reduce<number[]>((acc, s, i) => {
    if (s === seg) acc.push(i);
    return acc;
  }, []);
  const subCount = indices.length || 1;
  const subPos = Math.max(0, indices.indexOf(currentStoryIndex.value));
  return ((subPos + progress.value / 100) / subCount) * 100;
});
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
      maybeSwitchTextPhase(video);
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
      maybeSwitchTextPhase(video);
      const d = video.duration || 0;
      if (d > 0) progress.value = (video.currentTime / d) * 100;
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
  }
}

const animateRegularText = (
  seg: gsap.core.Timeline,
  deskSel: string,
  deskText: string
) => {
  const el = document.querySelector(deskSel) as HTMLElement | null;
  if (!el) return;

  el.textContent = '';
  seg.to(
    el,
    {
      duration: 2,
      text: { value: deskText || '', padSpace: false, delimiter: '' },
      ease: 'none',
    },
    '>'
  );
};

/**
 * DOM-safe typewriter: types text node by text node while preserving all nested tags.
 * Scope-limited: operates ONLY within the provided container selector.
 */
const animateListItems = (
  seg: gsap.core.Timeline,
  deskSel: string,
  deskHTML: string
) => {
  const container = document.querySelector(deskSel) as HTMLElement | null;
  if (!container) return;

  // Render provided HTML into target container
  container.innerHTML = deskHTML;
  const items = container.querySelectorAll('li');

  items.forEach((li, i) => {
    // Collect all non-empty text nodes within current <li>
    const textNodes: Array<{ node: globalThis.Text; full: string }> = [];
    // 4 = SHOW_TEXT, 1 = FILTER_ACCEPT, 2 = FILTER_REJECT (avoid global NodeFilter reference)
    const walker = document.createTreeWalker(li, 4, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      acceptNode(node: any) {
        const v = (node.nodeValue || '') as string;
        return v.trim().length > 0 ? 1 : 2;
      },
    } as unknown as globalThis.NodeFilter);

    let current = walker.nextNode() as globalThis.Node | null;
    while (current) {
      textNodes.push({
        node: current as unknown as globalThis.Text,
        full: (current.nodeValue || '') as string,
      });
      current = walker.nextNode() as globalThis.Node | null;
    }

    // Nothing to animate → still add bullet appearance
    if (textNodes.length === 0) {
      seg.add(
        () => li.classList.add('animate-bullet'),
        i === 0 ? '>' : '+=0.2'
      );
      return;
    }

    // Clear all text nodes to avoid flashes
    textNodes.forEach((t) => (t.node.textContent = ''));

    // Total characters across all text nodes
    const totalChars = textNodes.reduce((acc, t) => acc + t.full.length, 0);
    const proxy = { p: 0 };
    const charsPerSecond = 40; // typing speed; tune if needed
    const duration = Math.max(0.6, totalChars / charsPerSecond);

    // Helper to populate nodes based on current progress
    const renderProgress = (p: number) => {
      let remain = Math.floor(p);
      for (const t of textNodes) {
        if (remain <= 0) {
          t.node.textContent = '';
          continue;
        }
        const take = Math.min(remain, t.full.length);
        t.node.textContent = t.full.slice(0, take);
        remain -= take;
      }
    };

    // Animate progress across all nodes; add bullet class at start
    seg.to(
      proxy,
      {
        duration,
        p: totalChars,
        ease: 'none',
        onStart: () => li.classList.add('animate-bullet'),
        onUpdate: () => renderProgress(proxy.p),
        onComplete: () => renderProgress(totalChars),
      },
      i === 0 ? '>' : '+=0.2'
    );
  });
};

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
    seg.to(deskSel, { opacity: 1 }, '+0.1');

    if (deskText.includes('<li')) {
      // Animate list items while preserving nested tags
      animateListItems(seg, deskSel, deskText);
    } else {
      animateRegularText(seg, deskSel, deskText);
    }
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

const goToDiscover = () => {
  if (discover_link.value)
    window.parent.postMessage('go_to_link:' + discover_link.value, '*');
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
        window.parent.postMessage('click_play', '*');
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

const onWarningVisible = (isVisible: boolean) => {
  if (isVisible) {
    onPause();
  } else {
    onPlay();
  }
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

/**
 * Warms the next clip, mirroring the source order in StorySlide.vue so the file
 * the browser will actually pick is the one fetched ahead.
 *
 * Waits until the playing clip is fully buffered: on a narrow connection the two
 * downloads otherwise share the pipe and the current clip starts stuttering —
 * trading the stall at the transition for a worse one during playback. Gated
 * like this the prefetch only ever spends bandwidth playback no longer needs.
 */
const prefetchNextVideo = (video: HTMLVideoElement) => {
  const next = stories.value[currentStoryIndex.value + 1];
  if (!next) return;

  const url = isAndroid.value
    ? next.video.webm
    : prefersH265.value
      ? next.video.h265
      : next.video.webm;

  const isFullyBuffered = (): boolean => {
    const { buffered, duration } = video;
    if (!buffered.length || !Number.isFinite(duration)) return false;
    return buffered.end(buffered.length - 1) >= duration - 0.5;
  };

  if (isFullyBuffered()) {
    prefetch(url);
    return;
  }

  // Listener dies with the element when the slide unmounts.
  const onProgress = () => {
    if (!isFullyBuffered()) return;
    video.removeEventListener('progress', onProgress);
    prefetch(url);
  };
  video.addEventListener('progress', onProgress);
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
        prefetchNextVideo(video);
      })
      .catch(() => {
        // Autoplay blocked → show custom button
        showVideoPlayButton.value = true;
      });
  }
};

/**
 * Mid-video text swap for glued clips (e.g. Player → Banker on story4).
 * Top bar text stays; H1 crossfades; description re-types. Video is not remounted.
 */
const playSecondTextPhase = async () => {
  const story = currentStory.value;
  if (!story?.secondHeader || !story.secondDescription) return;

  const storyNum = currentStoryIndex.value + 1;
  const headerSel = `#header${storyNum}`;
  const deskSel = `#desk${storyNum}`;
  const deskText = getLocalizedText(story.secondDescription, userLanguage);

  // Brief exit of phase-1 text, then same bottom→up entrance as the first phase.
  await gsap.to([headerSel, deskSel], {
    opacity: 0,
    duration: 0.2,
    ease: 'power1.in',
  });

  textPhase.value = 1;
  await nextTick();

  const deskEl = document.querySelector(deskSel) as HTMLElement | null;
  if (deskEl) deskEl.innerHTML = '';

  gsap.set([headerSel, deskSel], { opacity: 0, marginTop: '7dvh' });

  const seg = gsap.timeline();
  seg.to(headerSel, { opacity: 1, marginTop: '0dvh', duration: 0.4 });
  seg.to(deskSel, { marginTop: '0dvh', duration: 0.4 }, '<0.1');
  seg.add(() => {
    seg.to(deskSel, { opacity: 1 }, '+0.1');
    if (deskText.includes('<li')) {
      animateListItems(seg, deskSel, deskText);
    } else {
      animateRegularText(seg, deskSel, deskText);
    }
  });
};

const maybeSwitchTextPhase = (video: HTMLVideoElement) => {
  const at = currentStory.value?.phaseSwitchAt;
  if (at == null || secondPhaseStarted) return;
  if (video.currentTime >= at) {
    secondPhaseStarted = true;
    void playSecondTextPhase();
  }
};

const onTimeUpdate = (e: Event) => {
  const video = e.target as HTMLVideoElement;
  if (!video) return;
  maybeSwitchTextPhase(video);
  if (!isPaused.value && video.duration) {
    progress.value = (video.currentTime / video.duration) * 100;
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
  textPhase.value = 0;
  secondPhaseStarted = false;
  rebuildTimelineFor(i);

  // Notify parent when last segment starts
  if (i === stories.value.length - 1) {
    const message = 'opened_story:1';
    window.parent.postMessage(message, '*');
    // eslint-disable-next-line no-console
    console.log(message);
  }
});
</script>

<style lang="scss" scoped>
@import './stories.scss';
</style>
