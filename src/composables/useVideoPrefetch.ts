/**
 * Downloads the next story clip, and the story's music, into memory while
 * the current clip plays, so that a slide change plays from memory instead of
 * waiting on the network.
 *
 * Slides are mounted one at a time (`v-if` in Stories.vue), so without this
 * the next clip's download only starts once the slide changes, and the story
 * sits on a frozen frame, progress bar and text until enough data arrives.
 *
 * In memory rather than in the HTTP cache: Safari's video element does not use
 * what fetch() has downloaded and fetches the clip again (measured on an
 * iPhone: every clip downloaded twice). A blob: URL plays from memory in every
 * browser. The page goes away with the story, and seven clips plus the music
 * fit easily, so nothing is released before that.
 *
 * One download at a time, in the order asked for, so the playing clip keeps
 * the bandwidth it needs; one asked for while none is under way starts at
 * once. When a download fails, the element simply loads the file itself as
 * it would have without this. A download in progress reports how far it has
 * got, so useSoundtrack can tell whether waiting for it beats streaming the
 * music from the network.
 */

interface Download {
  /** Bytes arrived so far, and of how many (0 when the server did not say). */
  received: number;
  total: number;
  /** When the download began, and when its first bytes arrived
   *  (performance.now()); 0 until then. */
  startedAt: number;
  firstByteAt: number;
  cancelled: boolean;
  abort: () => void;
  /** The in-memory copy, or undefined when the download failed. */
  done: Promise<string | undefined>;
}

/** The type a downloaded file is played by, from its extension. Safari plays
 *  a blob only by its type, and what a server says these files are varies:
 *  an .m4a can arrive as audio/mp4a-latm. */
const TYPES: Record<string, string> = {
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

function typeOf(url: string, served: string): string {
  const extension = /\.(\w+)(?:[?#]|$)/.exec(url)?.[1]?.toLowerCase();
  return (extension && TYPES[extension]) || served;
}

const inMemory = new Map<string, string>();
const downloads = new Map<string, Download>();
let queue: Promise<unknown> = Promise.resolve();
/** Downloads asked for and not yet finished. */
let pending = 0;

async function download(url: string, d: Download): Promise<string | undefined> {
  if (d.cancelled) return undefined;
  const controller = new window.AbortController();
  d.abort = () => controller.abort();
  d.startedAt = window.performance.now();
  try {
    const response = await window.fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`${response.status}`);
    d.total = Number(response.headers.get('content-length') ?? 0);
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      d.received += value.byteLength;
      d.firstByteAt ||= window.performance.now();
    }
    const type = typeOf(url, response.headers.get('content-type') ?? '');
    const local = URL.createObjectURL(new window.Blob(parts, { type }));
    inMemory.set(url, local);
    return local;
  } catch {
    // Offline, aborted, ...: a later call may try again.
    downloads.delete(url);
    return undefined;
  }
}

export function useVideoPrefetch() {
  /** Puts `url` in line for a download into memory. */
  function prefetch(url?: string): void {
    if (!url || downloads.has(url)) return;
    const d: Download = {
      received: 0,
      total: 0,
      startedAt: 0,
      firstByteAt: 0,
      cancelled: false,
      abort: () => undefined,
      done: Promise.resolve(undefined),
    };
    downloads.set(url, d);
    const run = () =>
      download(url, d).finally(() => {
        pending -= 1;
      });
    d.done = pending ? queue.then(run) : run();
    pending += 1;
    queue = d.done;
  }

  /** The in-memory copy of `url`, when it has finished downloading. */
  function local(url?: string): string | undefined {
    return url ? inMemory.get(url) : undefined;
  }

  /** How far the download of `url` has got; undefined when none is under
   *  way (not asked for, finished, failed, or still waiting its turn). */
  function progress(url: string) {
    const d = downloads.get(url);
    if (!d || !d.startedAt || inMemory.has(url)) return undefined;
    return { received: d.received, total: d.total, firstByteAt: d.firstByteAt };
  }

  /** Resolves with the in-memory copy of `url` once its download is done;
   *  with undefined when it failed or was never asked for. */
  function whenReady(url: string): Promise<string | undefined> {
    const ready = inMemory.get(url);
    if (ready) return Promise.resolve(ready);
    return downloads.get(url)?.done ?? Promise.resolve(undefined);
  }

  /** Stops the download of `url`, under way or waiting its turn. */
  function cancel(url: string): void {
    const d = downloads.get(url);
    if (!d || inMemory.has(url)) return;
    d.cancelled = true;
    d.abort();
  }

  return { prefetch, local, progress, whenReady, cancel };
}
