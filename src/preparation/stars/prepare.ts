import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import { M_PER_PC } from '@cssearth/astronomy';
import { parseStarsRecipe } from './config.js';
import { requireRecord as record, requireNonemptyText as text } from '@cssearth/core';
import { palette } from './color.js';
import { loadStarSource } from './source.js';
import { prepareStarHierarchy } from './hierarchy.js';
import { preparePointAtlas, preparePointPhotometry } from '../../renderers/css/preparation/stars/material.js';
import { containedPath, sourceBytes } from '@cssearth/bake/volume/node';
import { sha256 } from '@cssearth/core/node';
import type { PreparedCssPointFieldManifest } from './types.js';
import { prepareDiffuseSky } from '../../renderers/css/preparation/stars/diffuse-sky.js';
import { encodePointFieldBank } from '../../renderers/css/preparation/stars/point-field-bank.js';
import { inventoryPreparedAssets } from '../../platform/runtime-asset-closure.mts';
import sharp from 'sharp';
import { encodeLossyWebp } from '../raster/lossy-lane.ts';

export async function prepareStarsObject(options: { objectDirectory: string; outputDirectory?: string }) {
  const objectDirectory = resolve(options.objectDirectory), outputDirectory = resolve(options.outputDirectory ?? resolve(objectDirectory,'prepared'));
  const descriptorPath = resolve(objectDirectory,'object.json'), descriptor = record(JSON.parse(await readFile(descriptorPath,'utf8')) as unknown,'Point-field descriptor');
  if (descriptor.schema !== 'cssearth-object@1' || descriptor.type !== 'point-field') throw new TypeError('Unsupported point-field descriptor.');
  const id = text(descriptor.id,'Point-field id'), properties = record(descriptor.properties,'Point-field properties'), preparation = record(properties.preparation,'Point-field preparation');
  const sourcePath = text(preparation.source,'Point-field source');
  const recipe = parseStarsRecipe(JSON.parse((await readFile(containedPath(objectDirectory,sourcePath))).toString('utf8')) as unknown);
  const frame = parseDensityVolumeFrame(properties.frame);
  if (frame.referenceFrame !== 'sun-icrf' || frame.metersPerUnit !== M_PER_PC || frame.originM.some(v=>v!==0) || frame.localToReferenceXyzw.some((v,i)=>v!==(i===3?1:0))) throw new TypeError('HYG Cartesian columns require the Sun-origin ICRS parsec frame.');
  const sourceDirectory=dirname(containedPath(objectDirectory,sourcePath));
  const colors = palette(recipe.colors), source = await loadStarSource(sourceDirectory,recipe,colors,frame.epochJdTt);
  const hierarchy = prepareStarHierarchy(source.stars,colors,recipe.tree.leafSize,recipe.tree.maximumDepth);
  if (JSON.stringify(hierarchy.boundsUnits)!==JSON.stringify(frame.boundsUnits)) throw new TypeError('Authored point-field frame bounds disagree with the prepared hierarchy.');
  await mkdir(outputDirectory,{recursive:true});
  // The point sprites go through the lossy lane with exact alpha: the PNG was 14,017 bytes, the WebP 734, and pixelmatch
  // (threshold 0.1) flags none of its 32,768 pixels (2026-09-25).
  const atlasPath = 'point-atlas.webp', atlas = await encodeLossyWebp(sharp(await preparePointAtlas(colors,recipe.atlas)), { alphaQuality: 100, effort: 6 });
  await writeFile(resolve(outputDirectory,atlasPath),atlas);
  const diffuse=await prepareDiffuseSky(sourceDirectory,outputDirectory,recipe.diffuseSky);
  const photometry=preparePointPhotometry(recipe.photometry);
  // Rows travel as a pinned binary column bank; the encoder decodes it again and asserts every bound.
  const encoded = encodePointFieldBank({path:'stars.bin',idPrefix:recipe.catalogue.idPrefix,frame,colorCount:colors.length,
    stars:hierarchy.stars,nodes:hierarchy.nodes,photometry,atlas:recipe.atlas});
  await writeFile(resolve(outputDirectory,encoded.bank.path),encoded.bytes);
  const directPoints = prepareDirectPoints(hierarchy.stars, recipe.policy.activeSlots, recipe.catalogue.count);
  const data: PreparedCssPointFieldManifest = { schema:'cssearth-css-point-field-bank@1',id,frame,bank:encoded.bank,
    atlas:{path:atlasPath,columns:colors.length,tileSize:recipe.atlas.tileSize,colors,haloRadii:recipe.atlas.haloRadii},
    photometry,policy:recipe.policy,labels:recipe.labels,directPoints,
    ...(recipe.diffuseSky ? {diffuseSky:diffuse.diffuseSky} : {}),
    resources:[{path:atlasPath,sha256:sha256(atlas),bytes:atlas.length,width:colors.length*recipe.atlas.tileSize,height:recipe.atlas.tileSize},...diffuse.resources], };
  // The baked provenance is published beside the manifest, not inside it: the page never reads it.
  const provenance = {source:source.provenance,catalogueMetadata:source.catalogueMetadata,reconciliation:source.reconciliation,qualification:'All catalogue rows retained; explicitly cross-identified detailed stars use body astrometry at the navigation epoch, with HYG apparent brightness preserved. Remaining rows retain HYG J2000.0 positions. Internal nodes approximate unresolved luminosity and position; no fixed pixel-error guarantee when the point pool is saturated.'};
  const envelope = {schema:'cssearth-prepared-object@1',id,type:'point-field',format:'cssearth-css-point-field-bank@1',data};
  const bytes = Buffer.from(JSON.stringify(envelope)+'\n'), outputPath = resolve(outputDirectory,'stars.json');
  await writeFile(outputPath,bytes);
  await writeFile(resolve(outputDirectory,'stars-provenance.json'),JSON.stringify({schema:'cssearth-point-field-provenance@1',id,provenance})+'\n');
  if (outputDirectory===resolve(objectDirectory,'prepared')) {
    await writeFile(descriptorPath,JSON.stringify({...descriptor,prepared:{format:envelope.format,url:relative(objectDirectory,outputPath).split('\\').join('/')}},null,2)+'\n');
    await inventoryPreparedAssets({ objectId: id, objectDirectory, preparedRoot: outputDirectory });
  }
  const magnitude = encoded.bank.quantization.find(entry => entry.field === 'star.absoluteMagnitude')!;
  console.log(`PREPARED ${id}: ${encoded.bank.starCount} catalogue rows; ${encoded.bank.nodeCount} hierarchy nodes; ${bytes.length} manifest bytes; ${encoded.bytes.length} bank bytes; ${atlas.length} atlas bytes; magnitude error ${magnitude.measured} <= ${magnitude.bound} mag (pixel alpha <= ${magnitude.displayAlphaChange})`);
  return envelope;
}

function prepareDirectPoints(stars: readonly import('./types.js').PreparedStar[], limit: number, catalogueCount: number) {
  const sourceRow = (id: string) => {
    const value = Number(id.slice(id.lastIndexOf(':') + 1));
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`Star ${id} has no source row.`);
    return value;
  };
  const ranked = stars.map(star => ({ star, sourceRow: sourceRow(star.id),
    apparentMagnitude: star.absoluteMagnitude + 5 * Math.log10(Math.hypot(...star.positionUnits)) - 5 }));
  ranked.sort((left, right) => Number(right.star.coverageAnchor) - Number(left.star.coverageAnchor) ||
    left.apparentMagnitude - right.apparentMagnitude || left.sourceRow - right.sourceRow);
  const selected = ranked.slice(0, limit).sort((left, right) => left.sourceRow - right.sourceRow);
  return Object.freeze({ schema:'cssearth-direct-star-field@1' as const, catalogueCount,
    selection:`All ${stars.filter(star => star.coverageAnchor).length} prepared all-sky coverage anchors, then the brightest apparent HYG rows at the Sun, bounded by the ${limit}-slot authored display budget.`,
    points:Object.freeze(selected.map(({ star, sourceRow: row }) => Object.freeze({ sourceRow:row, positionUnits:star.positionUnits.map(float32Text) as unknown as typeof star.positionUnits,
      absoluteMagnitude:float32Text(star.absoluteMagnitude),colorIndex:star.colorIndex,coverageAnchor:star.coverageAnchor }))) });
}
/** A float32 value with the fewest significant digits that read back to the same float32: its JSON text then carries the
 * value's own precision, not seventeen digits of the double it widens to (0.663, not 0.6629999876022339). */
export function float32Text(value: number): number {
  const exact = Math.fround(value);
  for (let digits = 1; digits <= 9; digits++) { const short = Number(exact.toPrecision(digits)); if (Math.fround(short) === exact) return short; }
  return exact;
}
