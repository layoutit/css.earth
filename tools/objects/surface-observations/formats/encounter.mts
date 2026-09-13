/** Encounter FITS photographs: calibrated flyby images whose cameras come from a registered control network. */
import type { ObservationCamera, ObservationFrame, ObservationImage, SurfaceObservationFormat } from '../contract.mts';
import type { SourceMesh } from '../../terrestrial-layers/contracts.mts';
import { parseEncounterRecipe, parseSurfaceGeometry, parseEncounterSourceControl, decodeProfile } from '../../terrestrial-layers/source-records.mts';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { decodeEncounterFits } from '../../terrestrial-layers/encounter-fits.mts';
import { encounterCamera } from '../../terrestrial-layers/encounter-camera.mts';
import { validateEncounterRegistration } from '../../terrestrial-layers/encounter-registration.mts';
import { validPublishedPhotometryShape } from '../../terrestrial-layers/published-photometry.mts';
import { castSourceRays } from '../geometry.mts';
import { cameraFrame } from '../footprint.mts';
import { observedPhotometry, publishedPhotometry } from '../photometry.mts';
import { deriveLimits, MAXIMUM_SEPARATION_FOOTPRINTS } from '../limits.mts';

const safePath = (p: unknown) => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.split(/[\\/]/).includes('..');
const positive = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n) && n > 0;
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export function validateEncounterRecipe(value: unknown, sourceGeometry: unknown) {
  const recipe = decodeProfile(parseEncounterRecipe, value, 'Invalid source-bound encounter photography recipe.'), geometry = parseSurfaceGeometry(sourceGeometry);
  const t = recipe.transfer, levels = recipe.levelMatching, paths = recipe.frames.flatMap(f => [f.path, f.labelPath, f.controlPath]);
  if (recipe.format !== 'encounter-fits' || !/^[a-z][a-z0-9-]*$/.test(recipe.id) || !/^[a-z][a-z0-9-]*$/.test(recipe.consumer) ||
      !Array.isArray(recipe.frames) || recipe.frames.length < 1 || recipe.frames.length > 8 ||
      recipe.frames.some(f => !f || !/^[a-z][a-z0-9-]*$/.test(f.id) || ![f.path, f.labelPath, f.controlPath].every(safePath)) ||
      new Set(recipe.frames.map(f => f.id)).size !== recipe.frames.length || new Set(paths).size !== paths.length || !recipe.metadata?.label || !recipe.metadata?.coverage ||
      geometry?.simplification?.method !== 'source-meshoptimizer' ||
      !positive(t?.maximumSourceDistanceMeters) || t.maximumSourceDistanceMeters > geometry.simplification.maximumErrorMeters ||
      !(t.maximumSeparationFootprints === undefined ? positive(t.maximumSeparationMeters)
        : t.maximumSeparationMeters === undefined && positive(t.maximumSeparationFootprints) && t.maximumSeparationFootprints <= MAXIMUM_SEPARATION_FOOTPRINTS) ||
      !positive(t?.visibilityToleranceMeters) || t.visibilityToleranceMeters > 1 ||
      !positive(t?.maximumEmissionDegrees) || t.maximumEmissionDegrees >= 90 ||
      !('referenceDegrees' in recipe.photometry ? validPublishedPhotometryShape(recipe.photometry, t.maximumEmissionDegrees) : recipe.photometry.model === 'observed' && recipe.photometry.maximumGain === 1) ||
      !['lowest-emission', 'finest-resolution'].includes(recipe.selection) || !Array.isArray(recipe.displayPercentiles) || recipe.displayPercentiles.length !== 2 ||
      !recipe.displayPercentiles.every(Number.isFinite) || recipe.displayPercentiles[0] < 0 || recipe.displayPercentiles[1] > 100 || recipe.displayPercentiles[0] >= recipe.displayPercentiles[1] ||
      (recipe.frames.length > 1 && (!levels || !Number.isInteger(levels.minimumPairs) || levels.minimumPairs < 64 || !(levels.maximumLogMad > 0 && levels.maximumLogMad <= .3) ||
        !(levels.maximumGain >= 1 && levels.maximumGain <= 3) ||
        (levels.samplesPerTriangle !== undefined && (!Number.isInteger(levels.samplesPerTriangle) || levels.samplesPerTriangle < 4 || levels.samplesPerTriangle > 64))))) {
    throw new TypeError('Invalid source-bound encounter photography recipe.');
  }
}

interface EncounterReference { id: string; imageSha256: string; controlSha256: string; camera: Pick<ObservationCamera, 'project' | 'positionMeters'>; sample(point: readonly number[]): { reason?: string } }

/** A close-up must inherit an already-qualified, byte-pinned photograph in this mosaic. Recheck its reference pixels against the original mesh. */
export function validateEncounterImageReference(control: { registration: { method: string; reference?: { id: string; imageSha256: string; controlSha256: string }; controls: readonly { referencePixel?: readonly number[]; sourcePointMeters: readonly number[] }[] } },
  reference: EncounterReference | undefined, mesh: { intersect: (...args: Parameters<SourceMesh['intersect']>) => { radius: number } | null }) {
  const r = control.registration;
  if (r.method !== 'registered-image-feature-translation') return;
  if (!r.reference || !reference || reference.id !== r.reference.id || reference.imageSha256 !== r.reference.imageSha256 || reference.controlSha256 !== r.reference.controlSha256) throw new Error('Close-up reference must be an earlier qualified image with matching source hashes.');
  for (const p of r.controls) {
    const projected = reference.camera.project(p.sourcePointMeters);
    if (!p.referencePixel || !projected || Math.hypot(projected[0] - p.referencePixel[0], projected[1] - p.referencePixel[1]) > 1e-6 || reference.sample(p.sourcePointMeters).reason) throw new Error('Close-up control is not bound to a qualified reference pixel.');
    const delta = p.sourcePointMeters.map((n, i) => n - reference.camera.positionMeters[i]), distance = Math.hypot(...delta), hit = mesh.intersect(reference.camera.positionMeters, delta.map(n => n / distance), distance + .5);
    if (!hit || Math.abs(hit.radius - distance) > .5) throw new Error('Close-up reference control is occluded or off the source mesh.');
  }
}

export const encounterFormat: SurfaceObservationFormat = {
  validate: validateEncounterRecipe,
  paths: value => parseEncounterRecipe(value).frames.flatMap(f => [f.path, f.labelPath, f.controlPath]),
  async load(value, { sourceDirectory, source, radial, config }) {
    const recipe = parseEncounterRecipe(value), shape = await source.validatePath(config.geometry.radialTerrain.path);
    const photometry = 'referenceDegrees' in recipe.photometry ? await publishedPhotometry(sourceDirectory, source.manifest, recipe.photometry) : observedPhotometry(recipe.photometry);
    const frames: ObservationFrame[] = [], references = new Map<string, EncounterReference>();
    let units = '';
    for (const f of recipe.frames) {
      const controlBytes = await readFile(resolve(sourceDirectory, f.controlPath)), imageBytes = await readFile(resolve(sourceDirectory, f.path));
      const control = parseEncounterSourceControl(JSON.parse(controlBytes.toString('utf8')));
      const decoded = decodeEncounterFits(imageBytes, control.observation), encounter = encounterCamera(decoded.header, control.camera);
      const registration = validateEncounterRegistration(encounter, control.registration, shape.expectedSha256);
      // The registration's source-scale pixel size ranks finest-resolution selection.
      const camera: ObservationCamera = { kind: 'control-network', project: encounter.project, ray: encounter.ray, positionMeters: encounter.positionMeters, positionKm: encounter.positionKm,
        sunDirection: encounter.sunDirection, pinhole: true, nominalPixelScaleMeters: registration.nominalPixelScaleMeters, report: encounter.report };
      const image: ObservationImage = { width: decoded.width, height: decoded.height, values: decoded.values, reject: decoded.reason,
        startTime: String(decoded.startTime), filter: String(decoded.filter), report: decoded.report };
      const frame = cameraFrame({ id: f.id, image, camera, geometry: castSourceRays(camera, radial.grid, decoded.width, decoded.height), photometry, limits: recipe.transfer, mesh: radial.grid, report: { registration } });
      validateEncounterImageReference(control, references.get(control.registration.reference?.id ?? ''), radial.grid);
      references.set(f.id, { id: f.id, imageSha256: sha256(imageBytes), controlSha256: sha256(controlBytes), camera, sample: frame.sample });
      frames.push(frame); units ||= decoded.units;
    }
    const { report: limits, exceeded } = deriveLimits(recipe.transfer, frames, config.geometry.radialTerrain.simplification.maximumErrorMeters);
    return { frames, exceeded, policy: { format: recipe.format, maximumSourceDistanceMeters: recipe.transfer.maximumSourceDistanceMeters, precheckDisplayPoint: false,
      selection: frames.length === 1 ? 'single' : recipe.selection === 'finest-resolution' ? 'finest-resolution' : 'lowest-emission',
      levelMatching: recipe.levelMatching, samplesPerTriangle: recipe.levelMatching?.samplesPerTriangle ?? 8,
      display: { range: 'surface-samples', percentiles: recipe.displayPercentiles, units: photometry.units ?? units }, photometry: photometry.report, limits } };
  },
};
