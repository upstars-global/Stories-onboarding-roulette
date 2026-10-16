// Joins the sound of a story's clips into one track; see the notes below.
// Used by scripts/build-story-soundtrack.mjs, which reads the clips and
// writes the track. A clip here is { video, frames, pcm (interleaved stereo),
// mono, spectrum, head, tail }: `head` and `tail` count the silent samples at
// its two ends.
//
// HOW THE CLIPS ARE JOINED
// The clips are cut from one long edit, but not end to end. On poker 7, 7 and
// 8 frames of the music fell out at the first three cuts, and every .mov ends
// in 12-21 ms of silence. Glued as they are, the beat stumbles at those cuts
// and every cut clicks. The music is a loop, though: the bars around a cut
// play again elsewhere in the clips. For each cut the script finds such a
// place (the 2 s before the cut matched on a coarse spectrum, then to the
// sample on the waveform), looks there for where the next clip's opening
// lies, and crosses the cut through that copy of the music with short
// crossfades. What fell out is put back, and the next clip starts that much
// later in the track: fractions of a second, well inside what the player
// lets the music drift from the picture.
//
// When the next clip opens with music heard nowhere else (on poker at slides
// 6 and 7, where the music moves on), the cut stays where it is: the end of
// the clip is carried over its silent tail by a copy of it, if a close
// enough one exists, and crossfaded into the next. The run prints what it did
// at every cut.

import {
  align,
  BANDS,
  FPS,
  HOP,
  RATE,
  spanOf,
  spectrum,
  spectrumMatch,
  WAVE,
} from './music-match.mjs';

/** The music matched on either side of a cut: 2 s of analysis frames. */
const SPAN = 2 * FPS;
/** How far the next clip's opening is looked for from where the music would
 *  go on, in frames. */
const REACH = Math.round(2.5 * FPS);
/** Waveform alignment once the spectrum has found the place: 12 ms either way. */
const WAVE_REACH = Math.round(0.012 * RATE);
/** Correlations above which two stretches count as the same music. */
const SAME_SPECTRUM = 0.85;
const SAME_WAVE = 0.7;
/** Enough likeness to carry the end of a clip over its silent tail. */
const NEAR_WAVE = 0.5;
/** Two places agree on the music missing at a cut within this. */
const AGREE = Math.round(0.002 * RATE);
/** Crossfade at every seam. */
const FADE = Math.round(0.03 * RATE);

/**
 * Other places where the music before the end of clip `a` plays: the four
 * best by spectrum, each with the sample in it that matches the end of `a`.
 */
function places(clips, a) {
  const end = a.frames - a.tail;
  const from = end - spanOf(SPAN);
  const before = spectrum(a.mono, from, SPAN);
  const found = [];
  for (const c of clips) {
    for (let g = 0; g + SPAN <= c.spectrum.length / BANDS; g += 1) {
      const at = g * HOP + (end - from);
      if (c === a && Math.abs(at - end) < 3 * RATE) continue;
      found.push({
        c,
        at,
        spectrum: spectrumMatch(before, 0, c.spectrum, g, SPAN),
      });
    }
  }
  found.sort((p, q) => q.spectrum - p.spectrum);
  const picked = [];
  for (const p of found) {
    if (picked.length === 4) break;
    if (picked.some((q) => q.c === p.c && Math.abs(q.at - p.at) < RATE)) {
      continue;
    }
    const { at, wave } = align(
      a.mono,
      end - WAVE,
      p.c.mono,
      p.at - WAVE,
      WAVE_REACH
    );
    picked.push({ ...p, at: at + WAVE, wave });
  }
  return picked;
}

/**
 * Where the opening of clip `b` lies in place `p`, as the samples of music
 * missing (below zero: repeated) between the end of clip `a` and the start
 * of `b`.
 */
function opening(p, a, b) {
  const after = spectrum(b.mono, b.head, SPAN);
  const nothingMissing = p.at + a.tail + b.head;
  const g0 = Math.round(nothingMissing / HOP);
  let best = null;
  for (let g = g0 - REACH; g <= g0 + REACH; g += 1) {
    if (g < 0 || g + SPAN > p.c.spectrum.length / BANDS) continue;
    const s = spectrumMatch(after, 0, p.c.spectrum, g, SPAN);
    if (!best || s > best.spectrum) best = { spectrum: s, g };
  }
  if (!best) return null;
  const { at, wave } = align(
    b.mono,
    b.head,
    p.c.mono,
    best.g * HOP,
    WAVE_REACH
  );
  return { missing: at - nothingMissing, spectrum: best.spectrum, wave };
}

/** Whether the copy that crosses a cut through place `p` lies inside the
 *  sound of its clip, clear of the silent edges. */
function fits(p, a, b, missing) {
  const gap = Math.max(a.tail + missing + b.head, 0);
  return p.at - FADE >= p.c.head && p.at + gap + FADE <= p.c.frames - p.c.tail;
}

/** How to cross the cut after clip `k`; see HOW THE CLIPS ARE JOINED. */
export function cut(clips, k) {
  const a = clips[k];
  const b = clips[k + 1];
  const alike = places(clips, a).filter(
    (p) => p.spectrum >= SAME_SPECTRUM && fits(p, a, b, 0)
  );
  const sure = alike
    .filter((p) => p.wave >= SAME_WAVE)
    .map((p) => ({ ...p, open: opening(p, a, b) }))
    .filter(
      (p) =>
        p.open &&
        p.open.spectrum >= SAME_SPECTRUM &&
        p.open.wave >= SAME_WAVE &&
        fits(p, a, b, p.open.missing)
    )
    .sort(
      (p, q) => Math.min(q.wave, q.open.wave) - Math.min(p.wave, p.open.wave)
    );
  const best = sure[0];
  const agreeing = best
    ? sure.filter((p) => Math.abs(p.open.missing - best.open.missing) <= AGREE)
    : [];
  if (best && agreeing.length >= Math.min(2, sure.length)) {
    return { place: best, missing: best.open.missing, found: true };
  }
  const near = alike
    .filter((p) => p.wave >= NEAR_WAVE)
    .sort((p, q) => q.wave - p.wave);
  return { place: near[0] ?? null, missing: 0, found: false };
}

/** The track being written: clips and the copies between them one after
 *  another, each piece crossfaded over the end of the one before. */
class Track {
  constructor(frames) {
    this.pcm = new Float32Array(frames * 2);
    this.length = 0;
  }

  /** Writes `pcm[from, to)`, its first `fade` samples over the last `fade`
   *  written; returns where `from` landed. */
  add(pcm, from, to, fade) {
    const start = this.length - fade;
    for (let i = from; i < to; i += 1) {
      const o = start + i - from;
      const t = i - from < fade ? (i - from + 0.5) / fade : 1;
      const w = t >= 1 ? 1 : Math.sin((t * Math.PI) / 2) ** 2;
      for (let ch = 0; ch < 2; ch += 1) {
        const v = pcm[2 * i + ch];
        this.pcm[2 * o + ch] =
          w === 1 ? v : this.pcm[2 * o + ch] * (1 - w) + v * w;
      }
    }
    this.length = start + (to - from);
    return start;
  }
}

/** The clips joined into one track, and the sample each one starts at in it. */
export function join(clips, cuts) {
  const track = new Track(
    clips.reduce((sum, c) => sum + c.frames, 0) + clips.length * RATE
  );
  const starts = [0];
  const first = clips[0];
  track.add(
    first.pcm,
    0,
    clips.length > 1 ? first.frames - first.tail : first.frames,
    0
  );
  cuts.forEach((c, k) => {
    const a = clips[k];
    const b = clips[k + 1];
    const end = k + 2 === clips.length ? b.frames : b.frames - b.tail;
    let entry = b.head;
    let fade = FADE;
    if (c.place) {
      // The copy runs from just before the end of `a` to just after the
      // start of `b`, so both of its ends overlap the same music. When `b`
      // repeats music that `a` already played, `b` is entered later instead.
      const gap = a.tail + c.missing + b.head;
      const { c: source, at } = c.place;
      track.add(source.pcm, at - FADE, at + Math.max(gap, 0) + FADE, FADE);
      entry = b.head + Math.max(0, -gap);
    } else {
      fade = Math.min(FADE, a.frames - a.tail);
    }
    starts.push(track.add(b.pcm, entry, end, fade) - entry);
  });
  return { pcm: track.pcm.subarray(0, track.length * 2), starts };
}

/** One line of the run's log, and of soundtrack.json, about a cut. */
export function describe(c, k, clips) {
  const p = c.place;
  const where = p
    ? `${p.c.video} at ${(p.at / RATE).toFixed(3)} s (spectrum ${p.spectrum.toFixed(2)}, waveform ${p.wave.toFixed(2)}` +
      (c.found ? ` / ${p.open.wave.toFixed(2)})` : ')')
    : null;
  const joined = !c.found
    ? `next clip opens with new music; crossfaded${where ? ` after a copy of the end in ${where}` : ''}`
    : Math.abs(c.missing) <= AGREE
      ? `music goes on; crossed through ${where}`
      : c.missing > 0
        ? `missing music put back from ${where}`
        : `repeated music left out; crossed through ${where}`;
  return `${clips[k].video} -> ${clips[k + 1].video}: ${((c.missing / RATE) * 1000).toFixed(1)} ms missing; ${joined}`;
}
