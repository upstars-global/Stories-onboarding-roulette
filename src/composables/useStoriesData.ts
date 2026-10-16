import { computed } from 'vue';
import storiesData from '@story/stories.json';
import videoFiles from '@/data/video-files.json';
import type {
  RawStoriesData,
  StoriesData,
  StoryData,
  StoryVideo,
  StoryVideoSizes,
  LocalizedText,
  StoriesUI,
} from '@/types/stories';
import { resolveAssetUrl, storyAssetUrl } from '@/composables/useAssetUrl';

/** A clip's four files at one size, or undefined when that size was not
 *  encoded. Names as scripts/encode-story-videos.mjs writes them. */
function videoAt(name: string, tag: string): StoryVideo | undefined {
  const url = (format: keyof StoryVideo) =>
    storyAssetUrl(`videos/${name}${tag}${videoFiles.formats[format]}`);
  const av1 = url('av1');
  const h265 = url('h265');
  const h264 = url('h264');
  const webm = url('webm');
  return av1 && h265 && h264 && webm ? { av1, h265, h264, webm } : undefined;
}

/** Every size of a clip there is. vite.config.js stops the build when the
 *  1080 set is incomplete, so it is always there. */
function videoSizes(name: string): StoryVideoSizes {
  const full = videoAt(name, videoFiles.sizes[1080]);
  if (!full)
    throw new Error(`No 1080 files for ${name} in the story's videos/`);
  const small = videoAt(name, videoFiles.sizes[720]);
  return small ? { 1080: full, 720: small } : { 1080: full };
}

function resolve(d: RawStoriesData): StoriesData {
  return {
    stories: {
      ...d.stories,
      items: d.stories.items.map((s, i) => {
        const clip = s.video ?? `story_${i + 1}`;
        return { ...s, clip, video: videoSizes(clip) };
      }),
    },
    ui: {
      ...d.ui,
      storyIcon: resolveAssetUrl(d.ui.storyIcon),
      orientationLock: {
        ...d.ui.orientationLock,
        icon: resolveAssetUrl(d.ui.orientationLock.icon),
      },
    },
  };
}

const resolved = resolve(storiesData);

export function useStoriesData() {
  const title = computed<LocalizedText>(() => resolved.stories.title);
  const ui = computed<StoriesUI>(() => resolved.ui);
  const stories = computed<StoryData[]>(() => resolved.stories.items);
  return { title, ui, stories };
}
