// Types for stories functionality based on actual JSON structure and usage

export interface StoryVideo {
  h265: string;
  webm: string;
}

export interface StoryCtaButton {
  enabled: boolean;
  text: LocalizedText;
}

export interface StoryHelpText {
  enabled: boolean;
  text: LocalizedText;
  link: LocalizedText;
}

export interface LocalizedText {
  en: string;
  de: string;
  fr: string;
  it: string;
  es: string;
  pt: string;
  [key: string]: string;
}

export interface StoryData {
  id: string;
  topText: LocalizedText;
  header: LocalizedText;
  description: LocalizedText;
  video: StoryVideo;
  ctaButton: StoryCtaButton;
  helpText?: StoryHelpText;
}

export interface StoriesAssets {
  storyIcon: string;
}

export interface StoriesData {
  assets: StoriesAssets;
  title: LocalizedText;
  stories: StoryData[];
}
