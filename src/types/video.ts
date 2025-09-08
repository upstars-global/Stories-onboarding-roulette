// Types for video functionality

// VideoElement is just an alias for HTMLVideoElement since all properties are already included
export type VideoElement = HTMLVideoElement;

export interface VideoEvents {
  ended: () => void;
  timeupdate: () => void;
  loadedmetadata: () => void;
}

export interface VideoSource {
  src: string;
  type: string;
  codecs?: string;
}
