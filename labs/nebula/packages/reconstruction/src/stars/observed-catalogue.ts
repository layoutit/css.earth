export type CatalogueColor=(temperature:number,colorIndex:number)=>readonly [number,number,number];
import type { CompilerStarInput, CompilerStarMaterial, EmissionFieldModel } from '@cssearth/bake/volume';
import { createCompilerStarDepthSampler } from './compiler.ts';

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 128;
const coordinate = (ra: unknown, dec: unknown): boolean => finite(ra) && ra >= 0 && ra < 360 && finite(dec) && dec >= -90 && dec <= 90;
const error = (v: unknown): v is number | null => v === null || finite(v) && v >= 0;
type PhotometryKind = 'johnson-measured' | 'tycho-johnson-approximation';
interface ObservedStar {
  id: string;
  raDegrees: number;
  decDegrees: number;
  properMotionRaCosDecMasPerYear: number;
  properMotionDecMasPerYear: number;
  magnitudeV: number;
  colorIndexBV: number | null;
  sourceId: string;
  sourceEpochJulianYear: number;
  sourceRaDegrees: number;
  sourceDecDegrees: number;
  photometry: { kind: PhotometryKind; errorMagnitudeV: number | null; errorColorIndexBV: number | null };
}

/** Decode consumed catalogue fields; extra source columns remain in the pinned source, not type assertions. */
function readStar(value: unknown): ObservedStar {
  if (!record(value) || !text(value.id) || !finite(value.raDegrees) || !finite(value.decDegrees) ||
      !coordinate(value.raDegrees, value.decDegrees) || !finite(value.properMotionRaCosDecMasPerYear) ||
      !finite(value.properMotionDecMasPerYear) || !finite(value.magnitudeV) || value.magnitudeV < -30 || value.magnitudeV > 40 ||
      !(value.colorIndexBV === null || finite(value.colorIndexBV) && value.colorIndexBV >= -2 && value.colorIndexBV <= 10) ||
      !text(value.sourceId) || !finite(value.sourceEpochJulianYear) || value.sourceEpochJulianYear < 1800 || value.sourceEpochJulianYear > 2200 ||
      !finite(value.sourceRaDegrees) || !finite(value.sourceDecDegrees) || !coordinate(value.sourceRaDegrees, value.sourceDecDegrees) ||
      !record(value.photometry)) throw new TypeError('Invalid observed stellar catalogue record.');
  const p = value.photometry;
  if ((p.kind !== 'johnson-measured' && p.kind !== 'tycho-johnson-approximation') ||
      !error(p.errorMagnitudeV) || !error(p.errorColorIndexBV)) throw new TypeError('Invalid observed stellar photometry.');
  return { id: value.id, raDegrees: value.raDegrees, decDegrees: value.decDegrees,
    properMotionRaCosDecMasPerYear: value.properMotionRaCosDecMasPerYear, properMotionDecMasPerYear: value.properMotionDecMasPerYear,
    magnitudeV: value.magnitudeV, colorIndexBV: value.colorIndexBV, sourceId: value.sourceId,
    sourceEpochJulianYear: value.sourceEpochJulianYear, sourceRaDegrees: value.sourceRaDegrees, sourceDecDegrees: value.sourceDecDegrees,
    photometry: { kind: p.kind, errorMagnitudeV: p.errorMagnitudeV, errorColorIndexBV: p.errorColorIndexBV } };
}

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
 * Optical reference lights belong to the observed sky catalogue, independently of every image lens.
 * Conditional depths are illustrative; measured membership or stellar distances are not supplied here.
 */
export function prepareCatalogueStars(value: unknown, model: EmissionFieldModel,
  centerIcrsDegrees: [number, number], maximum: number, lensIds: string[], catalogueColor:CatalogueColor) {
  if (!record(value) || value.schema !== 'cssearth-observed-stellar-catalogue@1' || !text(value.id) || value.frame !== 'ICRS' ||
      value.coordinateEpochJulianYear !== 2000 || !Array.isArray(value.stars) || value.stars.length > 200000)
    throw new TypeError('Observed stellar catalogue requires ICRS positions at epoch 2000.');
  if (!Array.isArray(centerIcrsDegrees) || centerIcrsDegrees.length !== 2 || !coordinate(centerIcrsDegrees[0], centerIcrsDegrees[1]) ||
      !Number.isInteger(maximum) || maximum < 0 || maximum > 5000 || !Array.isArray(lensIds) || lensIds.length < 1 || lensIds.length > 8 ||
      lensIds.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) || new Set(lensIds).size !== lensIds.length)
    throw new TypeError('Invalid catalogue star frame, maximum or lens identities.');
  if (!model.bounds || !Array.isArray(model.bounds.min) || !Array.isArray(model.bounds.max) || model.bounds.min.length !== 3 ||
      model.bounds.max.length !== 3 || model.bounds.min.some((n, axis) => !finite(n) || !finite(model.bounds.max[axis]) || n >= model.bounds.max[axis]!))
    throw new TypeError('Invalid catalogue star model bounds.');
  const sourceStars = value.stars.map(readStar), ids = new Set<string>();
  for (const star of sourceStars) {
    if (ids.has(star.id)) throw new TypeError('Duplicate observed stellar catalogue identity.');
    ids.add(star.id);
  }
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
    for (const id of lensIds) materials[id] = { ...light.material, rgb: [...light.material.rgb] };
    stars.push({ id: star.id, positionArcsec, ...light.material, materials });
    return { ...star, positionArcsec, depthAssignment: conditionalDepth === null ? 'authored-reference-plane' : 'conditional-emission-column',
      colorAssignment: star.colorIndexBV === null ? 'unknown-neutral-white' : 'catalogue-bv-display-fit',
      relativeVLight: light.relativeVLight, displayedRelativeVLight: light.displayedRelativeVLight, displayClipped: light.clipped };
  });
  return { stars, receipt: { method: 'observed-catalogue-optical-overlay@1', catalogueId: value.id,
    frame: 'ICRS', coordinateEpochJulianYear: 2000, centerIcrsDegrees: [...centerIcrsDegrees],
    projection: 'gnomonic-TAN-west-north-arcseconds', ranking: 'ascending-V-magnitude-then-id',
    inputCount: sourceStars.length, inFrameCount: inFrame.length, selectedCount: selected.length,
    excludedOutsideFrameCount: sourceStars.length - inFrame.length, excludedByBudgetCount: Math.max(0, inFrame.length - maximum),
    unknownColorCount: selected.filter(s => s.colorIndexBV === null).length,
    referencePlaneCount: selected.filter(s => s.depthAssignment === 'authored-reference-plane').length,
    displayClippedCount: selected.filter(s => s.displayClipped).length, lensIds: [...lensIds],
    presentation: { referenceMagnitudeV, referenceDiameterArcsec, minimumDiameterArcsec, maximumDiameterArcsec,
      rule: 'diameter² × alpha × encoded RGB luminance / referenceDiameter² = 10^(-0.4 × (V-referenceV)), until the bright display limit',
      interpretation: 'Authored angular light disks, not stellar angular diameters or calibrated display radiance. No faint opacity floor; unknown colors are neutral white. B−V uses the shared temperature/display-color approximation, not exact spectra.' },
    interpretation: 'All image lenses share these optical V/B−V reference lights; these are not infrared stellar photometry. Catalogue epoch 2000 is preserved without snapping to a photograph or compensating for its epoch. Photographic epoch/registration offsets require separate diagnostics. Dust support never selects stars or establishes membership; supported depths are deterministic emission-conditioned illustration, unsupported stars retain an explicit authored z=0 reference plane, neither is measured distance.',
    selected } };
}
