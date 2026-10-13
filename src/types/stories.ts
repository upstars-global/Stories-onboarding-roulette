// Types for stories functionality based on actual JSON structure and usage

// One clip, four encodes. Which one plays is decided in useVideoFormat.
export interface StoryVideo {
  av1: string;
  h265: string;
  h264: string;
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
  // Only stories that have a help-text slide carry these strings.
  helpText?: DefaultsHelpText;
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

export interface StoryTextStep {
  // Seconds of video time at which this part starts typing.
  at: number;
  text: LocalizedText;
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
  // Optional: the description typed in parts, each started by the video clock
  // instead of all at once (e.g. "The deal": one sentence per group of cards
  // as they land). `description` still holds the whole text.
  descriptionSteps?: StoryTextStep[];
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
