// The sample index of an MP4 (moov): which bytes of the file hold which frame.
//
// It is grouped into chunks, and Safari reads a clip a chunk at a time: it
// shows nothing of a chunk until all of it has arrived. In a clip with sound
// the frames alternate with sound, so every frame is a chunk of its own and
// playback starts after a few seconds of data. Without sound ffmpeg merges
// the frames into chunks of up to 1 MiB (build_chunks in libavformat/movenc.c,
// no option changes it), and Safari then waits for 9-14 s of video, or for a
// short clip's whole file, before the first frame: measured on an iPhone and
// in Safari on a Mac, 1.5-5.7 s per slide change against 0.1-1.2 s.
//
// oneFramePerChunk() rewrites the index so every frame is its own chunk
// again. The frames themselves are not touched, and the clip is not encoded
// again.

/** Boxes between `start` and `end` of `buf`, as { type, start, head, end }. */
function boxes(buf, start, end) {
  const out = [];
  for (let o = start; o + 8 <= end; ) {
    let size = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    let head = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(o + 8));
      head = 16;
    } else if (size === 0) {
      size = end - o;
    }
    if (size < head) throw new Error(`broken MP4 box ${type} at ${o}`);
    out.push({ type, start: o, head, end: o + size });
    o += size;
  }
  return out;
}

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);

/** The moov box as a tree: containers keep their children, everything else
 *  its raw bytes. */
function tree(buf, box) {
  if (!CONTAINERS.has(box.type)) {
    return { type: box.type, raw: buf.subarray(box.start, box.end) };
  }
  return {
    type: box.type,
    kids: boxes(buf, box.start + box.head, box.end).map((b) => tree(buf, b)),
  };
}

function serialize(node) {
  if (node.raw) return node.raw;
  const body = Buffer.concat(node.kids.map(serialize));
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length, 0);
  head.write(node.type, 4, 'latin1');
  return Buffer.concat([head, body]);
}

const child = (node, type) => node.kids.find((k) => k.type === type);

/** The sample tables of every track of a parsed moov. */
function tables(moov) {
  return moov.kids
    .filter((k) => k.type === 'trak')
    .map((trak) => {
      const stbl = child(child(child(trak, 'mdia'), 'minf'), 'stbl');
      return {
        stbl,
        stsz: child(stbl, 'stsz'),
        stsc: child(stbl, 'stsc'),
        stco: child(stbl, 'stco') ?? child(stbl, 'co64'),
      };
    });
}

/** Chunk runs of an stsc box: [{ first, perChunk, description }]. */
function chunkRuns(stsc) {
  const r = stsc.raw;
  return Array.from({ length: r.readUInt32BE(12) }, (_, i) => ({
    first: r.readUInt32BE(16 + 12 * i),
    perChunk: r.readUInt32BE(20 + 12 * i),
    description: r.readUInt32BE(24 + 12 * i),
  }));
}

function parseMoov(buf) {
  const top = boxes(buf, 0, buf.length);
  const moov = top.find((b) => b.type === 'moov');
  const mdat = top.find((b) => b.type === 'mdat');
  if (!moov) throw new Error('no moov box');
  return { top, moovBox: moov, mdat, moov: tree(buf, moov) };
}

/** The most frames any one chunk of the file holds. */
export function largestChunk(buf) {
  const { moov } = parseMoov(buf);
  return Math.max(
    ...tables(moov).flatMap((t) => chunkRuns(t.stsc).map((r) => r.perChunk))
  );
}

/** Where each sample of a track starts in the file, from its current tables. */
function sampleOffsets({ stsz, stsc, stco }) {
  const z = stsz.raw;
  const o = stco.raw;
  const fixed = z.readUInt32BE(12);
  const count = z.readUInt32BE(16);
  const size = (i) => fixed || z.readUInt32BE(20 + 4 * i);
  const chunks = o.readUInt32BE(12);
  const chunkAt = (i) =>
    stco.type === 'stco'
      ? o.readUInt32BE(16 + 4 * i)
      : Number(o.readBigUInt64BE(16 + 8 * i));
  const runs = chunkRuns(stsc);
  const offsets = [];
  let sample = 0;
  for (let c = 1; c <= chunks; c += 1) {
    const run = runs.filter((r) => r.first <= c).at(-1);
    let at = chunkAt(c - 1);
    for (let k = 0; k < run.perChunk; k += 1) {
      offsets.push(at);
      at += size(sample);
      sample += 1;
    }
  }
  if (offsets.length !== count) {
    throw new Error(`index lists ${offsets.length} samples, stsz ${count}`);
  }
  return offsets;
}

function fullBox(type, payload) {
  const b = Buffer.alloc(12 + payload.length);
  b.writeUInt32BE(b.length, 0);
  b.write(type, 4, 'latin1');
  payload.copy(b, 12);
  return b;
}

/**
 * The same MP4 with every frame a chunk of its own. Returns `buf` itself when
 * that is already so. Needs the index before the data (ffmpeg's faststart),
 * which is what lets the clip play while it downloads in the first place.
 */
export function oneFramePerChunk(buf) {
  const { moovBox, mdat, moov } = parseMoov(buf);
  if (!mdat || moovBox.start > mdat.start) {
    throw new Error('the index (moov) has to come before the data (mdat)');
  }
  const tracks = tables(moov);
  if (tracks.every((t) => chunkRuns(t.stsc).every((r) => r.perChunk === 1))) {
    return buf;
  }
  const plans = tracks.map((t) => {
    const descriptions = new Set(chunkRuns(t.stsc).map((r) => r.description));
    if (descriptions.size > 1) {
      throw new Error('a track with several sample descriptions');
    }
    return {
      ...t,
      offsets: sampleOffsets(t),
      description: [...descriptions][0],
    };
  });
  // The new tables make the index bigger, which moves the data after it.
  const write = (shift) => {
    for (const p of plans) {
      const stsc = Buffer.alloc(16);
      stsc.writeUInt32BE(1, 0);
      stsc.writeUInt32BE(1, 4);
      stsc.writeUInt32BE(1, 8);
      stsc.writeUInt32BE(p.description, 12);
      const stco = Buffer.alloc(4 + 4 * p.offsets.length);
      stco.writeUInt32BE(p.offsets.length, 0);
      p.offsets.forEach((at, i) => stco.writeUInt32BE(at + shift, 4 + 4 * i));
      p.stbl.kids = p.stbl.kids.map((k) => {
        if (k.type === 'stsc')
          return { type: 'stsc', raw: fullBox('stsc', stsc) };
        if (k.type === 'stco' || k.type === 'co64') {
          return { type: 'stco', raw: fullBox('stco', stco) };
        }
        return k;
      });
    }
    return serialize(moov);
  };
  const shift = write(0).length - (moovBox.end - moovBox.start);
  const last = Math.max(...plans.flatMap((p) => p.offsets)) + shift;
  if (last > 0xffffffff) throw new Error('clip too large for 32-bit offsets');
  return Buffer.concat([
    buf.subarray(0, moovBox.start),
    write(shift),
    buf.subarray(moovBox.end),
  ]);
}
