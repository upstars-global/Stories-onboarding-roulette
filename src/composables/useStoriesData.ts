import { computed } from 'vue';
import storiesData from '@/data/stories.json';
import type {
  StoriesData,
  StoryData,
  StoryVideo,
  LocalizedText,
  StoriesUI,
} from '@/types/stories';
import { resolveAssetUrl } from '@/composables/useAssetUrl';

const raw = storiesData as StoriesData;

const mapVideo = (v: StoryVideo): StoryVideo => ({
  av1: resolveAssetUrl(v.av1),
  h265: resolveAssetUrl(v.h265),
  h264: resolveAssetUrl(v.h264),
  webm: resolveAssetUrl(v.webm),
});

function mapAssetPaths(d: StoriesData): StoriesData {
  return {
    ...d,
    stories: {
      ...d.stories,
      items: d.stories.items.map((s) => ({
        ...s,
        video: {
          1080: mapVideo(s.video[1080]),
          ...(s.video[720] && { 720: mapVideo(s.video[720]) }),
        },
      })),
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

const resolved = mapAssetPaths(raw);

export function useStoriesData() {
  const title = computed<LocalizedText>(() => resolved.stories.title);
  const ui = computed<StoriesUI>(() => resolved.ui);
  const stories = computed<StoryData[]>(() => resolved.stories.items);
  return { title, ui, stories };
}
