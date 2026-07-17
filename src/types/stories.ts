// Types for stories functionality based on actual JSON structure and usage

export interface StoryVideo {
  h265: string;
  webm: string;
}

export interface StoryCtaButton {
  enabled: boolean;
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
  // When true, this story shares the same progress-bar segment as the
  // previous story (used to auto-advance sub-scenes within one visual step,
  // e.g. "third card rules" for Player then Banker).
  mergeProgressWithPrevious?: boolean;
  // Optional mid-video text phase (e.g. glued Player→Banker clip):
  // at `phaseSwitchAt` seconds swap to secondHeader/secondDescription
  // without remounting the video element.
  phaseSwitchAt?: number;
  secondHeader?: LocalizedText;
  secondDescription?: LocalizedText;
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
