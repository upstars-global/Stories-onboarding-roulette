/**
 * Resolves asset paths from stories.json into final URLs emitted by Vite.
 * Works with any files under /src/assets/** (images, videos, etc.).
 *
 * import.meta.glob(..., { as: 'url', eager: true }) — during build,
 * Vite transforms each match into a public URL, respecting the configured base.
 */

const imageLike = import.meta.glob('/src/assets/images/**', {
  as: 'url',
  eager: true,
}) as Record<string, string>;

const videoLike = import.meta.glob('/src/assets/videos/**', {
  as: 'url',
  eager: true,
}) as Record<string, string>;

// if needed, add other folders (audio, fonts, etc.) the same way

function normalizeToSrcPath(input: string): string {
  // Allow writing in JSON in different formats:
  // "/src/assets/..."  OR  "/assets/..."  OR  "assets/..."
  if (input.startsWith('/src/')) return input;
  if (input.startsWith('/assets/')) return `/src${input}`;
  if (input.startsWith('assets/')) return `/src/${input}`;
  // if it's a full absolute URL (https://cdn/...), return as is
  if (/^https?:\/\//i.test(input)) return input;
  // fallback: treat as absolute from project root -> convert to /src/...
  return `/src${input.startsWith('/') ? '' : '/'}${input}`;
}

export function resolveAssetUrl(input: string): string {
  const key = normalizeToSrcPath(input);
  // Order of maps doesn't matter — search in both
  const url = imageLike[key] ?? videoLike[key];
  // If not found — leave as is (might be external URL or public/ reference)
  return url ?? input;
}
