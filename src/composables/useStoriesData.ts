import { computed } from 'vue';
import type { StoriesData, StoriesAssets, StoryData } from '@/types/stories';
import storiesData from '@/data/stories.json';

const typedStoriesData = storiesData as StoriesData;

export function useStoriesData() {
  const assets = computed<StoriesAssets>(() => typedStoriesData.assets);
  const title = computed<string>(() => typedStoriesData.title);
  const stories = computed<StoryData[]>(() => typedStoriesData.stories);

  return {
    assets,
    title,
    stories,
  };
}
