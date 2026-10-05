/** Explicit build-origin routing keeps restored inventory reads offline. */
export function assetOrigin(value = 'https://assets.invalid'): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password) throw new Error('Expected an HTTP asset origin without a path');
  return url.origin;
}
export function fetchRoute(address: string, publishedOrigin: string, previewOrigin: string): 'asset' | 'site' {
  const origin = new URL(address).origin;
  if (origin === publishedOrigin) return 'asset';
  if (['https://answers.invalid', 'https://www.answers.invalid', previewOrigin].includes(origin)) return 'site';
  throw new Error(`Network forbidden: ${origin}`);
}
