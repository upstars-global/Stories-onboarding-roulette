// How alike two stretches of music are, and where one of them lies in the
// other: what scripts/build-story-soundtrack.mjs needs to join clips cut out
// of one piece of music. Everything here works on mono float samples.

export const RATE = 48_000;

/** Analysis frames: one every 10 ms, 2048 samples long, the spectrum folded
 *  into 24 bands spaced evenly in pitch from 60 Hz to 16 kHz. Coarse on
 *  purpose: it finds the same bars of music, not the same samples. */
export const HOP = 480;
export const BANDS = 24;
export const FPS = RATE / HOP;
const SIZE = 2048;

/** Samples covered by `frames` consecutive analysis frames. */
export const spanOf = (frames) => (frames - 1) * HOP + SIZE;

/** Waveform comparisons run over 0.4 s. */
export const WAVE = Math.round(0.4 * RATE);

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const h = i + k + len / 2;
        const ar = re[h] * cr - im[h] * ci;
        const ai = re[h] * ci + im[h] * cr;
        re[h] = re[i + k] - ar;
        im[h] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

const EDGES = Array.from({ length: BANDS + 1 }, (_, i) =>
  Math.round((60 * (16000 / 60) ** (i / BANDS) * SIZE) / RATE)
);
const HANN = Float64Array.from(
  { length: SIZE },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / SIZE)
);

/** Band levels of `count` frames of `m`, the first starting at sample `from`. */
export function spectrum(
  m,
  from = 0,
  count = Math.floor((m.length - from - SIZE) / HOP) + 1
) {
  const out = new Float32Array(Math.max(0, count) * BANDS);
  const re = new Float64Array(SIZE);
  const im = new Float64Array(SIZE);
  for (let f = 0; f < count; f += 1) {
    for (let i = 0; i < SIZE; i += 1) {
      re[i] = (m[from + f * HOP + i] ?? 0) * HANN[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < BANDS; b += 1) {
      let e = 0;
      const top = Math.max(EDGES[b + 1], EDGES[b] + 1);
      for (let k = EDGES[b]; k < top; k += 1) {
        e += re[k] * re[k] + im[k] * im[k];
      }
      out[f * BANDS + b] = Math.log10(e + 1e-9);
    }
  }
  return out;
}

/** Correlation of `frames` spectrum frames: `a` from frame `a0`, `b` from `b0`. */
export function spectrumMatch(a, a0, b, b0, frames) {
  const n = frames * BANDS;
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  for (let i = a0 * BANDS, j = b0 * BANDS, end = i + n; i < end; i++, j++) {
    sa += a[i];
    sb += b[j];
    saa += a[i] * a[i];
    sbb += b[j] * b[j];
    sab += a[i] * b[j];
  }
  const cov = sab / n - (sa / n) * (sb / n);
  const va = saa / n - (sa / n) ** 2;
  const vb = sbb / n - (sb / n) ** 2;
  return cov / Math.sqrt(Math.max(va * vb, 1e-24));
}

/**
 * Where `x[from, from + WAVE)` lies in `y` within `reach` samples of `near`,
 * to the sample, and how alike the two waveforms are there (1: the same
 * samples). Every second offset is tried on every second sample first, then
 * each offset next to the best on all of them.
 */
export function align(x, from, y, near, reach) {
  const score = (at, stride) => {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (let i = 0; i < WAVE; i += stride) {
      const u = x[from + i];
      const v = y[at + i];
      xy += u * v;
      xx += u * u;
      yy += v * v;
    }
    return xy / Math.sqrt(xx * yy + 1e-20);
  };
  const lo = Math.max(near - reach, 0);
  const hi = Math.min(near + reach, y.length - WAVE);
  if (hi < lo) return { at: near, wave: -1 };
  let rough = lo;
  let roughScore = -2;
  for (let at = lo; at <= hi; at += 2) {
    const s = score(at, 2);
    if (s > roughScore) {
      roughScore = s;
      rough = at;
    }
  }
  let best = { at: rough, wave: -2 };
  for (
    let at = Math.max(lo, rough - 2);
    at <= Math.min(hi, rough + 2);
    at += 1
  ) {
    const s = score(at, 1);
    if (s > best.wave) best = { at, wave: s };
  }
  return best;
}

/**
 * The period the music repeats in, in samples: the lag between 4 and 16 s at
 * which the spectrum of `m` best matches itself, then refined on the waveform
 * where the music repeats sample for sample, which may be only every second
 * or fourth period. Null when nothing repeats.
 */
export function repeatPeriod(m) {
  const spec = spectrum(m);
  const frames = spec.length / BANDS;
  let best = { lag: 0, score: -1 };
  for (let lag = 4 * FPS; lag <= 16 * FPS; lag += 1) {
    let sum = 0;
    let n = 0;
    for (let t = lag; t + FPS <= frames; t += 50) {
      sum += spectrumMatch(spec, t, spec, t - lag, FPS);
      n += 1;
    }
    if (n && sum / n > best.score) best = { lag, score: sum / n };
  }
  if (best.score < 0.6) return null;

  const rough = best.lag * HOP;
  const estimates = [];
  for (let k = 1; k <= 4; k += 1) {
    // The rough period is good to half a frame; k periods on, to k halves.
    const reach = Math.round(((k + 1) * HOP) / 2);
    for (let t = 0; t + k * rough + WAVE + reach < m.length; t += 4 * RATE) {
      const { at, wave } = align(m, t, m, Math.round(t + k * rough), reach);
      if (wave >= 0.9) estimates.push((at - t) / k);
    }
  }
  if (estimates.length < 3) return rough;
  estimates.sort((p, q) => p - q);
  return estimates[estimates.length >> 1];
}
