// A clip without its sound track, for a story whose music plays from its own
// file (scripts/build-story-soundtrack.mjs). The picture is copied as it is,
// not encoded again, so the frames and the scores in video-report.json still
// hold; only the size and the `codecs` value change, and silentEntry() says
// how.
//
// An MP4 that loses its sound also gets its index rewritten so that every
// frame is a chunk of its own (scripts/mp4-index.mjs): as ffmpeg writes it,
// Safari would wait for seconds of video before the first frame.
import { spawn } from 'node:child_process';
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { largestChunk, oneFramePerChunk } from './mp4-index.mjs';

/** The same container settings the encoder ships with: the index at the front
 *  of an MP4 so playback can start before the file has arrived, the cues at
 *  the front of a WebM. */
const MUX = {
  '.mp4': ['-movflags', '+faststart'],
  '.webm': ['-cues_to_front', '1'],
};

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg exited ${code}\n${err.slice(-2000)}`))
    );
  });
}

/**
 * Writes `file` without sound to `out` (in place when they are the same) and
 * resolves with the new size in bytes.
 */
export async function withoutSound(file, out = file) {
  const ext = path.extname(out).toLowerCase();
  if (!MUX[ext]) throw new Error(`not a clip: ${out}`);
  const tmp = path.join(
    path.dirname(out),
    `.${path.basename(out)}.silent${ext}`
  );
  try {
    await ffmpeg([
      '-hide_banner',
      '-nostdin',
      '-loglevel',
      'error',
      '-y',
      '-i',
      file,
      '-map',
      '0:v:0',
      '-c',
      'copy',
      '-map_metadata',
      '-1',
      '-map_chapters',
      '-1',
      // The same clip in makes the same file out.
      '-fflags',
      '+bitexact',
      ...MUX[ext],
      tmp,
    ]);
    if (ext === '.mp4') {
      await writeFile(tmp, oneFramePerChunk(await readFile(tmp)));
    }
    await rename(tmp, out);
  } finally {
    await rm(tmp, { force: true });
  }
  return (await stat(out)).size;
}

/**
 * Rewrites the index of a silent MP4 written before the rewrite existed, in
 * place; resolves with its size in bytes either way.
 */
export async function oneFramePerChunkInPlace(file) {
  if (path.extname(file).toLowerCase() === '.mp4') {
    const buf = await readFile(file);
    if (largestChunk(buf) > 1) await writeFile(file, oneFramePerChunk(buf));
  }
  return (await stat(file)).size;
}

/** A video-report.json file entry once its clip has lost the sound. */
export function silentEntry(entry, bytes) {
  const container = path.extname(entry.file) === '.webm' ? 'webm' : 'mp4';
  return {
    ...entry,
    bytes,
    type: `video/${container}; codecs="${entry.codecs.video}"`,
    codecs: { ...entry.codecs, audio: null },
    hasAudio: false,
  };
}
