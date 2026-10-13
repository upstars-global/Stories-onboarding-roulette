/**
 * Picks which of a clip's four encodes this browser plays.
 *
 * The clips are opaque, so unlike the earlier stories there is no alpha to
 * steer by and no user-agent sniffing: the browser is asked what it can decode.
 * The order follows what the files turned out to be (docs/poker-video-report.json):
 * AV1 is the smallest and the only one free of banding, HEVC comes next, H.264
 * is larger but holds the gradients, and VP9 bands the most for its size — it
 * is last, and is there for builds that ship without the patented codecs.
 */

import { ref } from 'vue';
import type { StoryVideo } from '@/types';

export type VideoFormat = keyof StoryVideo;

export interface VideoSource {
  src: string;
  type: string;
}

/** `type` values are read off the encoded files. Both codecs are named so that
 *  a browser which decodes the picture but not the sound skips the source
 *  rather than starting it and failing. */
const TYPES: Record<VideoFormat, string> = {
  av1: 'video/mp4; codecs="av01.0.08M.08, mp4a.40.2"',
  h265: 'video/mp4; codecs="hvc1.1.6.L120.90, mp4a.40.2"',
  h264: 'video/mp4; codecs="avc1.640028, mp4a.40.2"',
  webm: 'video/webm; codecs="vp09.00.40.08, opus"',
};

const ORDER: VideoFormat[] = ['av1', 'h265', 'h264', 'webm'];

/** Formats this browser can play, best first. Filled once by detectVideoFormats. */
const usable = ref<VideoFormat[]>(ORDER.filter((f) => f !== 'av1'));

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
  const probe = document.createElement('video');
  const av1 = await av1IsEfficient();
  const playable = ORDER.filter(
    (format) =>
      (format !== 'av1' || av1) && probe.canPlayType(TYPES[format]) !== ''
  );
  // A browser that claims nothing still gets the list: letting it try beats
  // showing an empty slide.
  if (playable.length) usable.value = playable;
}

export function useVideoFormat() {
  const sources = (video: StoryVideo): VideoSource[] =>
    usable.value.map((format) => ({ src: video[format], type: TYPES[format] }));

  /** The file the browser will pick — what the next-clip prefetch warms. */
  const preferredUrl = (video: StoryVideo): string | undefined => {
    const format = usable.value[0];
    return format ? video[format] : undefined;
  };

  /** A format that was promised and then failed to decode is dropped for the
   *  rest of the session. Returns false when there is nothing left to fall to. */
  const dropPreferred = (): boolean => {
    if (usable.value.length < 2) return false;
    usable.value = usable.value.slice(1);
    return true;
  };

  return { usable, sources, preferredUrl, dropPreferred };
}
