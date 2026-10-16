// Moves a story's sound out of its clips into one track that plays on through
// the slide changes: stories/<name>/audio/soundtrack.m4a (HE-AAC) and .webm
// (Opus, for browsers without it), and soundtrack.json, which says where in
// the track each clip starts. The clips in stories/<name>/videos are then
// rewritten without sound (scripts/without-sound.mjs) and video-report.json
// follows them.
//
// Usage: npm run audio:build -- --story <name> --src <dir with the masters>
//
// Run it after `npm run video:encode`: the masters are the ones video-report.json
// names for each clip. After the clips are encoded from new masters it has to
// run again; until it does, the build stops (vite.config.js compares the two).
// `--story` can be left out while stories/ holds a single story.
//
// WHICH SOUND
// The designer's .mp4 stores the sound as AAC that starts 2112 samples late
// (the encoder's delay, left in) and so loses the last 44 ms of every clip.
// The .mov export of the same clip holds it uncompressed and in step with the
// picture. For every master the uncompressed sound of the same slide is taken
// when there is one: a file next to it whose name begins with the master's
// (`3-HEVC Alpha 3Mbps.mov` next to `3.mp4`), as long, with PCM sound.
// Otherwise the master's own sound is used.
//
// HOW THE CLIPS ARE JOINED: see scripts/join-clips.mjs.
//
// THE STEP
// soundtrack.json also gives `step`: a quarter of the period the music
// repeats in, measured on the finished track; on a four-bar loop, one bar.
// When the music has to catch up with the picture the player moves it by
// whole steps, so the beat goes on.
//
// Prerequisite: ffmpeg with libopus (`brew install ffmpeg`).

import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cut, describe, join } from './join-clips.mjs';
import { RATE, repeatPeriod, spectrum } from './music-match.mjs';
import {
  oneFramePerChunkInPlace,
  silentEntry,
  withoutSound,
} from './without-sound.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORIES = path.join(ROOT, 'stories');

// Small, so the music is in memory within about a second of the story
// opening and the sound button starts it from there (src/composables/
// useSoundtrack.ts): 64 kbit/s, about 1 MB for two minutes. Plain AAC loses
// the high notes at that rate, HE-AAC rebuilds them. ffmpeg's own AAC
// encoder, used where AudioToolbox is missing, has no HE-AAC and gets
// 96 kbit/s instead.
const AAC = {
  // Profile 4 is HE-AAC.
  aac_at: ['-profile:a', '4', '-b:a', '64000'],
  aac: ['-b:a', '96000'],
};
const OPUS_BITRATE = 64_000;

/** Longest step the player may move the music by; see THE STEP. */
const MAX_STEP = 2.5;

const FFMPEG = ['-hide_banner', '-nostdin', '-loglevel', 'error'];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    let err = '';
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(out))
        : reject(new Error(`${cmd} exited ${code}\n${err.slice(-2000)}`))
    );
  });
}

async function storyFolder(wanted) {
  const names = (await readdir(STORIES, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const name = wanted ?? (names.length === 1 ? names[0] : null);
  if (!name || !names.includes(name)) {
    throw new Error(
      `Name the story: --story <name>. There are: ${names.join(', ')}`
    );
  }
  return path.join(STORIES, name);
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) {
      throw new Error(`unexpected argument: ${argv[i]}`);
    }
    flags[argv[i].slice(2)] = argv[++i];
  }
  if (!flags.src) {
    throw new Error(
      'usage: npm run audio:build -- --story <name> --src <dir with masters>'
    );
  }
  return { story: flags.story, src: path.resolve(flags.src) };
}

/** The codec of a file's first sound track (undefined without one), and the
 *  file's length in seconds. */
async function soundInfo(file) {
  try {
    const out = await run('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_name:format=duration',
      '-of',
      'json',
      file,
    ]);
    const { streams = [], format = {} } = JSON.parse(out.toString());
    return { codec: streams[0]?.codec_name, duration: Number(format.duration) };
  } catch {
    return {};
  }
}

/** The file to take a clip's sound from; see WHICH SOUND. */
async function soundOf(src, master, duration) {
  const base = path.parse(master).name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sameSlide = new RegExp(`^${base}(?![\\d_])`);
  const files = (await readdir(src))
    .filter((f) => f !== master && sameSlide.test(f))
    .sort();
  for (const file of files) {
    const info = await soundInfo(path.join(src, file));
    if (
      info.codec?.startsWith('pcm_') &&
      Math.abs(info.duration - duration) < 0.05
    ) {
      return file;
    }
  }
  return master;
}

/** Interleaved stereo float samples, exactly `frames` of them. */
async function decode(file, frames) {
  const raw = await run('ffmpeg', [
    ...FFMPEG,
    '-i',
    file,
    '-map',
    '0:a:0',
    '-ac',
    '2',
    '-ar',
    String(RATE),
    '-f',
    'f32le',
    '-',
  ]);
  const all = new Float32Array(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length)
  );
  const pcm = new Float32Array(frames * 2);
  pcm.set(all.subarray(0, Math.min(all.length, frames * 2)));
  return pcm;
}

/** Samples at either end of a clip that hold no sound at all. */
function silentEdges(pcm) {
  const frames = pcm.length / 2;
  const quiet = (i) =>
    Math.abs(pcm[2 * i]) < 1e-5 && Math.abs(pcm[2 * i + 1]) < 1e-5;
  let head = 0;
  while (head < frames && quiet(head)) head += 1;
  let tail = 0;
  while (tail < frames - head && quiet(frames - 1 - tail)) tail += 1;
  return { head, tail };
}

function mono(pcm) {
  const m = new Float32Array(pcm.length / 2);
  for (let i = 0; i < m.length; i += 1) {
    m[i] = (pcm[2 * i] + pcm[2 * i + 1]) / 2;
  }
  return m;
}

async function encodeTrack(pcm, dir) {
  const encoders = (
    await run('ffmpeg', ['-hide_banner', '-encoders'])
  ).toString();
  // AudioToolbox's AAC is cleaner than ffmpeg's own; elsewhere the latter.
  const aac = /\baac_at\b/.test(encoders) ? 'aac_at' : 'aac';
  const raw = path.join(os.tmpdir(), `story-soundtrack-${process.pid}.f32`);
  await writeFile(raw, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  const input = ['-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', raw];
  // bitexact: the same track makes the same files, so a run that changes
  // nothing leaves nothing to commit (WebM otherwise gets a random id).
  const exact = ['-fflags', '+bitexact', '-flags:a', '+bitexact'];
  try {
    await run('ffmpeg', [
      ...FFMPEG,
      '-y',
      ...input,
      '-c:a',
      aac,
      ...AAC[aac],
      ...exact,
      '-map_metadata',
      '-1',
      '-movflags',
      '+faststart',
      path.join(dir, 'soundtrack.m4a'),
    ]);
    await run('ffmpeg', [
      ...FFMPEG,
      '-y',
      ...input,
      '-c:a',
      'libopus',
      '-b:a',
      String(OPUS_BITRATE),
      ...exact,
      '-map_metadata',
      '-1',
      '-cues_to_front',
      '1',
      path.join(dir, 'soundtrack.webm'),
    ]);
  } finally {
    await rm(raw, { force: true });
  }
}

/** Takes the sound out of every clip file the report lists, rewrites the
 *  index of the ones already silent (see scripts/without-sound.mjs) and
 *  updates the report's entries; returns how many files had sound. */
async function silenceClips(folder, report) {
  let count = 0;
  for (const clip of report.clips) {
    for (const [key, entry] of Object.entries(clip.files)) {
      const file = path.join(folder, 'videos', entry.file);
      const { codec } = await soundInfo(file);
      const bytes = codec
        ? await withoutSound(file)
        : await oneFramePerChunkInPlace(file);
      if (codec) count += 1;
      clip.files[key] = silentEntry(entry, bytes);
    }
  }
  return count;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const folder = await storyFolder(args.story);
  const story = JSON.parse(
    await readFile(path.join(folder, 'stories.json'), 'utf8')
  );
  const reportFile = path.join(folder, 'video-report.json');
  const report = JSON.parse(
    await readFile(reportFile, 'utf8').catch(() => 'null')
  );
  if (!report) {
    throw new Error(`${reportFile} is missing: run npm run video:encode first`);
  }

  const clips = [];
  for (const [i, item] of story.stories.items.entries()) {
    const video = item.video ?? `story_${i + 1}`;
    const entry = report.clips.find((c) => c.name === video);
    if (!entry) {
      throw new Error(`video-report.json has no ${video}: encode it first`);
    }
    const frames = Math.round(entry.duration * RATE);
    const sound = await soundOf(args.src, entry.master, entry.duration);
    const pcm = await decode(path.join(args.src, sound), frames);
    const m = mono(pcm);
    clips.push({
      video,
      master: entry.master,
      sound,
      duration: entry.duration,
      frames,
      pcm,
      mono: m,
      spectrum: spectrum(m),
      ...silentEdges(pcm),
    });
    console.log(`${video}: sound from ${sound}`);
  }

  const cuts = clips.slice(0, -1).map((_, k) => cut(clips, k));
  const { pcm, starts } = join(clips, cuts);
  const period = repeatPeriod(mono(pcm));
  let step = period && period / 4 / RATE;
  while (step && step > MAX_STEP) step /= 2;

  const out = path.join(folder, 'audio');
  await mkdir(out, { recursive: true });
  await encodeTrack(pcm, out);
  const silenced = await silenceClips(folder, report);
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);

  const seconds = (samples) => Number((samples / RATE).toFixed(4));
  const manifest = {
    generatedAt: new Date().toISOString(),
    files: { m4a: 'soundtrack.m4a', webm: 'soundtrack.webm' },
    duration: seconds(pcm.length / 2),
    step: step ? Number(step.toFixed(5)) : null,
    slides: clips.map((c, k) => ({
      video: c.video,
      master: c.master,
      sound: c.sound,
      duration: c.duration,
      start: seconds(starts[k]),
    })),
    cuts: cuts.map((c, k) => describe(c, k, clips)),
  };
  await writeFile(
    path.join(out, 'soundtrack.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  console.log(`\n${manifest.cuts.join('\n')}`);
  console.log(
    `\ntrack ${manifest.duration} s; the music repeats every ` +
      `${period ? (period / RATE).toFixed(4) : '-'} s, step ${manifest.step ?? '-'} s` +
      `\nslides start at ${manifest.slides.map((s) => s.start.toFixed(3)).join(', ')} s` +
      `\nsound taken out of ${silenced} clip file(s); the track is in ${path.relative(ROOT, out)}`
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
