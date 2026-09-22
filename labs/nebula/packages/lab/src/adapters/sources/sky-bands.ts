/** Explicit host boundary; calibrated survey band composition remains with its canonical owner. */
export { composeSkyBandPng, verifySkyBandRecipe } from '../../../../../../../tools/objects/observation/sky-band-composite.mts';
/** A composed raster's lab cache name carries its own hash, so a retired publisher file cached under the
 * source's earlier name is left alone instead of being mistaken for, or overwritten by, the composite. */
export function skyBandCompositeFile(sourceId: string, compositeSha256: string) {
  if (!/^[a-z0-9-]+$/u.test(sourceId) || !/^[0-9a-f]{64}$/u.test(compositeSha256)) throw new TypeError('Invalid sky band composite identity.');
  return `${sourceId}.${compositeSha256}.png`;
}
export { gridWcs as skyBandGridWcs } from '../../../../../../../tools/objects/observation/wise-atlas-mosaic.mts';
