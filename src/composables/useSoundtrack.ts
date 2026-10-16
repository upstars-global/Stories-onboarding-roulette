/**
 * The story's music as one track beside the clips, so that it plays on
 * through the slide changes instead of stopping with every clip. The track
 * and soundtrack.json, which says where in it each clip starts, are in the
 * story's audio/ folder; scripts/build-story-soundtrack.mjs makes them from
 * the clips' sound and takes the sound out of the clips.
 *
 * The music is not locked to the picture. It runs on its own clock and is
 * left alone while it stays within FAR of the clip on screen, so a slide
 * change that takes a moment to load just lets the music play on. Past FAR,
 * or when the viewer moves to another slide, it jumps, by whole bars
 * (soundtrack.json `step`) so the beat goes on. Its speed is never changed:
 * on an iPhone every speed change was heard as a stumble.
 *
 * Stories.vue has the file downloaded into memory as soon as the first clip
 * has a few seconds in hand (useVideoPrefetch), so the sound button starts it
 * at once and a jump does not wait on the network. A tap that comes before
 * the download is done asks for it itself and waits for it while it is set
 * to finish within WAIT; a slower one gives way to streaming from the
 * network, which in Safari takes one to three seconds to sound, and then has
 * to jump to catch up with the picture.
 *
 * A story without these files has no track: `enabled` is false, every call
 * does nothing, and the clips keep their own sound.
 */

import { onUnmounted } from 'vue';
import type { Soundtrack } from '@/types';
import { storyAssetUrl } from '@/composables/useAssetUrl';
import { useVideoPrefetch } from '@/composables/useVideoPrefetch';

const manifests = import.meta.glob<Soundtrack>('@story/audio/soundtrack.json', {
  eager: true,
  import: 'default',
});
const soundtrack: Soundtrack | undefined = Object.values(manifests)[0];

/** Whether the story's music plays from its own file; its clips then carry
 *  no sound. */
export const hasSoundtrack = soundtrack !== undefined;

const TICK_MS = 250;
/** Seconds the music may be off the picture before it is moved: the far end
 *  of the 1-2 s the story allows. */
const FAR = 2;
/** How long the music plays on while the picture stands still before it
 *  waits for the picture instead. A slow slide change stays well inside it:
 *  the music carries on and then jumps back by whole bars. */
const ALONE_MS = 10_000;
/** Seconds a download under way may still need for the sound button to wait
 *  for it rather than stream the music from the network. */
const WAIT = 1.5;
/** Seconds a download has to have been coming in for its speed to show. */
const MEASURED = 0.25;

/** A twentieth of a second of silence as a WAV data URL. Browsers let sound
 *  start only inside the viewer's tap; the element plays this there, and may
 *  then play the music when its download finishes a moment later. */
function silence(): string {
  const samples = 400;
  const wav = new Uint8Array(44 + samples).fill(128);
  const view = new DataView(wav.buffer);
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => (wav[at + i] = c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true); // samples per second
  view.setUint32(28, 8000, true); // bytes per second
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, samples, true);
  return `data:audio/wav;base64,${window.btoa(String.fromCharCode(...wav))}`;
}

/** The file of the track this browser plays: HE-AAC, or Opus without it. */
function trackUrl(): string | undefined {
  if (!soundtrack) return undefined;
  const probe = document.createElement('audio');
  const name = probe.canPlayType('audio/mp4; codecs="mp4a.40.5"')
    ? soundtrack.files.m4a
    : probe.canPlayType('audio/webm; codecs="opus"')
      ? soundtrack.files.webm
      : undefined;
  return name ? storyAssetUrl(`audio/${name}`) : undefined;
}

interface Picture {
  /** The clip of the slide on screen, as stories.json names it. */
  clip: () => string | undefined;
  /** That slide's video element, once it is in the page. */
  video: () => HTMLVideoElement | undefined;
}

/**
 * @param picture what is on screen
 * @param refused called when the browser will not play the track (the file
 *   did not load, or sound was not allowed): the music stays off
 */
export function useSoundtrack(picture: Picture, refused: () => void) {
  const { prefetch, local, progress, whenReady, cancel } = useVideoPrefetch();
  const url = trackUrl();
  let audio: HTMLAudioElement | null = null;
  /** The element has the music to play, not the silence of the tap. */
  let sourced = false;
  /** Tapped while the music was still downloading: waiting for it. */
  let arriving = false;
  /** The viewer has the sound on and the story is playing. */
  let wanted = false;
  /** Paused here because the picture stood still for too long. */
  let waiting = false;
  let aloneSince = 0;
  let lastPictureTime = -1;
  let placeOnMetadata = false;
  /** Started and not yet heard: see the 'playing' listener. */
  let starting = false;
  let clock = 0;

  /** Where in the track the music belongs: the clip's start plus the time of
   *  the picture. `atTheTop` takes the clip's first frame, for a slide just
   *  moved to, whose video is not in the page yet. */
  function target(atTheTop = false): number | undefined {
    const clip = picture.clip();
    const start = soundtrack?.slides.find((s) => s.video === clip)?.start;
    if (start === undefined) return undefined;
    return start + (atTheTop ? 0 : (picture.video()?.currentTime ?? 0));
  }

  const length = (): number =>
    audio && Number.isFinite(audio.duration)
      ? audio.duration
      : (soundtrack?.duration ?? 0);

  const clamp = (t: number): number =>
    Math.min(Math.max(t, 0), Math.max(length() - 0.25, 0));

  function element(): HTMLAudioElement {
    if (audio) return audio;
    const a = new window.Audio();
    // Loaded only once the viewer turns the sound on.
    a.preload = 'none';
    a.addEventListener('loadedmetadata', () => {
      if (!placeOnMetadata) return;
      placeOnMetadata = false;
      place(a);
    });
    // Streamed from the network, the music becomes audible a moment after it
    // was placed, and the picture has moved on meanwhile. Moved once more if
    // that left it further off than the story allows.
    a.addEventListener('playing', () => {
      if (!starting) return;
      starting = false;
      const t = target();
      if (wanted && t !== undefined && Math.abs(a.currentTime - t) > FAR) {
        a.currentTime = clamp(t);
      }
    });
    // The next tap on the sound button starts over with a fresh element.
    a.addEventListener('error', () => {
      if (arriving) return;
      stop();
      audio = null;
      sourced = false;
      refused();
    });
    audio = a;
    return a;
  }

  function source(a: HTMLAudioElement, src: string): void {
    a.src = src;
    sourced = true;
  }

  /** Whether the download of the music under way will be done within WAIT,
   *  judging by its speed so far. Until its speed shows (MEASURED) it gets
   *  the benefit of the doubt; how long it may take is capped all the same. */
  function worthWaiting(file: string): boolean {
    const p = progress(file);
    if (!p) return false;
    const flowing = p.firstByteAt
      ? (window.performance.now() - p.firstByteAt) / 1000
      : 0;
    if (flowing < MEASURED) return true;
    if (!p.total) return false;
    return (p.total - p.received) / (p.received / flowing) <= WAIT;
  }

  /** Inside the tap: plays the silence there, then the music from memory as
   *  soon as its download is done. The download is judged again on every
   *  tick; one that will not make it within WAIT, or is not done a little
   *  after, gives way to streaming. */
  function awaitDownload(a: HTMLAudioElement, file: string): void {
    arriving = true;
    a.src = silence();
    a.play().catch(() => undefined);
    let settled = false;
    let judge = 0;
    const settle = (inMemory: string | undefined): void => {
      if (settled) return;
      settled = true;
      window.clearInterval(judge);
      arriving = false;
      if (audio !== a) return;
      if (!inMemory) cancel(file);
      source(a, inMemory ?? file);
      if (wanted && !document.hidden) start(a);
    };
    void whenReady(file).then(settle);
    judge = window.setInterval(() => {
      if (!worthWaiting(file)) settle(local(file));
    }, TICK_MS);
    window.setTimeout(() => settle(local(file)), (WAIT + 0.5) * 1000);
  }

  /** Puts the music exactly where the picture is; before the track's length
   *  is known, as soon as it is. */
  function place(a: HTMLAudioElement, atTheTop = false): void {
    const t = target(atTheTop);
    if (t === undefined) return;
    if (a.readyState === 0) {
      placeOnMetadata = true;
      return;
    }
    a.currentTime = clamp(t);
  }

  function start(a: HTMLAudioElement, atTheTop = false): void {
    waiting = false;
    aloneSince = 0;
    starting = true;
    place(a, atTheTop);
    a.play().catch((e: unknown) => {
      // An AbortError only means it was paused again before it began.
      const name = (e as { name?: string } | null)?.name;
      if (name === 'NotAllowedError' || name === 'NotSupportedError') {
        stop();
        refused();
      }
    });
  }

  function stop(): void {
    wanted = false;
    waiting = false;
    if (clock) window.clearInterval(clock);
    clock = 0;
    audio?.pause();
  }

  /**
   * Where to jump when the music is `off` seconds ahead of the picture (below
   * zero, behind): by whole steps, to the nearest place that keeps the beat,
   * or straight there when no such place lies within FAR of the picture.
   */
  function jumpTo(now: number, off: number): number {
    const step = soundtrack?.step;
    if (!step) return clamp(now - off);
    let best = now;
    let left = Math.abs(off);
    for (const n of [Math.floor(off / step), Math.ceil(off / step)]) {
      const to = now - n * step;
      const rest = Math.abs(off - n * step);
      if (n !== 0 && to >= 0 && to <= length() - 0.25 && rest < left) {
        best = to;
        left = rest;
      }
    }
    return left > FAR ? clamp(now - off) : best;
  }

  /** Brings the music back to the picture: after a move to another slide
   *  whenever whole bars bring it closer, otherwise only when it is more than
   *  FAR off. */
  function catchUp(a: HTMLAudioElement, moved = false): void {
    const t = target(moved);
    if (t === undefined) return;
    const off = a.currentTime - t;
    if (!moved && Math.abs(off) <= FAR) return;
    const to = jumpTo(a.currentTime, off);
    if (to !== a.currentTime) a.currentTime = to;
  }

  function tick(): void {
    const a = audio;
    if (!a || !wanted || !sourced || a.ended) return;
    const v = picture.video();
    const now = window.performance.now();
    const time = v?.currentTime ?? -1;
    const moving =
      !!v &&
      !v.paused &&
      !v.ended &&
      v.readyState >= 3 &&
      time !== lastPictureTime;
    lastPictureTime = time;
    if (!moving) {
      // A clip loading, stalled or finished. Playing on alone is the point at
      // a slide change; past ALONE_MS the music waits for the picture. The
      // last clip, finished, lets the music play out.
      if (v?.ended) {
        aloneSince = 0;
        return;
      }
      aloneSince ||= now;
      if (!waiting && !a.paused && now - aloneSince > ALONE_MS) {
        waiting = true;
        a.pause();
      }
      return;
    }
    aloneSince = 0;
    if (waiting || a.paused) {
      if (!document.hidden) start(a);
      return;
    }
    if (!a.seeking && a.readyState >= 3) catchUp(a);
  }

  /** A hidden page keeps no music playing. Back in view, the clock starts it
   *  where the picture is once the picture moves again: a browser that left
   *  the clip paused gets no music over a still frame. */
  function onVisibility(): void {
    if (audio && wanted && document.hidden) audio.pause();
  }
  document.addEventListener('visibilitychange', onVisibility);

  onUnmounted(() => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    if (audio) {
      audio.removeAttribute('src');
      audio.load();
    }
  });

  return {
    enabled: hasSoundtrack,

    /** The file to download ahead of time; none once the music has started
     *  streaming from the network, which would only fetch it twice. */
    prefetchUrl: (): string | undefined => (audio ? undefined : url),

    /** Starts the music where the picture is. Browsers let sound start only
     *  from the viewer's tap, so the first call has to come from one. */
    play(): void {
      if (!url) return;
      const a = element();
      wanted = true;
      if (!clock) clock = window.setInterval(tick, TICK_MS);
      if (arriving) return;
      if (!sourced) {
        // Asked for here as well, for a tap that comes before Stories.vue
        // has asked: from memory the music starts where the picture is.
        prefetch(url);
        const inMemory = local(url);
        if (inMemory) {
          source(a, inMemory);
        } else if (worthWaiting(url)) {
          awaitDownload(a, url);
          return;
        } else {
          // Streamed instead; the download would only compete with it.
          cancel(url);
          source(a, url);
        }
      }
      if (a.paused && !document.hidden) start(a);
    },

    pause: stop,

    /** The viewer moved to another slide: the music goes there too. */
    jump(): void {
      const a = audio;
      if (!a || !wanted || !sourced) return;
      if (a.paused || a.ended) {
        if (!document.hidden) start(a, true);
        return;
      }
      catchUp(a, true);
    },
  };
}
