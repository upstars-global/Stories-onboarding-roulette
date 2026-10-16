// Types for stories functionality based on actual JSON structure and usage

// One clip, four encodes. Which one plays is decided in useVideoFormat.
export interface StoryVideo {
  av1: string;
  h265: string;
  h264: string;
  webm: string;
}

// The same clip at each frame width it was encoded at. useVideoFormat picks
// the width from how large the clip is drawn; a clip without a 720 set plays
// the 1080 one everywhere.
export interface StoryVideoSizes {
  1080: StoryVideo;
  720?: StoryVideo;
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
  // The clip's name (`story_3`); the story's soundtrack finds the clip's place
  // in the music by it.
  clip: string;
  video: StoryVideoSizes;
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

// A slide as stories/<name>/stories.json writes it. `video` names the clip
// (`story_3`); its files are found in the story's videos/ folder by the names
// the encode script gives them (src/data/video-files.json). Left out, it is
// story_<slide number>.
export interface RawStoryData extends Omit<StoryData, 'video' | 'clip'> {
  video?: string;
}

// Where the story sends the player: the game when the site passes no
// game_link, and the analytics campaign added to end_link.
export interface StoryLinks {
  game: string;
  utmCampaign: string;
}

// stories/<name>/stories.json as a whole.
export interface RawStoriesData {
  stories: {
    title: LocalizedText;
    items: RawStoryData[];
  };
  ui: StoriesUI;
  links: StoryLinks;
}
