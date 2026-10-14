/**
 * Resolves asset paths from stories.json into final URLs emitted by Vite.
 *
 * Two places hold assets. Shared ones (icons every story uses) live under
 * /src/assets and are written as such: "/src/assets/images/icons/close.svg".
 * The story's own (its videos and icon) live in its folder, stories/<name>,
 * and are written relative to it: "icon.webp", "videos/story_1-av1.mp4".
 *
 * import.meta.glob(..., { eager: true }) — during build, Vite transforms each
 * match into a public URL, respecting the configured base.
 */

const shared = import.meta.glob('/src/assets/images/**', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Keys come back as /stories/<name>/videos/...; the story's own name is cut
// off, so the lookups below do not depend on which story is being built.
const own = Object.fromEntries(
  Object.entries(
    import.meta.glob('@story/**/*.{webp,png,jpg,jpeg,svg,mp4,webm}', {
      query: '?url',
      import: 'default',
      eager: true,
    }) as Record<string, string>
  ).map(([key, url]) => [key.replace(/^.*?\/stories\/[^/]+\//, ''), url])
);

/** URL of a file in the story's folder, or undefined when there is none. */
export function storyAssetUrl(relativePath: string): string | undefined {
  return own[relativePath];
}

export function resolveAssetUrl(input: string): string {
  // A full address (https://cdn/...) is used as is.
  if (/^https?:\/\//i.test(input)) return input;
  if (input.startsWith('/src/')) return shared[input] ?? input;
  return own[input] ?? input;
}
