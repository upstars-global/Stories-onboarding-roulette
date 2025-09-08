// Types for Vue components

export interface StorySlideRef {
  videoRef: HTMLVideoElement | null;
}

export interface StoriesState {
  currentIndex: number;
  progress: number;
  paused: boolean;
  isMuted: boolean;
  wasLongPress: boolean;
}
