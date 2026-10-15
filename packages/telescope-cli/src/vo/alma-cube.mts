/** Bind an ALMA product to the member, science target and spectral window of one ObsCore row. */
export function matchesAlmaCube(observationId: unknown, productId: string): boolean {
  if (typeof observationId !== 'string') return false;
  const match = /^(uid:\/\/[^/]+\/[^/]+\/[^.]+)\.source\.(.+)\.spw\.(\d+)$/u.exec(observationId);
  if (!match) return false;
  const prefix = `member.${match[1]!.replace('uid://', 'uid___').replaceAll('/', '_')}.`;
  if (!productId.startsWith(prefix)) return false;
  const name = productId.slice(prefix.length);
  return [match[2], `${match[2]}_sci`].some(target => name.startsWith(`${target}.spw${match[3]}.cube.`)) && /\.pbcor\.fits$/u.test(name);
}

/** ALMA puts the fixed dataset ID in accessURL and advertises an empty inputParams group. */
export function almaCubeUrl(address: string): string | undefined {
  const url = new URL(address);
  if (url.protocol !== 'https:' || !['almascience.org', 'almascience.eso.org', 'almascience.nrao.edu', 'almascience.nao.ac.jp'].includes(url.hostname) ||
    url.pathname !== '/soda/sync' || [...url.searchParams.keys()].some(key => key !== 'ID') || url.searchParams.getAll('ID').length !== 1) return undefined;
  const id = url.searchParams.get('ID');
  return id && /^member\.uid___.*\.spw\d+\.cube\..*\.pbcor\.fits$/u.test(id) ? id : undefined;
}
