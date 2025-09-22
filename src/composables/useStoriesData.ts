import { computed } from 'vue';
import storiesData from '@/data/stories.json';
import type {
  StoriesData,
  StoriesAssets,
  StoryData,
  LocalizedText,
} from '@/types/stories';
import { resolveAssetUrl } from '@/composables/useAssetUrl';

const raw = storiesData as StoriesData;

function mapAssetPaths(d: StoriesData): StoriesData {
  return {
    ...d,
    assets: {
      ...d.assets,
      storyIcon: resolveAssetUrl(d.assets.storyIcon),
    },
    stories: d.stories.map((s) => ({
      ...s,
      video: {
        ...s.video,
        h265: resolveAssetUrl(s.video.h265),
        webm: resolveAssetUrl(s.video.webm),
      },
      // если позже появятся картинки в сторис — добавляй сюда поля и через resolveAssetUrl(...)
    })),
  };
}

const resolved = mapAssetPaths(raw);

export function useStoriesData() {
  const assets = computed<StoriesAssets>(() => resolved.assets);
  const title = computed<LocalizedText>(() => resolved.title);
  const stories = computed<StoryData[]>(() => resolved.stories);
  return { assets, title, stories };
}
