// Turns the motion designer's masters into the four files a story slide ships —
// AV1, HEVC, VP9 (WebM) and H.264 — and picks the compression per clip instead
// of trusting one hand-tuned number for all of them.
//
// Usage: node scripts/encode-story-videos.mjs --src <dir with the masters>
//        [--out src/assets/videos/stories/en] [--report docs/poker-video-report.json]
//        [--only story_2,story_5] [--formats av1,h265,h264,webm]
//        [--work DIR] [--jobs 3]
//        [--min-vmaf 95] [--min-vmaf-p1 90] [--banding-room 4]
//
// Prerequisite: ffmpeg/ffprobe built with libsvtav1, libx265, libvpx-vp9,
// libx264, libopus and libvmaf (`brew install ffmpeg`).
//
// The work directory keeps every encode it has scored, keyed by clip, codec
// and CRF, so an interrupted run picks up where it stopped. It does not know
// the encoder settings: after changing them in FORMATS, delete that codec's
// files from the work directory.
//
// WHICH MASTER
// The designer exports every clip three times: `N.mp4` (H.264), `N.webm` (VP9)
// and `N-HEVC Alpha 3Mbps.mov`. Only the .mp4 is a source. Measured on the poker
// set: its colours match the Figma frames to within one code value, while the
// .webm is colour-shifted (the green background reads #064f09 instead of
// #004408), and the .mov is the same picture with an alpha layer that is 255
// everywhere plus uncompressed PCM. So the masters directory needs the seven
// .mp4 files and nothing else.
//
// OPAQUE, NOT ALPHA
// Earlier stories shipped a transparent card over a background painted by the
// app, which is what scripts/black-matte-to-alpha.mjs is for. These clips carry
// their background baked into a full 1080x1920 frame, so there is no alpha to
// keep — and H.264 and AV1 could not carry one anyway.
//
// HOW THE COMPRESSION IS PICKED
// Each clip gets its own CRF per codec: the highest one (the smallest file)
// that still clears two floors against the master. A 44 s clip of flat cards
// and a 21 s clip of live footage do not want the same number. The search runs
// on a fast encoder preset; the file that ships is then encoded with the slow
// preset, measured again in full, and its CRF nudged a step at a time until it
// sits on the floor.
//
// Floor one is VMAF, on average and on the worst 1% of frames.
//
// Floor two is banding, and it is there because VMAF does not see it. The table
// in these clips is a soft green spotlight that the designer dithered with fine
// noise. AV1, HEVC and VP9 smooth that noise away at any CRF worth using, and
// what is left is a staircase: the same frames score VMAF 95-96 and look clean
// at a glance, while CAMBI (a banding metric: 0 is none, the masters read about
// 4) climbs to 9-15. x264 keeps the noise and stays near the master. So every
// encode must also be no more banded than its master plus a margin, and each
// codec gets what it has to meet that cheaply:
//   - AV1: film grain synthesis. The encoder drops the noise and the decoder
//     draws it back, which takes banding to about zero for a few kilobytes.
//     Level 4 is the lowest that works here (3 leaves some frames banded, 2
//     does nothing) and does not read as grain on the cards.
//   - HEVC: psy-rd, psy-rdoq and no SAO keep more of the noise at the same
//     size (banding 10.2 -> 8.2 at CRF 27-28); the margin then sets the CRF.
//     Encoding 10-bit did not help: the staircase comes from the quantiser,
//     not from the bit depth.
//   - VP9: nothing helps. `-tune-content film` and switching the alt-ref
//     filter off changed the score by 0.1, and a lower CRF barely moves it: on
//     the 44 s clip one step down took banding from 14.1 to 13.9 for 4% more
//     bytes, against a master of 4.9. The margin is out of reach at any size
//     worth shipping — the file would pass the H.264 one long before — so VP9
//     is not held to this floor. Its CRF ceiling bounds it instead, the
//     banding is still reported, and the player tries it last.
//
// Each codec also has a CRF ceiling the search never crosses. Past it the
// low-contrast detail goes — the hand fading out, the soft shadows — and
// neither metric charges for that.
//
// H.264 alone has a hard size cap as well. It is the least efficient of the
// four, so on the long clips quality alone would overshoot it; those are
// re-encoded in two passes to fit.
//
// The frame stays 1080x1920. At an equal file size it scored higher than
// 720x1280 upscaled (96.1 against 91.9 on the 44 s clip), and a phone at 3x
// shows every one of those pixels.
//
// Audio is kept: the story has a sound button and these clips have a real
// soundtrack. The <video> still has to start muted, or it will not autoplay.

import { spawn } from 'node:child_process';
import {
  copyFile,
  mkdir,
  open,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Master file -> slide. The designer numbers revisions (`2_1`), slides do not. */
const CLIPS = [
  { master: '1.mp4', name: 'story_1' },
  { master: '2_1.mp4', name: 'story_2' },
  { master: '3.mp4', name: 'story_3' },
  { master: '4.mp4', name: 'story_4' },
  { master: '5.mp4', name: 'story_5' },
  { master: '6.mp4', name: 'story_6' },
  { master: '7.mp4', name: 'story_7' },
];

/** VMAF floor against the master: the mean, and the worst 1% of frames. */
const MIN_VMAF = 95;
const MIN_VMAF_P1 = 90;
/** How much more banded than its master (CAMBI) an encode may be. */
const BANDING_ROOM = 4;
/** Lowest AV1 film grain level that removes the banding in these clips. */
const AV1_GRAIN = 4;
/** The task's "up to 5 MB is acceptable for H.264", audio included. */
const H264_MAX_BYTES = 5_000_000;
/** Slides always play from the start and are never seeked into, so a 2 s GOP
 *  costs nothing at runtime and saves a keyframe every other second. */
const GOP = 60;
const AAC_BITRATE = 96_000;
const OPUS_BITRATE = 80_000;
/** During the CRF search only every third frame is scored: the means barely
 *  move and the search gets three times faster. The shipped file is scored in
 *  full. */
const SEARCH_SUBSAMPLE = 3;
const VMAF_THREADS = 4;
/** Largest per-channel drift of the background colour that still counts as
 *  "the same colour". The page paints this colour above the clip on tall
 *  phones, so a drift would show as a seam. */
const COLOUR_TOLERANCE = 2;

/**
 * `crf.max` is the ceiling described above and the first value the search
 * tries; `codec` returns the encoder arguments, with `final` switching from the
 * fast preset used while searching to the slow one that ships.
 */
const FORMATS = {
  av1: {
    suffix: '-av1.mp4',
    container: 'mp4',
    audio: 'aac',
    crf: { min: 26, max: 44 },
    // film-grain-denoise=0: the grain is added on top, the picture itself is
    // not run through the denoiser first.
    //
    // Known and not applied: for a few frames the cards fading out in clip 5
    // smear more here than in the other three formats. Adding
    // `enable-variance-boost=1` kept them sharp in a 150-frame trial and let
    // the ceiling rise to 52 at a smaller size. The shipped files were encoded
    // without it; switching it on means re-encoding all seven AV1 files.
    codec: ({ crf, final }) => [
      '-c:v',
      'libsvtav1',
      '-preset',
      final ? '4' : '8',
      '-crf',
      String(crf),
      '-svtav1-params',
      `film-grain=${AV1_GRAIN}:film-grain-denoise=0`,
    ],
  },
  h265: {
    suffix: '-h265.mp4',
    container: 'mp4',
    audio: 'aac',
    crf: { min: 20, max: 28 },
    // hvc1, not the default hev1: WebKit refuses to play the latter. aq-mode 3
    // spends more bits on dark areas, where the table and the dark-red gradient
    // of slide 1 would band first.
    codec: ({ crf, final }) => [
      '-c:v',
      'libx265',
      '-preset',
      final ? 'slow' : 'medium',
      '-crf',
      String(crf),
      '-tag:v',
      'hvc1',
      '-x265-params',
      'aq-mode=3:no-sao=1:psy-rd=2.0:psy-rdoq=2.0:deblock=-2,-2:log-level=error',
    ],
  },
  h264: {
    suffix: '-h264.mp4',
    container: 'mp4',
    audio: 'aac',
    crf: { min: 18, max: 26 },
    maxBytes: H264_MAX_BYTES,
    // Level 4.0 holds four reference frames at 1080x1920; the slow preset asks
    // for five, which would silently push the stream to a higher level.
    codec: ({ crf, bitrate, final }) => [
      '-c:v',
      'libx264',
      '-preset',
      final ? 'slow' : 'medium',
      '-profile:v',
      'high',
      '-level:v',
      '4.0',
      '-refs',
      '4',
      ...(bitrate ? ['-b:v', String(bitrate)] : ['-crf', String(crf)]),
    ],
  },
  webm: {
    suffix: '.webm',
    container: 'webm',
    audio: 'opus',
    crf: { min: 24, max: 36 },
    // See "Floor two" above: VP9 cannot meet the margin at a sane size.
    ignoreBanding: true,
    // Two passes during the search as well: one-pass VP9 scored 1.7 points
    // lower at the same CRF, so a one-pass search stops several steps early.
    twoPass: true,
    codec: ({ crf, final }) => [
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      String(crf),
      '-row-mt',
      '1',
      '-tile-columns',
      '2',
      '-deadline',
      'good',
      '-cpu-used',
      final ? '2' : '5',
    ],
  },
};

const VIDEO_COMMON = [
  '-map',
  '0:v:0',
  '-pix_fmt',
  'yuv420p',
  // Tagged explicitly: an untagged stream leaves the matrix to the browser's
  // guess, and a wrong guess is exactly the colour shift the designer's own
  // .webm has.
  '-color_primaries',
  'bt709',
  '-color_trc',
  'bt709',
  '-colorspace',
  'bt709',
  '-color_range',
  'tv',
  '-g',
  String(GOP),
];

const CONTAINER = {
  // faststart moves the index to the front, so playback begins before the file
  // has fully arrived and the next-clip prefetch gets the index in its range.
  mp4: {
    ext: '.mp4',
    args: [
      '-movflags',
      '+faststart',
      '-map_metadata',
      '-1',
      '-map_chapters',
      '-1',
      '-sn',
      '-dn',
    ],
  },
  webm: {
    ext: '.webm',
    args: [
      '-map_metadata',
      '-1',
      '-map_chapters',
      '-1',
      '-sn',
      '-dn',
      '-cues_to_front',
      '1',
    ],
  },
};

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument: ${a}`);
    flags[a.slice(2)] = argv[++i];
  }
  if (!flags.src) {
    throw new Error(
      'usage: node scripts/encode-story-videos.mjs --src <dir with masters> ' +
        '[--out DIR] [--report FILE] [--only story_2,story_5] ' +
        '[--formats av1,h265,h264,webm] [--work DIR] [--jobs N] ' +
        '[--min-vmaf N] [--min-vmaf-p1 N] [--banding-room N]'
    );
  }
  const list = (value) => (value ? value.split(',').filter(Boolean) : null);
  const formats = list(flags.formats) ?? Object.keys(FORMATS);
  for (const key of formats) {
    if (!FORMATS[key]) throw new Error(`unknown format: ${key}`);
  }
  return {
    src: path.resolve(flags.src),
    out: path.resolve(
      flags.out ?? path.join(ROOT, 'src/assets/videos/stories/en')
    ),
    report: path.resolve(
      flags.report ?? path.join(ROOT, 'docs/poker-video-report.json')
    ),
    work: path.resolve(
      flags.work ?? path.join(os.tmpdir(), 'story-video-encode')
    ),
    only: list(flags.only),
    formats,
    jobs: Number(flags.jobs ?? 3),
    floor: {
      mean: Number(flags['min-vmaf'] ?? MIN_VMAF),
      p1: Number(flags['min-vmaf-p1'] ?? MIN_VMAF_P1),
      bandingRoom: Number(flags['banding-room'] ?? BANDING_ROOM),
    },
  };
}

/** Runs a command and resolves with its stdout as a Buffer. Encoder chatter on
 *  stderr is kept only to explain a failure. */
function run(cmd, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
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

const FFMPEG = ['-hide_banner', '-nostdin', '-loglevel', 'error'];

async function probe(file) {
  const raw = await run('ffprobe', [
    '-v',
    'error',
    '-count_frames',
    '-show_entries',
    'stream=codec_type,codec_name,profile,width,height,r_frame_rate,nb_read_frames:format=duration',
    '-of',
    'json',
    file,
  ]);
  const { streams = [], format = {} } = JSON.parse(raw.toString());
  const v = streams.find((s) => s.codec_type === 'video');
  if (!v) throw new Error(`no video stream in ${file}`);
  const a = streams.find((s) => s.codec_type === 'audio');
  const [num, den] = v.r_frame_rate.split('/').map(Number);
  return {
    width: v.width,
    height: v.height,
    fps: num / (den || 1),
    frames: Number(v.nb_read_frames),
    duration: Number(format.duration),
    hasAudio: Boolean(a),
    audio: a ? { codec: a.codec_name, profile: a.profile } : null,
  };
}

/** Average colour of the top six rows of the first frame, as [r, g, b]. */
async function topColour(file) {
  const rgb = await run('ffmpeg', [
    ...FFMPEG,
    '-i',
    file,
    '-vf',
    'crop=iw:6:0:0,scale=1:1:flags=area,format=rgb24',
    '-frames:v',
    '1',
    '-f',
    'rawvideo',
    '-',
  ]);
  return [rgb[0], rgb[1], rgb[2]];
}

const hex = (rgb) =>
  `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

const mb = (bytes) => (bytes / 1e6).toFixed(2);

async function isFresh(file, than) {
  try {
    return (await stat(file)).mtimeMs >= (await stat(than)).mtimeMs;
  } catch {
    return false;
  }
}

async function encode({ clip, fmt, rate, final, out, ctx }) {
  const input = [...FFMPEG, '-y', '-i', clip.masterPath];
  const video = [...VIDEO_COMMON, ...fmt.codec({ ...rate, final })];
  // The search only looks at the picture; encoding sound for it is wasted time.
  const audio =
    final && clip.hasAudio
      ? ['-map', '0:a:0', ...ctx.audio[fmt.audio]]
      : ['-an'];
  const mux = CONTAINER[fmt.container].args;

  if (fmt.twoPass || rate.bitrate) {
    const passlog = `${out}.passlog`;
    await run('ffmpeg', [
      ...input,
      ...video,
      '-pass',
      '1',
      '-passlogfile',
      passlog,
      '-an',
      '-f',
      'null',
      os.devNull,
    ]);
    await run('ffmpeg', [
      ...input,
      ...video,
      '-pass',
      '2',
      '-passlogfile',
      passlog,
      ...audio,
      ...mux,
      out,
    ]);
    return;
  }
  await run('ffmpeg', [...input, ...video, ...audio, ...mux, out]);
}

/**
 * VMAF of `file` against the master, and the banding (CAMBI) of `file` itself.
 *
 * `settb=1/30,setpts=N` on both inputs is not decoration. The filter pairs
 * frames by timestamp, and a WebM keeps timestamps in whole milliseconds: 33 ms
 * sorts before the master's 33.33 ms, so that frame gets compared with the
 * master's previous one. A third of the frames end up one off, and anything
 * that moves scores as garbage — a clean VP9 encode read 61 instead of 95.
 * Renumbering both sides by frame index makes the pairing exact.
 */
async function measure({ file, master, subsample, label, work }) {
  const log = `${label}.vmaf.json`;
  const graph =
    '[0:v]settb=1/30,setpts=N[d];[1:v]settb=1/30,setpts=N[r];' +
    `[d][r]libvmaf=n_threads=${VMAF_THREADS}:n_subsample=${subsample}:` +
    `feature='name=cambi':log_fmt=json:log_path=${log}`;
  // Relative log path with cwd set to the work directory: the filter option
  // parser would otherwise need every special character in an absolute path
  // escaped — and nothing may be written next to the masters.
  await run(
    'ffmpeg',
    [
      ...FFMPEG,
      '-i',
      file,
      '-i',
      master,
      '-lavfi',
      graph,
      '-an',
      '-f',
      'null',
      '-',
    ],
    { cwd: work }
  );
  const { frames } = JSON.parse(await readFile(path.join(work, log), 'utf8'));
  const scores = frames.map((f) => f.metrics.vmaf).sort((a, b) => a - b);
  const at = (q) =>
    scores[Math.min(scores.length - 1, Math.floor(scores.length * q))];
  const mean = (values) =>
    values.reduce((sum, v) => sum + v, 0) / values.length;
  const round = (n) => Math.round(n * 100) / 100;
  return {
    vmaf: {
      mean: round(mean(scores)),
      p1: round(at(0.01)),
      p5: round(at(0.05)),
    },
    banding: round(mean(frames.map((f) => f.metrics.cambi))),
  };
}

/** What keeps an encode from shipping, or null when nothing does. */
function shortfall({ vmaf, banding }, clip, fmt, floor) {
  if (vmaf.mean < floor.mean || vmaf.p1 < floor.p1) return 'quality';
  if (!fmt.ignoreBanding && banding > clip.banding + floor.bandingRoom) {
    return 'banding';
  }
  return null;
}

const describe = (m, clip) =>
  `VMAF ${m.vmaf.mean} / worst 1% ${m.vmaf.p1}, banding ${m.banding} ` +
  `(master ${clip.banding})`;

/** One fast encode at a given CRF, scored. Cached, so an interrupted run or a
 *  re-run with different floors does not redo the encodes it already has. */
async function trial(clip, key, crf, ctx) {
  const fmt = FORMATS[key];
  const ext = CONTAINER[fmt.container].ext;
  const label = `${clip.name}.${key}.search.crf${crf}`;
  const out = path.join(ctx.work, `${label}${ext}`);
  const cache = `${out}.json`;
  if (await isFresh(cache, clip.masterPath)) {
    return JSON.parse(await readFile(cache, 'utf8'));
  }
  await encode({ clip, fmt, rate: { crf }, final: false, out, ctx });
  const result = {
    crf,
    bytes: (await stat(out)).size,
    ...(await measure({
      file: out,
      master: clip.masterPath,
      subsample: SEARCH_SUBSAMPLE,
      label,
      work: ctx.work,
    })),
  };
  await writeFile(cache, JSON.stringify(result));
  return result;
}

/** Highest CRF that still clears both floors. Quality falls and banding grows
 *  as CRF rises, so a binary search under the ceiling is enough — and it starts
 *  at the ceiling, which the short clips clear outright. */
async function pickCrf(clip, key, ctx) {
  const fmt = FORMATS[key];
  let lo = fmt.crf.min;
  let hi = fmt.crf.max;
  let best = null;
  let crf = hi;
  while (lo <= hi) {
    const t = await trial(clip, key, crf, ctx);
    const short = shortfall(t, clip, fmt, ctx.floor);
    ctx.log(
      clip,
      key,
      `crf ${crf}: ${describe(t, clip)}, ${mb(t.bytes)} MB video - ` +
        (short ? `held back by ${short}` : 'clears')
    );
    if (short) {
      hi = crf - 1;
    } else {
      best = crf;
      lo = crf + 1;
    }
    crf = Math.floor((lo + hi + 1) / 2);
  }
  return best ?? fmt.crf.min;
}

/** Reads the start of a file. With faststart the whole index sits there. */
async function readHead(file, limit = 4 * 1024 * 1024) {
  const handle = await open(file, 'r');
  try {
    const { size } = await handle.stat();
    const buffer = Buffer.alloc(Math.min(size, limit));
    await handle.read(buffer, 0, buffer.length, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

/** True when `moov` precedes `mdat` at the top level of an MP4. */
function moovFirst(head) {
  let offset = 0;
  while (offset + 8 <= head.length) {
    let size = head.readUInt32BE(offset);
    const type = head.toString('latin1', offset + 4, offset + 8);
    if (type === 'moov') return true;
    if (type === 'mdat') return false;
    if (size === 1) size = Number(head.readBigUInt64BE(offset + 8));
    if (size < 8) return false;
    offset += size;
  }
  return false;
}

/** The decoder configuration record that follows a box tag such as `avcC`. */
function configRecord(head, tag) {
  const at = head.indexOf(tag, 0, 'latin1');
  if (at === -1) throw new Error(`no ${tag} box found`);
  return head.subarray(at + 4);
}

const hex2 = (byte) => byte.toString(16).toUpperCase().padStart(2, '0');

/**
 * The RFC 6381 `codecs` value the browser is asked about in <source type>.
 * Read from the file rather than written by hand: a string that names a
 * profile or level the stream does not have makes canPlayType lie, in either
 * direction.
 */
function codecString(key, head, info) {
  if (key === 'h264') {
    const c = configRecord(head, 'avcC');
    return `avc1.${hex2(c[1])}${hex2(c[2])}${hex2(c[3])}`;
  }
  if (key === 'h265') {
    const c = configRecord(head, 'hvcC');
    const space = ['', 'A', 'B', 'C'][c[1] >> 6];
    const tier = (c[1] >> 5) & 1 ? 'H' : 'L';
    const profile = c[1] & 0x1f;
    // The 32 compatibility flags go into the string in reverse bit order.
    let flags = c.readUInt32BE(2);
    let reversed = 0;
    for (let i = 0; i < 32; i += 1) {
      reversed = ((reversed << 1) | (flags & 1)) >>> 0;
      flags >>>= 1;
    }
    const constraints = [...c.subarray(6, 12)];
    while (constraints.length && constraints.at(-1) === 0) constraints.pop();
    return (
      `hvc1.${space}${profile}.${reversed.toString(16).toUpperCase()}.` +
      `${tier}${c[12]}${constraints.map((b) => `.${hex2(b)}`).join('')}`
    );
  }
  if (key === 'av1') {
    const c = configRecord(head, 'av1C');
    const profile = c[1] >> 5;
    const level = c[1] & 0x1f;
    const tier = c[2] >> 7 ? 'H' : 'M';
    const highBitDepth = (c[2] >> 6) & 1;
    const twelveBit = (c[2] >> 5) & 1;
    const depth = highBitDepth ? (profile === 2 && twelveBit ? 12 : 10) : 8;
    const two = (n) => String(n).padStart(2, '0');
    return `av01.${profile}.${two(level)}${tier}.${two(depth)}`;
  }
  // VP9 in WebM carries no such record; the level follows from the frame size
  // and rate (VP9 level table: max luma samples per second, max picture size).
  const levels = [
    [10, 829440, 36864],
    [11, 2764800, 73728],
    [20, 4608000, 122880],
    [21, 9216000, 245760],
    [30, 20736000, 552960],
    [31, 36864000, 983040],
    [40, 83558400, 2228224],
    [41, 160432128, 2228224],
    [50, 311951360, 8912896],
    [51, 588251136, 8912896],
  ];
  const picture = info.width * info.height;
  const level = levels.find(
    ([, rate, size]) => picture <= size && picture * info.fps <= rate
  );
  if (!level) throw new Error('frame too large for the VP9 levels listed');
  return `vp09.00.${level[0]}.08`;
}

/**
 * The audio half of the `codecs` value. Without it a browser that can decode
 * the picture of a file but not its sound says yes to the source and then
 * fails on it, instead of moving on to the next one.
 */
function audioCodecString({ codec, profile }) {
  if (codec === 'opus') return 'opus';
  const objectType = { LC: 2, 'HE-AAC': 5, 'HE-AACv2': 29 }[profile];
  if (codec !== 'aac' || !objectType) {
    throw new Error(`no codecs value known for ${codec} ${profile ?? ''}`);
  }
  return `mp4a.40.${objectType}`;
}

/** Encodes the file that ships at the given rate and checks everything about
 *  it that a browser or the page layout will depend on. */
async function shipped(clip, key, rate, ctx) {
  const fmt = FORMATS[key];
  const { ext } = CONTAINER[fmt.container];
  const at = rate.bitrate ? `abr${rate.bitrate}` : `crf${rate.crf}`;
  const label = `${clip.name}.${key}.final.${at}`;
  const out = path.join(ctx.work, `${label}${ext}`);
  const cache = `${out}.json`;
  // The cache marks a finished encode and keeps its scores — the two expensive
  // parts. Everything else is read back from the file on every run, so a
  // change to what is reported never costs a re-encode.
  const cached =
    (await isFresh(cache, clip.masterPath)) &&
    (await isFresh(out, clip.masterPath));
  if (!cached) await encode({ clip, fmt, rate, final: true, out, ctx });
  const { vmaf, banding } = cached
    ? JSON.parse(await readFile(cache, 'utf8'))
    : await measure({
        file: out,
        master: clip.masterPath,
        subsample: 1,
        label,
        work: ctx.work,
      });
  if (!cached) await writeFile(cache, JSON.stringify({ vmaf, banding }));

  const info = await probe(out);
  const head = await readHead(out);
  const colour = await topColour(out);
  const codecs = {
    video: codecString(key, head, info),
    audio: info.audio ? audioCodecString(info.audio) : null,
  };
  const listed = [codecs.video, codecs.audio].filter(Boolean).join(', ');
  return {
    file: `${clip.name}${fmt.suffix}`,
    bytes: (await stat(out)).size,
    ...rate,
    vmaf,
    banding,
    type: `video/${fmt.container}; codecs="${listed}"`,
    codecs,
    frames: info.frames,
    hasAudio: info.hasAudio,
    faststart: fmt.container === 'mp4' ? moovFirst(head) : null,
    topColour: hex(colour),
    colourDrift: Math.max(
      ...colour.map((c, i) => Math.abs(c - clip.topColour[i]))
    ),
    path: out,
  };
}

async function produce(clip, key, ctx) {
  const fmt = FORMATS[key];
  const short = (r) => shortfall(r, clip, fmt, ctx.floor);
  const slow = async (rate) => {
    const r = await shipped(clip, key, rate, ctx);
    const at = rate.bitrate
      ? `${Math.round(rate.bitrate / 1000)} kbit/s`
      : `crf ${rate.crf}`;
    ctx.log(
      clip,
      key,
      `slow preset, ${at}: ${describe(r, clip)}, ${mb(r.bytes)} MB`
    );
    return r;
  };

  let crf = await pickCrf(clip, key, ctx);
  let result = await slow({ crf });
  // The slow preset usually beats the fast one at the same CRF, but not always;
  // when it lands under a floor, step back until it does not.
  while (short(result) && crf > fmt.crf.min) {
    crf -= 1;
    result = await slow({ crf });
  }
  // More often it clears with room to spare. Take that room back: keep raising
  // the CRF for as long as the slow encode itself still clears.
  while (!short(result) && crf < fmt.crf.max) {
    const next = await slow({ crf: crf + 1 });
    if (short(next)) break;
    crf += 1;
    result = next;
  }

  if (fmt.maxBytes && result.bytes > fmt.maxBytes) {
    ctx.log(
      clip,
      key,
      `${mb(result.bytes)} MB at crf ${crf} is over the cap, fitting`
    );
    // 1.5% is set aside for the container; shrink further if that was not enough.
    let budget = fmt.maxBytes * 0.985;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const audio = clip.hasAudio ? AAC_BITRATE : 0;
      const bitrate = Math.floor((budget * 8) / clip.duration - audio);
      result = await slow({ bitrate });
      if (result.bytes <= fmt.maxBytes) break;
      budget *= 0.97;
    }
  }

  const problems = [];
  if (short(result) === 'quality') problems.push('under the quality floor');
  if (short(result) === 'banding') problems.push('more banded than allowed');
  if (fmt.maxBytes && result.bytes > fmt.maxBytes)
    problems.push('over the size cap');
  if (result.frames !== clip.frames) problems.push('frame count differs');
  if (result.hasAudio !== clip.hasAudio) problems.push('audio track differs');
  if (result.faststart === false) problems.push('index is not at the front');
  if (result.colourDrift > COLOUR_TOLERANCE)
    problems.push('background colour drifted');

  const { path: built, ...entry } = result;
  await copyFile(built, path.join(ctx.out, entry.file));
  ctx.log(
    clip,
    key,
    `-> ${entry.file}: ${mb(entry.bytes)} MB, ${describe(entry, clip)}` +
      (problems.length ? ` - PROBLEM: ${problems.join(', ')}` : '')
  );
  return { ...entry, problems };
}

/** Runs `worker` over `items`, `limit` at a time. Encoders are multithreaded
 *  already; a few jobs side by side just fill the cores they leave idle. */
async function pool(items, limit, worker) {
  const queue = [...items.entries()];
  const results = new Array(items.length);
  const lane = async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      results[next[0]] = await worker(next[1]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, lane)
  );
  return results;
}

/** Everything the run needs to know about a master, banding included. */
async function describeMaster(c, args) {
  const masterPath = path.join(args.src, c.master);
  const cache = path.join(args.work, `${c.name}.master.json`);
  if (await isFresh(cache, masterPath)) {
    return { ...c, masterPath, ...JSON.parse(await readFile(cache, 'utf8')) };
  }
  const info = {
    ...(await probe(masterPath)),
    topColour: await topColour(masterPath),
    banding: (
      await measure({
        file: masterPath,
        master: masterPath,
        subsample: SEARCH_SUBSAMPLE,
        label: `${c.name}.master`,
        work: args.work,
      })
    ).banding,
  };
  await writeFile(cache, JSON.stringify(info));
  return { ...c, masterPath, ...info };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await Promise.all(
    [args.out, args.work, path.dirname(args.report)].map((dir) =>
      mkdir(dir, { recursive: true })
    )
  );

  // AudioToolbox's AAC is cleaner than ffmpeg's own at 96k; fall back where
  // it does not exist (anything that is not a Mac).
  const encoders = (
    await run('ffmpeg', ['-hide_banner', '-encoders'])
  ).toString();
  const aac = /\baac_at\b/.test(encoders) ? 'aac_at' : 'aac';
  const sound = ['-ar', '48000', '-ac', '2'];
  const ctx = {
    ...args,
    audio: {
      aac: ['-c:a', aac, '-b:a', String(AAC_BITRATE), ...sound],
      opus: ['-c:a', 'libopus', '-b:a', String(OPUS_BITRATE), ...sound],
    },
    log: (clip, key, text) => console.log(`[${clip.name} ${key}] ${text}`),
  };

  const wanted = CLIPS.filter((c) => !args.only || args.only.includes(c.name));
  const clips = await pool(wanted, args.jobs, (c) => describeMaster(c, args));

  const tasks = clips.flatMap((clip) =>
    args.formats.map((key) => ({ clip, key }))
  );
  const done = await pool(tasks, args.jobs, ({ clip, key }) =>
    produce(clip, key, ctx)
  );

  const report = {
    generatedAt: new Date().toISOString(),
    floor: {
      vmafMean: args.floor.mean,
      vmafWorst1Percent: args.floor.p1,
      bandingRoom: args.floor.bandingRoom,
      bandingNotHeld: Object.keys(FORMATS).filter(
        (key) => FORMATS[key].ignoreBanding
      ),
    },
    clips: clips.map((clip) => ({
      name: clip.name,
      master: clip.master,
      width: clip.width,
      height: clip.height,
      fps: clip.fps,
      frames: clip.frames,
      duration: clip.duration,
      topColour: hex(clip.topColour),
      banding: clip.banding,
      files: Object.fromEntries(
        tasks
          .map((task, i) => ({ ...task, result: done[i] }))
          .filter((task) => task.clip === clip)
          .map((task) => [task.key, task.result])
      ),
    })),
  };
  await writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`);

  console.log('\nsize, VMAF, banding (master in the first column)');
  console.log(`| clip | ${args.formats.join(' | ')} |`);
  console.log(`|---|${args.formats.map(() => '---').join('|')}|`);
  for (const clip of report.clips) {
    const cells = args.formats.map((key) => {
      const f = clip.files[key];
      const flag = f.problems.length ? ' (!)' : '';
      return `${mb(f.bytes)} MB, ${f.vmaf.mean}, ${f.banding}${flag}`;
    });
    console.log(
      `| ${clip.name}, ${clip.duration.toFixed(1)} s, banding ${clip.banding} ` +
        `| ${cells.join(' | ')} |`
    );
  }
  console.log(`\nreport: ${args.report}`);

  const failed = done.filter((r) => r.problems.length);
  if (failed.length) {
    throw new Error(
      `${failed.length} file(s) need attention:\n` +
        failed.map((r) => `  ${r.file}: ${r.problems.join(', ')}`).join('\n')
    );
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
