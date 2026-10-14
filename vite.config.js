import { URL } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';
import path from 'path';

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

/**
 * Names the page after the story and checks its videos before anything is
 * built: every slide needs its four 1080 files, and a 720 set is either
 * complete or absent. A missing file would otherwise surface only as a slide
 * that never plays.
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
