import { isFiniteNumber as coreIsFiniteNumber } from '@cssearth/core';
export type CatalogueColor=(temperature:number,colorIndex:number)=>readonly [number,number,number];

import { isStellarCoordinate, parseObservedStellarCatalogue, type ObservedStar, type EmissionFieldModel, type CompilerStarInput, type CompilerStarMaterial } from '@cssearth/objects';
import { createCompilerStarDepthSampler } from './compiler.ts';

const finite = coreIsFiniteNumber;


/** Exact TAN projection in the registered image's west/north frame, in arcseconds. */
function project(raDegrees: number, decDegrees: number, center: [number, number]): [number, number] | null {
  const rad = Math.PI / 180, dec = decDegrees * rad, dec0 = center[1] * rad, deltaRa = (raDegrees - center[0]) * rad;
  const denominator = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(deltaRa);
  if (!(denominator > 0)) return null;
  return [-Math.cos(dec) * Math.sin(deltaRa) / denominator / rad * 3600,
    (Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(deltaRa)) / denominator / rad * 3600];
}

const referenceMagnitudeV = 6, referenceDiameterArcsec = 16, minimumDiameterArcsec = 2, maximumDiameterArcsec = 160;
function appearance(star: ObservedStar, catalogueColor:CatalogueColor) {
  // B−V is an observed broadband color index, interpreted through the shared display-color fit.
  const rgb: [number, number, number] = [...catalogueColor(Number.NaN, star.colorIndexBV ?? Number.NaN)];
  const encodedLuminance = (.2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]) / 255;
  const relativeVLight = 10 ** (-.4 * (star.magnitudeV - referenceMagnitudeV));
  const desiredArea = referenceDiameterArcsec ** 2 * relativeVLight / encodedLuminance;
  const diameterUnits = Math.max(minimumDiameterArcsec, Math.min(maximumDiameterArcsec, Math.sqrt(desiredArea)));
  const alpha = Math.min(1, desiredArea / diameterUnits ** 2);
  const displayedRelativeVLight = diameterUnits ** 2 * alpha * encodedLuminance / referenceDiameterArcsec ** 2;
  return { material: { rgb, diameterUnits, alpha }, relativeVLight, displayedRelativeVLight,
    clipped: desiredArea > maximumDiameterArcsec ** 2 };
}

/**
 * Optical reference lights belong to the observed sky catalogue, independently of every image dataset.
 * Conditional depths are illustrative; measured membership or stellar distances are not supplied here.
 */
export function prepareCatalogueStars(value: unknown, model: EmissionFieldModel,
  centerIcrsDegrees: [number, number], maximum: number, datasetIds: string[], catalogueColor:CatalogueColor) {
  const envelope = parseObservedStellarCatalogue(value, () => {
  if (!Array.isArray(centerIcrsDegrees) || centerIcrsDegrees.length !== 2 || !isStellarCoordinate(centerIcrsDegrees[0], centerIcrsDegrees[1]) ||
      !Number.isInteger(maximum) || maximum < 0 || maximum > 5000 || !Array.isArray(datasetIds) || datasetIds.length < 1 || datasetIds.length > 8 ||
      datasetIds.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) || new Set(datasetIds).size !== datasetIds.length)
    throw new TypeError('Invalid catalogue star frame, maximum or dataset identities.');
  if (!model.bounds || !Array.isArray(model.bounds.min) || !Array.isArray(model.bounds.max) || model.bounds.min.length !== 3 ||
      model.bounds.max.length !== 3 || model.bounds.min.some((n, axis) => !finite(n) || !finite(model.bounds.max[axis]) || n >= model.bounds.max[axis]!))
    throw new TypeError('Invalid catalogue star model bounds.');
  });
  const sourceStars = envelope.stars;
  const inFrame = sourceStars.flatMap(star => {
    const xy = project(star.raDegrees, star.decDegrees, centerIcrsDegrees);
    if (!xy || xy.some((n, axis) => n < model.bounds.min[axis]! || n > model.bounds.max[axis]!)) return [];
    return [{ star, xy }];
  }).sort((a, b) => a.star.magnitudeV - b.star.magnitudeV || (a.star.id < b.star.id ? -1 : a.star.id > b.star.id ? 1 : 0));
  const depth = createCompilerStarDepthSampler(model), stars: CompilerStarInput[] = [];
  const selected = inFrame.slice(0, maximum).map(({ star, xy }) => {
    const conditionalDepth = depth(star.id, xy[0], xy[1]), light = appearance(star,catalogueColor);
    const positionArcsec: [number, number, number] = [xy[0], xy[1], conditionalDepth ?? 0];
    const materials: Record<string, CompilerStarMaterial> = {};
    for (const id of datasetIds) materials[id] = { ...light.material, rgb: [...light.material.rgb] };
    stars.push({ id: star.id, positionArcsec, ...light.material, materials });
    return { ...star, positionArcsec, depthAssignment: conditionalDepth === null ? 'authored-reference-plane' : 'conditional-emission-column',
      colorAssignment: star.colorIndexBV === null ? 'unknown-neutral-white' : 'catalogue-bv-display-fit',
      relativeVLight: light.relativeVLight, displayedRelativeVLight: light.displayedRelativeVLight, displayClipped: light.clipped };
  });
  return { stars, receipt: { method: 'observed-catalogue-optical-overlay@1', catalogueId: envelope.id,
    frame: 'ICRS', coordinateEpochJulianYear: 2000, centerIcrsDegrees: [...centerIcrsDegrees],
    projection: 'gnomonic-TAN-west-north-arcseconds', ranking: 'ascending-V-magnitude-then-id',
    inputCount: sourceStars.length, inFrameCount: inFrame.length, selectedCount: selected.length,
    excludedOutsideFrameCount: sourceStars.length - inFrame.length, excludedByBudgetCount: Math.max(0, inFrame.length - maximum),
    unknownColorCount: selected.filter(s => s.colorIndexBV === null).length,
    referencePlaneCount: selected.filter(s => s.depthAssignment === 'authored-reference-plane').length,
    displayClippedCount: selected.filter(s => s.displayClipped).length, datasetIds: [...datasetIds],
    presentation: { referenceMagnitudeV, referenceDiameterArcsec, minimumDiameterArcsec, maximumDiameterArcsec,
      rule: 'diameter² × alpha × encoded RGB luminance / referenceDiameter² = 10^(-0.4 × (V-referenceV)), until the bright display limit',
      interpretation: 'Authored angular light disks, not stellar angular diameters or calibrated display radiance. No faint opacity floor; unknown colors are neutral white. B−V uses the shared temperature/display-color approximation, not exact spectra.' },
    interpretation: 'All image datasets share these optical V/B−V reference lights; these are not infrared stellar photometry. Catalogue epoch 2000 is preserved without snapping to a photograph or compensating for its epoch. Photographic epoch/registration offsets require separate diagnostics. Dust support never selects stars or establishes membership; supported depths are deterministic emission-conditioned illustration, unsupported stars retain an explicit authored z=0 reference plane, neither is measured distance.',
    selected } };
}
