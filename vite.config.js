import { URL } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';
import path from 'path';
import { largestChunk } from './scripts/mp4-index.mjs';

// Every story is a folder in stories/: its texts (stories.json), its look
// (story.scss), its icon and videos. The code is shared. One build makes one
// story, into dist/<name> — the folder that goes to the CDN as
// common/stories/<name>.
const STORIES = path.resolve(__dirname, 'stories');

/** The story to build: STORY=<name> (scripts/story.mjs sets it from
 *  `npm run dev <name>`), or the only one there is. */
function pickStory() {
  const names = readdirSync(STORIES).filter((name) =>
    existsSync(path.join(STORIES, name, 'stories.json'))
  );
  const wanted = process.env.STORY;
  if (wanted) {
    if (names.includes(wanted)) return wanted;
    throw new Error(
      `No story "${wanted}" in stories/. There are: ${names.join(', ')}`
    );
  }
  if (names.length === 1) return names[0];
  throw new Error(
    `Name the story: npm run dev <name>. There are: ${names.join(', ')}`
  );
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** Frames one chunk of a clip may hold: about a second of video. */
const CHUNK_FRAMES = 30;

/**
 * Clips whose frames sit in big chunks. Safari shows nothing of a chunk until
 * all of it has arrived, so such a clip waits for seconds of video before its
 * first frame (scripts/mp4-index.mjs). A clip with sound never has them; a
 * clip without sound has them unless its index was rewritten.
 */
function chunkProblems(dir, name) {
  const videos = path.join(dir, 'videos');
  if (!existsSync(videos)) return [];
  return readdirSync(videos)
    .filter((file) => file.endsWith('.mp4'))
    .flatMap((file) => {
      const frames = largestChunk(readFileSync(path.join(videos, file)));
      return frames > CHUNK_FRAMES
        ? [
            `videos/${file} keeps ${frames} frames in one chunk; rewrite the index: npm run audio:build -- --story ${name} --src <dir with the masters>`,
          ]
        : [];
    });
}

/**
 * A story whose music has a track of its own (audio/soundtrack.json, made by
 * scripts/build-story-soundtrack.mjs) needs that track made for the slides it
 * plays and from the masters its videos came from: the track says where each
 * clip starts in it, so new clips leave it out of step until it is made again.
 */
function soundtrackProblems(dir, name, clips) {
  const file = path.join(dir, 'audio', 'soundtrack.json');
  if (!existsSync(file)) return [];
  const track = readJson(file);
  const again = `make it again: npm run audio:build -- --story ${name} --src <dir with the masters>`;
  const problems = Object.values(track.files)
    .filter((sound) => !existsSync(path.join(dir, 'audio', sound)))
    .map((sound) => `audio/${sound} is missing`);
  const made = track.slides.map((slide) => slide.video);
  if (made.join() !== clips.join()) {
    problems.push(
      `the track is for ${made.join(', ')}, the slides play ${clips.join(', ')}; ${again}`
    );
  }
  const report = path.join(dir, 'video-report.json');
  const encoded = existsSync(report) ? readJson(report).clips : [];
  for (const slide of track.slides) {
    const video = encoded.find((clip) => clip.name === slide.video);
    if (
      video &&
      (video.master !== slide.master ||
        Math.abs(video.duration - slide.duration) > 0.001)
    ) {
      problems.push(
        `${slide.video} is encoded from ${video.master} (${video.duration} s), its music is from ${slide.master} (${slide.duration} s); ${again}`
      );
    }
  }
  return problems;
}

/**
 * Names the page after the story and checks its videos before anything is
 * built: every slide needs its four 1080 files, and a 720 set is either
 * complete or absent. A missing file would otherwise surface only as a slide
 * that never plays. The music track, where the story has one, is checked
 * against the slides too (soundtrackProblems).
 */
function story(name) {
  const dir = path.join(STORIES, name);
  const data = readJson(path.join(dir, 'stories.json'));
  const naming = readJson(path.resolve(__dirname, 'src/data/video-files.json'));
  const title = String(data.stories.title.en)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');

  return {
    name: 'story',
    buildStart() {
      const have = new Set(
        existsSync(path.join(dir, 'videos'))
          ? readdirSync(path.join(dir, 'videos'))
          : []
      );
      const problems = data.stories.items.flatMap((item, i) => {
        const clip = item.video ?? `story_${i + 1}`;
        return Object.entries(naming.sizes).flatMap(([size, tag]) => {
          const files = Object.values(naming.formats).map(
            (suffix) => `${clip}${tag}${suffix}`
          );
          const missing = files.filter((file) => !have.has(file));
          const optional = size !== '1080' && missing.length === files.length;
          return missing.length && !optional
            ? [`slide ${i + 1}: ${missing.join(', ')}`]
            : [];
        });
      });
      if (problems.length) {
        this.error(
          `stories/${name}/videos is missing files:\n  ${problems.join('\n  ')}`
        );
      }
      const chunks = chunkProblems(dir, name);
      if (chunks.length) {
        this.error(
          `stories/${name}/videos has clips Safari plays late:\n  ${chunks.join('\n  ')}`
        );
      }
      const sound = soundtrackProblems(
        dir,
        name,
        data.stories.items.map((item, i) => item.video ?? `story_${i + 1}`)
      );
      if (sound.length) {
        this.error(
          `stories/${name}/audio does not fit the story:\n  ${sound.join('\n  ')}`
        );
      }
    },
    transformIndexHtml(html) {
      return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    },
  };
}

const storyName = pickStory();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), svgLoader(), story(storyName)],
  base: './',
  build: {
    outDir: `dist/${storyName}`,
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @use "@/assets/scss/index.scss" as *;
        `,
      },
    },
  },
  resolve: {
    alias: {
      '@story': path.join(STORIES, storyName),
      '@components': path.resolve(__dirname, './src/components'),
      '@plugins': path.resolve(__dirname, './src/plugins'),
      '@src': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
