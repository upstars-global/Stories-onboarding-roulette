/**
 * Picks which encode of a clip this browser plays: the size, then the format.
 *
 * Size. Every clip ships 1080 pixels wide and, where it was encoded, 720 wide
 * (scripts/encode-story-videos.mjs). The choice follows how many device pixels
 * the clip is actually drawn across — a phone at 3x needs the 1080 frame, a
 * desktop card on an ordinary monitor or a phone at 2x does not, and gets the
 * lighter file. It is the screen that decides, not the connection.
 *
 * Format. The clips are opaque, so unlike the earlier stories there is no alpha
 * to steer by and no user-agent sniffing: the browser is asked what it can
 * decode. The order follows what the files turned out to be
 * (stories/poker/video-report.json): AV1 is the smallest and the only one free of
 * banding, HEVC comes next, H.264 is larger but holds the gradients, and VP9
 * bands the most for its size — it is last, and is there for builds that ship
 * without the patented codecs.
 */

import { ref } from 'vue';
import type { StoryVideo, StoryVideoSizes } from '@/types';
import { hasSoundtrack } from '@/composables/useSoundtrack';
import { useVideoPrefetch } from '@/composables/useVideoPrefetch';

export type VideoFormat = keyof StoryVideo;
export type VideoSize = '1080' | '720';

export interface VideoSource {
  src: string;
  type: string;
}

/** `codecs` values are read off the encoded files (the report lists them).
 *  Both codecs are named, so that a browser which decodes the picture but not
 *  the sound skips the source rather than starting it and failing. The 720
 *  files sit a level lower: the level follows the frame size. */
const PICTURE: Record<VideoSize, Record<VideoFormat, string>> = {
  1080: {
    av1: 'av01.0.08M.08',
    h265: 'hvc1.1.6.L120.90',
    h264: 'avc1.640028',
    webm: 'vp09.00.40.08',
  },
  720: {
    av1: 'av01.0.05M.08',
    h265: 'hvc1.1.6.L93.90',
    h264: 'avc1.64001F',
    webm: 'vp09.00.31.08',
  },
};
const SOUND: Record<VideoFormat, string> = {
  av1: 'mp4a.40.2',
  h265: 'mp4a.40.2',
  h264: 'mp4a.40.2',
  webm: 'opus',
};

/** A story whose music plays from its own file (useSoundtrack) ships its
 *  clips without sound, and their type names the picture alone. */
const typeOf = (size: VideoSize, format: VideoFormat): string => {
  const container = format === 'webm' ? 'webm' : 'mp4';
  const codecs = hasSoundtrack
    ? PICTURE[size][format]
    : `${PICTURE[size][format]}, ${SOUND[format]}`;
  return `video/${container}; codecs="${codecs}"`;
};

const ORDER: VideoFormat[] = ['av1', 'h265', 'h264', 'webm'];

/** From this width (md in src/assets/scss/tokens/_breakpoints.scss) the story
 *  is a card in the middle of the screen rather than the whole screen. */
const CARD_FROM = '(min-width: 754px)';

/** The 720 file serves a clip drawn up to this many device pixels across —
 *  stretched by at most a tenth, which does not show at these densities. */
const SMALL_UP_TO = 800;

/** Formats this browser can play, best first. Filled once by detectVideoFormats. */
const usable = ref<VideoFormat[]>(ORDER.filter((f) => f !== 'av1'));

/** The frame width to play. Follows the window, so a desktop window made
 *  larger gets the sharper file from the next slide on. */
const size = ref<VideoSize>('1080');

/**
 * Device pixels across the clip, as stories.scss lays it out (.bg_video): the
 * full viewport width on a phone, a card 432/900 of the viewport height on a
 * wider screen.
 */
function drawnWidth(): number {
  const css = window.matchMedia(CARD_FROM).matches
    ? (window.innerHeight * 432) / 900
    : window.innerWidth;
  return css * (window.devicePixelRatio || 1);
}

const pickSize = (): VideoSize =>
  drawnWidth() <= SMALL_UP_TO ? '720' : '1080';

/**
 * canPlayType answers yes to AV1 wherever a software decoder exists, and at
 * 1080x1920 that decoder drops frames on a phone. Media Capabilities is the
 * only API that tells hardware decoding apart; without it AV1 is skipped.
 */
async function av1IsEfficient(): Promise<boolean> {
  const capabilities = navigator.mediaCapabilities;
  if (!capabilities?.decodingInfo) return false;
  try {
    const info = await capabilities.decodingInfo({
      type: 'file',
      video: {
        contentType: 'video/mp4; codecs="av01.0.08M.08"',
        width: 1080,
        height: 1920,
        bitrate: 1_500_000,
        framerate: 30,
      },
    });
    return info.supported && info.smooth && info.powerEfficient;
  } catch {
    return false;
  }
}

/** Run once before the app mounts, so the first slide already knows. */
export async function detectVideoFormats(): Promise<void> {
  size.value = pickSize();
  window.addEventListener('resize', () => {
    size.value = pickSize();
  });

  const probe = document.createElement('video');
  const av1 = await av1IsEfficient();
  // Asked with the 1080 strings: a browser that takes the higher level takes
  // the lower one too.
  const playable = ORDER.filter(
    (format) =>
      (format !== 'av1' || av1) &&
      probe.canPlayType(typeOf('1080', format)) !== ''
  );
  // A browser that claims nothing still gets the list: letting it try beats
  // showing an empty slide.
  if (playable.length) usable.value = playable;
}

export function useVideoFormat() {
  const { local } = useVideoPrefetch();

  /** The set at the chosen size; a story shipped at 1080 only plays that. */
  const pick = (video: StoryVideoSizes): [VideoSize, StoryVideo] => {
    const files = video[size.value];
    return files ? [size.value, files] : ['1080', video[1080]];
  };

  /** The encodes to offer, best first; a file already downloaded ahead of
   *  time (useVideoPrefetch) is offered from memory. */
  const sources = (video: StoryVideoSizes): VideoSource[] => {
    const [at, files] = pick(video);
    return usable.value.map((format) => ({
      src: local(files[format]) ?? files[format],
      type: typeOf(at, format),
    }));
  };

  /** The file the browser will pick — what the next-clip prefetch warms. */
  const preferredUrl = (video: StoryVideoSizes): string | undefined => {
    const format = usable.value[0];
    return format ? pick(video)[1][format] : undefined;
  };

  /** A format that was promised and then failed to decode is dropped for the
   *  rest of the session. Returns false when there is nothing left to fall to. */
  const dropPreferred = (): boolean => {
    if (usable.value.length < 2) return false;
    usable.value = usable.value.slice(1);
    return true;
  };

  return { usable, size, sources, preferredUrl, dropPreferred };
}
