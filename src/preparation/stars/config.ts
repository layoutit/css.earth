import { requireFiniteNumber as finite, requireNonemptyText as text, requirePositive as positive, requireRecord as record } from '@cssearth/core';
import type { StarsRecipe } from './types.js';
function integer(value: unknown, label: string): number { const v = positive(value, label); if (!Number.isSafeInteger(v)) throw new TypeError(`${label} must be an integer.`); return v; }
function reference(value: unknown, label: string) {
  const r = record(value, label), path = text(r.path, `${label} path`);
  if (path.startsWith('/') || path.split(/[\\/]/).includes('..')) throw new TypeError(`${label} must be a relative source.`);
  return { path };
}
export function parseStarsRecipe(value: unknown): StarsRecipe {
  const r = record(value, 'Stars recipe'); if (r.schema !== 'cssearth-stars-source@1') throw new TypeError('Unsupported stars source schema.');
  const catalogue = record(r.catalogue, 'Catalogue'), tree = record(r.tree, 'Tree'), colors = record(r.colors, 'Colors'), coverage = record(r.coverage, 'Coverage');
  const atlas = record(r.atlas, 'Atlas'), photometry = record(r.photometry, 'Photometry'), policy = record(r.policy, 'Policy'), labels = record(r.labels, 'Labels');
  const result: StarsRecipe = {
    schema: r.schema, catalogue: { ...reference(catalogue, 'Catalogue'), count: integer(catalogue.count, 'Catalogue count'), idPrefix: text(catalogue.idPrefix, 'Catalogue id prefix') },
    provenance: reference(r.provenance, 'Provenance'), license: reference(r.license, 'License'),
    tree: { leafSize: integer(tree.leafSize, 'Leaf size'), maximumDepth: integer(tree.maximumDepth, 'Maximum depth') },
    colors: { count: integer(colors.count, 'Color count'), minimumTemperatureK: positive(colors.minimumTemperatureK, 'Minimum temperature'), maximumTemperatureK: positive(colors.maximumTemperatureK, 'Maximum temperature') },
    coverage: { faceDivisions: integer(coverage.faceDivisions, 'Coverage face divisions') },
    atlas: { tileSize: integer(atlas.tileSize, 'Tile size'), haloRadii: positive(atlas.haloRadii, 'Halo radii'), coreInnerRadii: positive(atlas.coreInnerRadii, 'Core inner radius'), coreOuterRadii: positive(atlas.coreOuterRadii, 'Core outer radius'), haloPeak: positive(atlas.haloPeak, 'Halo peak'), samplesPerPixelAxis: integer(atlas.samplesPerPixelAxis, 'Pixel samples') },
    photometry: { minimumMagnitude: finite(photometry.minimumMagnitude, 'Minimum magnitude'), maximumMagnitude: finite(photometry.maximumMagnitude, 'Maximum magnitude'), step: positive(photometry.step, 'Magnitude step'), fovDegrees: positive(photometry.fovDegrees, 'FOV'), screenFactor: positive(photometry.screenFactor, 'Screen factor'), floor: positive(photometry.floor, 'Photometry floor') },
    policy: { activeSlots: integer(policy.activeSlots, 'Active slots'), transitionSlots: integer(policy.transitionSlots, 'Transition slots'), maxErrorPx: positive(policy.maxErrorPx, 'Pixel error'), transitionMs: positive(policy.transitionMs, 'Transition milliseconds') },
    labels: { activeSlots: integer(labels.activeSlots, 'Label active slots'), transitionSlots: integer(labels.transitionSlots, 'Label transition slots'), capHeightPx: positive(labels.capHeightPx, 'Label cap height'), gapPx: positive(labels.gapPx, 'Label gap'), maxAlpha: positive(labels.maxAlpha, 'Label alpha'), fadeMs: positive(labels.fadeMs, 'Label fade milliseconds') },
    ...(r.diffuseSky === undefined ? {} : {diffuseSky:parseDiffuseSky(r.diffuseSky)}),
  };
  if (result.colors.count < 2 || result.colors.maximumTemperatureK <= result.colors.minimumTemperatureK || result.colors.minimumTemperatureK < 1000 || result.colors.maximumTemperatureK > 40000 || result.coverage.faceDivisions !== 4 || result.photometry.floor > 1 || result.policy.transitionSlots < result.policy.activeSlots || result.labels.transitionSlots < result.labels.activeSlots || result.labels.maxAlpha > 1) throw new TypeError('Color, coverage, photometry, or label range is invalid.');
  if (result.atlas.coreOuterRadii <= result.atlas.coreInnerRadii || result.atlas.haloRadii < result.atlas.coreOuterRadii || result.atlas.haloPeak > 1) throw new TypeError('Atlas profile is invalid.');
  const intervals = (result.photometry.maximumMagnitude - result.photometry.minimumMagnitude) / result.photometry.step;
  if (!(intervals > 0) || Math.abs(intervals - Math.round(intervals)) > 1e-8) throw new TypeError('Magnitude table range is invalid.');
  return result;
}
function parseDiffuseSky(value: unknown): NonNullable<StarsRecipe['diffuseSky']> {
  const r=record(value,'Diffuse sky');
  if (!Array.isArray(r.faces) || r.faces.length!==6) throw new TypeError('Diffuse sky requires six cube faces.');
  const faces=r.faces.map(value=>{const face=record(value,'Diffuse sky face');return {id:text(face.id,'Sky face id'),...reference(face,'Sky face')};});
  if (new Set(faces.map(face=>face.id)).size!==6 || faces.some(face=>!['front','right','back','left','top','bottom'].includes(face.id))) throw new TypeError('Diffuse sky cube face ids are invalid.');
  return {faces,width:integer(r.width,'Diffuse sky width'),blurSigmaPixels:positive(r.blurSigmaPixels,'Diffuse sky blur sigma')};
}
