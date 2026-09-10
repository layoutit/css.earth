/** Overview routes share the mounted world and its camera. */
export function overviewScopeFromUrl(url: string | URL) {
  const scope = new URL(url).searchParams.get('overview');
  return scope === 'solar-system' || scope === 'milky-way' ? scope : null;
}
