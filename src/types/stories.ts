// Types for stories functionality based on actual JSON structure and usage

export interface StoryVideo {
  h265: string;
  webm: string;
}

export interface StoryCtaButton {
  enabled: boolean;
  text?: LocalizedText;
}

export interface StoryHelpText {
  enabled: boolean;
}

export interface DefaultsCtaButton {
  text: LocalizedText;
}

export interface DefaultsHelpText {
  text: LocalizedText;
  link: LocalizedText;
}

export interface StoriesUI {
  storyIcon: string;
  orientationLock: OrientationLock;
  ctaButton: DefaultsCtaButton;
  helpText: DefaultsHelpText;
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

export interface OrientationLock {
  icon: string;
  title: LocalizedText;
  description: LocalizedText;
}

export interface StoriesData {
  stories: {
    title: LocalizedText;
    items: StoryData[];
  };
  ui: StoriesUI;
}
