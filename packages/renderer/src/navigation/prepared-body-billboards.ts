import { parseObjectDiscovery, type PreparedArrivalBillboard } from '@cssearth/objects';

/** Radius of the physical body inside its prepared image, excluding rings and transparent margins. */
export function billboardBodyRadiusPixels(asset: PreparedArrivalBillboard, radiusM: number): number {
  return asset.focalPixels * radiusM / Math.sqrt(asset.distanceM ** 2 - radiusM ** 2);
}

/** World views and arrivals consume the same prepared photograph. No separate marker image bank. */
export function preparedBodyBillboards(bodies: readonly { id: string; radiusM: number; discovery?: Readonly<Record<string, unknown>> }[],
  excluded: ReadonlySet<string>, minimumDiameter: (id: string) => number) {
  return Object.fromEntries(bodies.flatMap(body => {
    if (excluded.has(body.id) || !body.discovery) return [];
    const asset = parseObjectDiscovery(body.discovery).arrival?.billboard;
    if (!asset) return [];
    return [[body.id, { url: asset.url, index: 0, count: 1, size: asset.size,
      imageScale: asset.size / (2 * billboardBodyRadiusPixels(asset, body.radiusM)),
      minimumDiameterPixels: minimumDiameter(body.id) }]];
  }));
}
