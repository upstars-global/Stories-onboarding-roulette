import { computed } from 'vue';
import storiesData from '@/data/stories.json';
import type {
  StoriesData,
  StoryData,
  LocalizedText,
  StoriesUI,
} from '@/types/stories';
import { resolveAssetUrl } from '@/composables/useAssetUrl';

const raw = storiesData as StoriesData;

function mapAssetPaths(d: StoriesData): StoriesData {
  return {
    ...d,
    stories: {
      ...d.stories,
      items: d.stories.items.map((s) => ({
        ...s,
        video: {
          ...s.video,
          h265: resolveAssetUrl(s.video.h265),
          webm: resolveAssetUrl(s.video.webm),
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
