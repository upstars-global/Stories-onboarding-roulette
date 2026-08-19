/**
 * Warms the browser cache with the next story clip.
 *
 * Slides are mounted one at a time (`v-if` in Stories.vue), so without this the
 * download for the next clip only starts once the user taps — the story then
 * sits on a frozen progress bar until enough data arrives. Fetching ahead while
 * the current clip plays moves that wait off the transition.
 *
 * Uses `fetch` rather than `<link rel="prefetch">` (unsupported in Safari) or a
 * hidden `<video preload="auto">` (iOS throttles preload without a user
 * gesture); a plain fetch gets no special media heuristics in any engine.
 *
 * Purely additive: if the response is not reusable from cache, the video
 * element simply requests it as before.
 */

/** Bytes per clip — ~9s of playback at the clips' ~2.1 Mbit/s, and all of story 1. */
const PREFETCH_BYTES = 2_500_000;

const requested = new Set<string>();

export function useVideoPrefetch() {
  function prefetch(url?: string): void {
    if (!url || requested.has(url)) return;
    requested.add(url);

    window
      .fetch(url, { headers: { Range: `bytes=0-${PREFETCH_BYTES - 1}` } })
      // Drain the body so the response is stored rather than left pending.
      .then((response) => response.arrayBuffer())
      .catch(() => {
        // Let a later slide change retry (offline, aborted range request, ...).
        requested.delete(url);
      });
  }

  return { prefetch };
}
