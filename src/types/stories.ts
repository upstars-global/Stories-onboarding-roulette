// Types for stories functionality based on actual JSON structure and usage

export interface StoryVideo {
  h265: string;
  webm: string;
}

export interface StoryCtaButton {
  enabled: boolean;
  text: string;
}

export interface StoryHelpText {
  enabled: boolean;
  text: string;
  link: string;
}

export interface StoryData {
  id: string;
  topText: string;
  header: string;
  description: string;
  video: StoryVideo;
  ctaButton: StoryCtaButton;
  helpText?: StoryHelpText;
}

export interface StoriesAssets {
  storyIcon: string;
}

export interface StoriesData {
  assets: StoriesAssets;
  title: string;
  stories: StoryData[];
}
