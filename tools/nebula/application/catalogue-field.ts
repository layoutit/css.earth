/** Offline Gaia/Bailer-Jones neighbourhoods in the shared physical volume frame. */
import { sha256 } from '../../../src/platform/sha256.mts';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '@cssearth/objects';
import { rotateWorldPosition, transposeWorldRotation, worldRotationFromQuaternion } from '../../../src/renderers/css/navigation/world-camera-math.js';
import { validatePreparedCataloguePoints, type PreparedCataloguePoint } from '../../../src/renderers/css/stars/prepared-catalogue-points.js';
import { ARCSECOND_RADIANS, METERS_PER_PARSEC } from './nebula-frame.ts';

type Vector = readonly [number, number, number];
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function record(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) throw new TypeError('Catalogue field requires an object.');
  return v;
}
function number(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError('Catalogue field requires finite numbers.');
  return v;
}
function positive(v: unknown): number {
  const n = number(v); if (!(n > 0)) throw new TypeError('Catalogue field requires positive values.'); return n;
}
function nullable(v: unknown): number | null { return v === null ? null : number(v); }
function text(v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) throw new TypeError('Catalogue field requires nonempty text.'); return v;
}
function sky(raValue: unknown, decValue: unknown): [number, number] {
  const ra = number(raValue), dec = number(decValue);
  if (ra < 0 || ra >= 360 || Math.abs(dec) > 90) throw new TypeError('Catalogue field ICRS coordinates are invalid.');
  return [ra, dec];
}
function parseField(input: unknown) {
  const value = record(input), selection = record(value.selection);
  if (value.schema !== 'cssearth-gaia-nebula-field@1' || !/^[a-z][a-z0-9-]*$/.test(text(value.id))) {
    throw new TypeError('Invalid Gaia catalogue field schema or identity.');
  }
  const center = selection.centerIcrsDegrees;
  if (!Array.isArray(center) || center.length !== 2) throw new TypeError('Catalogue field needs a two-coordinate centre.');
  const centerIcrsDegrees = sky(center[0], center[1]), distancePc = positive(selection.distancePc);
  const outerRadiusPc = positive(selection.outerRadiusPc), featherStartPc = number(selection.featherStartPc);
  const maximumStars = number(selection.maximumStars), retainedMatchArcsec = number(selection.retainedMatchArcsec ?? 0);
  if (featherStartPc < 0 || featherStartPc >= outerRadiusPc || !Number.isInteger(maximumStars) ||
      maximumStars < 1 || maximumStars > 2000 || retainedMatchArcsec < 0 || retainedMatchArcsec > 180 * 3600) {
    throw new TypeError('Invalid catalogue field sphere, fade, match radius or budget.');
  }
  if (!Array.isArray(selection.retainIds)) throw new TypeError('Catalogue field needs explicit retained identities.');
  const retainIds = selection.retainIds.map(text);
  const retainedAppearance = selection.retainedAppearance ?? 'lens';
  if (retainedAppearance !== 'lens' && retainedAppearance !== 'anchor') throw new TypeError('Invalid retained star appearance policy.');
  if (new Set(retainIds).size !== retainIds.length || retainIds.length > maximumStars) throw new TypeError('Invalid retained catalogue identities or budget.');
  if (!Array.isArray(value.stars)) throw new TypeError('Catalogue field requires source rows.');
  const ids = new Set<string>();
  const stars = value.stars.map(inputStar => {
    const s = record(inputStar), sourceId = text(s.sourceId), [raDeg, decDeg] = sky(s.raDeg, s.decDeg);
    if (!/^\d{10,20}$/.test(sourceId) || ids.has(sourceId)) throw new TypeError('Gaia source identities must be unique decimal strings.');
    ids.add(sourceId);
    const distancePc = positive(s.distancePc), distanceLowerPc = positive(s.distanceLowerPc), distanceUpperPc = positive(s.distanceUpperPc);
    if (distanceLowerPc > distancePc || distancePc > distanceUpperPc) throw new TypeError('Invalid Gaia distance posterior quantiles.');
    return { sourceId, raDeg, decDeg, distancePc, distanceLowerPc, distanceUpperPc,
      pmRaMasYr: nullable(s.pmRaMasYr), pmDecMasYr: nullable(s.pmDecMasYr), photGMeanMag: number(s.photGMeanMag),
      bpRp: nullable(s.bpRp), parallaxMas: number(s.parallaxMas), parallaxErrorMas: positive(s.parallaxErrorMas), ruwe: positive(s.ruwe) };
  });
  return { id: text(value.id), coordinateEpochJulianYear: number(value.coordinateEpochJulianYear), stars,
    selection: { centerIcrsDegrees, distancePc, outerRadiusPc, featherStartPc, maximumStars, retainedMatchArcsec, retainIds, retainedAppearance,
      limitingMagnitude: number(selection.limitingMagnitude), fadeMagnitude: positive(selection.fadeMagnitude),
      referenceMagnitude: number(selection.referenceMagnitude), referenceDiameterPx: positive(selection.referenceDiameterPx),
      referenceFocalPixels: positive(selection.referenceFocalPixels) } };
}

function outside(root: string, path: string): boolean {
  const rel = relative(root, path); return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}
async function readPinned(root: string, inputPin: unknown) {
  const p = record(inputPin), path = text(p.path);
  if (isAbsolute(path) || /[\\\u0000]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..'))
    throw new TypeError('Invalid catalogue field repository-relative path.');
  const owner = await realpath(root), target = await realpath(resolve(owner, path));
  if (outside(owner, target)) throw new TypeError('Catalogue field source escapes its repository owner.');
  const bytes = await readFile(target);
  return { input: { path, sha256: sha256(bytes), bytes: bytes.length }, field: parseField(JSON.parse(bytes.toString()) as unknown) };
}

function direction(raDeg: number, decDeg: number): Vector {
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}
function scale(v: Vector, n: number): Vector { return [v[0] * n, v[1] * n, v[2] * n]; }
function subtract(a: Vector, b: Vector): Vector { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function normalize(v: Vector): Vector {
  const length = Math.hypot(...v);
  if (!(length > 0) || !Number.isFinite(length)) throw new TypeError('Invalid catalogue field physical direction.');
  return scale(v, 1 / length);
}
function propagatedDirection(star: ReturnType<typeof parseField>['stars'][number], years: number): Vector {
  const ra = star.raDeg * Math.PI / 180, dec = star.decDeg * Math.PI / 180;
  const n = direction(star.raDeg, star.decDeg), k = years * ARCSECOND_RADIANS / 1000;
  const east = (star.pmRaMasYr ?? 0) * k, north = (star.pmDecMasYr ?? 0) * k;
  // Gaia pmra already includes cos(dec); tangent vectors remain defined at the poles.
  return normalize([n[0] - east * Math.sin(ra) - north * Math.sin(dec) * Math.cos(ra),
    n[1] + east * Math.cos(ra) - north * Math.sin(dec) * Math.sin(ra), n[2] + north * Math.cos(dec)]);
}
function taper(value: number, start: number, end: number): number {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return 1 - t * t * (3 - 2 * t);
}

// Cardiel et al. (2021), Table 1, RGBmag = Gaia G + sum(a_i * (BP-RP)^i).
// These fitted camera passbands provide display chromaticity, not a stellar sRGB measurement.
const RGB_COEFFICIENTS = [
  [0.10979647, -0.14579334, 0.10747392, -0.10635920, 0.08494556, -0.01368962],
  [-0.02330159, 0.12884074, 0.22149167, -0.14550480, 0.10635149, -0.02363990],
  [-0.13748689, 0.44265552, 0.37878846, -0.14923841, 0.09172474, -0.02594726],
];
function color(bpRp: number | null): { colorCss: string; fallback: boolean } {
  if (bpRp === null || bpRp <= -0.5 || bpRp >= 2) return { colorCss: '#ffffff', fallback: true };
  const linear = RGB_COEFFICIENTS.map(coefficients => 10 ** (-0.4 * coefficients.reduceRight((sum, a) => sum * bpRp + a, 0)));
  const maximum = Math.max(...linear);
  const channels = linear.map(channel => {
    const normalized = channel / maximum;
    const display = normalized <= 0.0031308 ? 12.92 * normalized : 1.055 * normalized ** (1 / 2.4) - 0.055;
    return Math.round(display * 255).toString(16).padStart(2, '0');
  });
  return { colorCss: `#${channels.join('')}`, fallback: false };
}

/** Replaces image-derived fields with pinned 3D catalogue points; keeps only explicit named identities. */
export async function prepareNebulaCatalogueField(root: string, pin: { path: string },
  inputFrame: DensityVolumeFrame, existing: readonly PreparedCataloguePoint[], anchorPoints?: readonly PreparedCataloguePoint[]) {
  const { input, field } = await readPinned(root, pin), frame = parseDensityVolumeFrame(inputFrame), s = field.selection;
  if (frame.referenceFrame !== 'sun-icrf') throw new TypeError('Gaia catalogue fields require the Sun ICRF reference frame.');
  if (s.retainedAppearance === 'anchor' && !anchorPoints) throw new TypeError('Retained anchor photometry requires its source points.');
  const anchors = new Map((anchorPoints ? validatePreparedCataloguePoints({frame,points:anchorPoints}).points : []).map(point => [point.id,point]));
  const selected = s.retainIds.map(id => {
    const matches = existing.filter(point => point.id === id);
    if (matches.length !== 1) throw new TypeError(`Retained catalogue identity must occur exactly once: ${id}`);
    const point = matches[0]!;
    if (s.retainedAppearance !== 'anchor') return point;
    const anchor = anchors.get(id);
    if (!anchor || anchor.positionUnits.some((value,axis) => value !== point.positionUnits[axis]))
      throw new TypeError(`Retained anchor must preserve the source geometry: ${id}`);
    return anchor;
  });
  const retained = validatePreparedCataloguePoints({ frame, points: selected }).points;
  const rotation = worldRotationFromQuaternion(frame.localToReferenceXyzw), inverse = transposeWorldRotation(rotation);
  const retainedDirections = s.retainedMatchArcsec > 0 ? retained.map(point => {
    const offset = rotateWorldPosition(rotation, scale(point.positionUnits, frame.metersPerUnit));
    return normalize([frame.originM[0] + offset[0], frame.originM[1] + offset[1], frame.originM[2] + offset[2]]);
  }) : [];
  const matchChord = 2 * Math.sin(s.retainedMatchArcsec * ARCSECOND_RADIANS / 2);
  const centerPc = scale(direction(...s.centerIcrsDegrees), s.distancePc);
  const targetEpochJulianYear = 2000 + (frame.epochJdTt - 2451545) / 365.25;
  const years = targetEpochJulianYear - field.coordinateEpochJulianYear;
  const excluded = { outsideSphere: 0, faint: 0, retainedMatch: 0, budget: 0 };
  const candidates: { point: PreparedCataloguePoint; g: number; sourceId: string; fallback: boolean; missingMotion: boolean; relativeDistanceHalfWidth: number }[] = [];
  for (const star of field.stars) {
    const n = propagatedDirection(star, years), positionPc = scale(n, star.distancePc);
    const separationPc = Math.hypot(...subtract(positionPc, centerPc));
    if (separationPc >= s.outerRadiusPc) { excluded.outsideSphere++; continue; }
    if (star.photGMeanMag >= s.limitingMagnitude) { excluded.faint++; continue; }
    if (retainedDirections.some(kept => Math.hypot(...subtract(n, kept)) <= matchChord)) { excluded.retainedMatch++; continue; }
    const positionUnits = rotateWorldPosition(inverse,
      scale(subtract(scale(positionPc, METERS_PER_PARSEC), frame.originM), 1 / frame.metersPerUnit));
    const sizePx = s.referenceDiameterPx * 10 ** (-0.2 * (star.photGMeanMag - s.referenceMagnitude));
    const diameterUnits = star.distancePc * METERS_PER_PARSEC / frame.metersPerUnit * sizePx / s.referenceFocalPixels;
    const presentation = color(star.bpRp);
    const opacity = taper(separationPc, s.featherStartPc, s.outerRadiusPc) *
      taper(star.photGMeanMag, s.limitingMagnitude - s.fadeMagnitude, s.limitingMagnitude);
    candidates.push({ point: { id: `gaia-dr3:${star.sourceId}`, positionUnits, sizePx, diameterUnits,
      colorCss: presentation.colorCss, opacity }, g: star.photGMeanMag, sourceId: star.sourceId, fallback: presentation.fallback,
      missingMotion: star.pmRaMasYr === null || star.pmDecMasYr === null,
      relativeDistanceHalfWidth: (star.distanceUpperPc - star.distanceLowerPc) / (2 * star.distancePc) });
  }
  candidates.sort((a, b) => a.g - b.g || (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0));
  const chosen = candidates.slice(0, s.maximumStars - retained.length);
  excluded.budget = candidates.length - chosen.length;
  const points = validatePreparedCataloguePoints({ frame, points: [...retained, ...chosen.map(row => row.point)] }).points;
  return { points, receipt: {
    schema: 'cssearth-prepared-gaia-nebula-field@1', id: field.id, input,
    sourceCount: field.stars.length, catalogueCount: chosen.length, retainedCount: retained.length, pointCount: points.length,
    retainedIds: s.retainIds, excluded, selection: s,
    coordinateEpochJulianYear: field.coordinateEpochJulianYear, targetEpochJdTt: frame.epochJdTt, targetEpochJulianYear,
    missingProperMotionCount: chosen.filter(row => row.missingMotion).length,
    neutralColorCount: chosen.filter(row => row.fallback).length,
    maximumRelativeDistanceHalfWidth: chosen.reduce((max, row) => Math.max(max, row.relativeDistanceHalfWidth), 0),
    astrometry: 'ICRS directions propagated by tangent-vector Gaia pmra (mu_alpha*cos(dec)) and pmdec in Julian years; null components are zero. Distance held at the Bailer-Jones geometric posterior median; no radial velocity or perspective acceleration. Gaia TCB epoch approximated in TT Julian years.',
    distance: 'Bailer-Jones et al. 2021 EDR3 geometric posterior medians, not cluster membership. Original lower/upper posterior quantiles remain in the pinned source; uncertainties do not become fabricated depth scatter.',
    retainedDepth: 'Explicit retained points keep their pre-existing physical positions and depth provenance; no Gaia distance is assigned to them. Angular matches suppress duplicate field rows only.',
    retainedAppearance: s.retainedAppearance === 'anchor' ? 'Retained cores use their detecting source aperture photometry in every lens, including where a selected image has no coverage. Positions remain fixed; colors are source display colors, not measurements in the selected spectral band.' : 'Retained sources preserve the selected lens material.',
    coverage: 'Authored sphere and smoothstep outer feather in three physical dimensions; independent of nebula image bounds. Brightness budget includes retained points.',
    photometry: 'Measured Gaia G controls display area via diameter proportional to 10^(-0.2*(G-referenceMagnitude)); physical display footprint calibrated at source distance and reference focal length. These are display footprints, not stellar diameters. Faint-end opacity uses a separate smoothstep taper.',
    color: { source: 'https://arxiv.org/abs/2107.08734', method: 'Cardiel et al. 2021 Table 1 RGB polynomial; relative fluxes normalized to maximum then sRGB encoded for CSS display.',
      domain: '-0.5 < Gaia BP-RP < 2.0; neutral white outside or missing.',
      limitation: 'Estimated display chromaticity; camera passbands are not sRGB measurements. No individual calibration accuracy asserted for extinction or metallicity outside the paper sample.' },
  } };
}
