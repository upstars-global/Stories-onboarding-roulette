/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, unknown>;
  export default component;
}

// The story being built: vite.config.js points `@story` at stories/<name>.
declare module '@story/stories.json' {
  import type { RawStoriesData } from '@/types';
  const data: RawStoriesData;
  export default data;
}
