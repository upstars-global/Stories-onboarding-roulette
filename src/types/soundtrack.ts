// stories/<name>/audio/soundtrack.json as scripts/build-story-soundtrack.mjs
// writes it; only what the player reads is typed here.

export interface SoundtrackSlide {
  // The clip, as stories.json names it (`story_3`).
  video: string;
  // Seconds into the track at which the clip's first frame belongs.
  start: number;
}

export interface Soundtrack {
  // The track's files in the story's audio/ folder.
  files: {
    m4a: string;
    webm: string;
  };
  // Length of the track in seconds.
  duration: number;
  // One bar of the music, in seconds: the player moves the track by whole
  // steps so the beat goes on. Null for music that does not repeat.
  step: number | null;
  slides: SoundtrackSlide[];
}
