import type { PreparedArrivalBillboard } from '@cssearth/objects';

/** Radius of the physical body inside its prepared image, excluding rings and transparent margins. */
export function billboardBodyRadiusPixels(asset: Pick<PreparedArrivalBillboard, 'focalPixels' | 'distanceM'>, radiusM: number): number {
  return asset.focalPixels * radiusM / Math.sqrt(asset.distanceM ** 2 - radiusM ** 2);
}

/** The prepared image's half-width as a multiple of the body's radius: how far rings and margins reach past the disc. */
export function billboardImageScale(asset: Pick<PreparedArrivalBillboard, 'size' | 'focalPixels' | 'distanceM'>, radiusM: number): number {
  return asset.size / (2 * billboardBodyRadiusPixels(asset, radiusM));
}

/** World views and arrivals consume the same prepared photograph. No separate marker image bank. */
export function preparedBodyBillboards(bodies: readonly { id: string; radiusM: number; billboard?: Readonly<Pick<PreparedArrivalBillboard, 'url' | 'size' | 'focalPixels' | 'distanceM'>> }[],
  excluded: ReadonlySet<string>, minimumDiameter: (id: string) => number) {
  return Object.fromEntries(bodies.flatMap(body => {
    const asset = body.billboard;
    if (excluded.has(body.id) || !asset) return [];
    return [[body.id, { url: asset.url, index: 0, count: 1, size: asset.size,
      imageScale: billboardImageScale(asset, body.radiusM),
      minimumDiameterPixels: minimumDiameter(body.id) }]];
  }));
}
