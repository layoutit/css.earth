import assert from 'node:assert/strict';
/** Encounter FITS photographs: calibrated flyby images whose cameras come from a registered control network. */
import { sha256 } from '../../../../src/platform/sha256.mts';
import type { ObservationCamera, ObservationFrame, ObservationImage, SurfaceObservationFormat } from '../contract.mts';
import type { SourceMesh } from '../../terrestrial-layers/contracts.mts';
import { decodeProfile, publishedOr, parseLevelMatching, parseSurfaceGeometry, parseEncounterSourceControl, surfaceTransfer } from '../../terrestrial-layers/source-records.mts';
import { array, number, optional, shape, text, requireArray, requireRecord } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeEncounterFits } from '../../terrestrial-layers/encounter-fits.mts';
import { encounterCamera } from '../../terrestrial-layers/encounter-camera.mts';
import { validateEncounterControls } from '../../terrestrial-layers/encounter-controls.mts';
import { validPublishedPhotometryShape } from '../../terrestrial-layers/published-photometry.mts';
import { castSourceRays } from '../geometry.mts';
import { cameraFrame } from '../footprint.mts';
import { retainedPhotometry, publishedPhotometry } from '../photometry.mts';
import { deriveLimits } from '../limits.mts';
import { LENS_KEYS, MOSAIC_KEYS, OPTIONAL_LENS_KEYS, checkKeys, displayBasis, parseDisplay, validateEnvelope, validateTransfer } from '../recipe.mts';

const CONTEXT = 'encounter photography recipe';

export const parseEncounterLens = shape({ id: text, format: text, consumer: text, metadata: shape({ label: text, coverage: text }),
  frames: array(shape({ id: text, path: text, labelPath: text, controlPath: text })), transfer: surfaceTransfer,
  photometry: publishedOr(shape({ model: text, maximumGain: number })), selection: optional(text), levelMatching: optional(parseLevelMatching), display: parseDisplay });

export function validateEncounterRecipe(value: unknown, sourceGeometry: unknown) {
  checkKeys(value, [...LENS_KEYS], [...MOSAIC_KEYS, ...OPTIONAL_LENS_KEYS], CONTEXT);
  for (const frame of requireArray(requireRecord(value).frames)) checkKeys(frame, ['id', 'path', 'labelPath', 'controlPath'], [], `${CONTEXT} frame`);
  const recipe = decodeProfile(parseEncounterLens, value, `Invalid source-bound ${CONTEXT}.`), geometry = parseSurfaceGeometry(sourceGeometry);
  validateEnvelope(recipe, recipe.frames.flatMap(f => [f.path, f.labelPath, f.controlPath]),
    { selections: ['lowest-emission', 'finest-resolution'], displays: ['percentiles'], maximumFrames: 8, maximumLevelGain: 3, samplesPerTriangle: 'optional' }, CONTEXT);
  validateTransfer(recipe.transfer, geometry, CONTEXT);
  if (recipe.format !== 'encounter-fits' || !('referenceDegrees' in recipe.photometry ? validPublishedPhotometryShape(recipe.photometry, recipe.transfer.maximumEmissionDegrees)
      : recipe.photometry.model === 'retained-observation' && recipe.photometry.maximumGain === 1)) throw new TypeError(`Invalid source-bound ${CONTEXT}.`);
}

interface EncounterReference { id: string; camera: Pick<ObservationCamera, 'project' | 'positionMeters'>; sample(point: readonly number[]): { reason?: string } }

/** A close-up must inherit an already-qualified, byte-pinned photograph in this mosaic. Recheck its reference pixels against the original mesh. */
export function validateEncounterImageReference(control: { registration: { method: string; reference?: { id: string }; controls: readonly { referencePixel?: readonly number[]; sourcePointMeters: readonly number[] }[] } },
  reference: EncounterReference | undefined, mesh: { intersect: (...args: Parameters<SourceMesh['intersect']>) => { radius: number } | null }) {
  const r = control.registration;
  if (r.method !== 'registered-image-feature-translation') return;
  if (!r.reference || !reference || reference.id !== r.reference.id) throw new Error('Close-up reference must be an earlier qualified image with matching source hashes.');
  for (const p of r.controls) {
    const projected = reference.camera.project(p.sourcePointMeters);
    if (!p.referencePixel || !projected || Math.hypot(projected[0] - p.referencePixel[0], projected[1] - p.referencePixel[1]) > 1e-6 || reference.sample(p.sourcePointMeters).reason) throw new Error('Close-up control is not bound to a qualified reference pixel.');
    const delta = p.sourcePointMeters.map((n, i) => n - reference.camera.positionMeters[i]), distance = Math.hypot(...delta), hit = mesh.intersect(reference.camera.positionMeters, delta.map(n => n / distance), distance + .5);
    if (!hit || Math.abs(hit.radius - distance) > .5) throw new Error('Close-up reference control is occluded or off the source mesh.');
  }
}

export const encounterFormat: SurfaceObservationFormat = {
  validate: validateEncounterRecipe,
  paths: value => parseEncounterLens(value).frames.flatMap(f => [f.path, f.labelPath, f.controlPath]),
  async load(value, { sourceDirectory, source, radial, config }) {
    const recipe = parseEncounterLens(value), shape = await source.validatePath(config.geometry.radialTerrain.path);
    const photometry = 'referenceDegrees' in recipe.photometry ? await publishedPhotometry(sourceDirectory, source.manifest, recipe.photometry) : retainedPhotometry(recipe.photometry);
    const frames: ObservationFrame[] = [], references = new Map<string, EncounterReference>();
    let units = '';
    for (const f of recipe.frames) {
      const controlBytes = await readFile(resolve(sourceDirectory, f.controlPath)), imageBytes = await readFile(resolve(sourceDirectory, f.path));
      const control = parseEncounterSourceControl(JSON.parse(controlBytes.toString('utf8')));
      const decoded = decodeEncounterFits(imageBytes, control.observation), encounter = encounterCamera(decoded.header, control.camera);
      const registration = validateEncounterControls(encounter, control.registration);
      // The registration's source-scale pixel size ranks finest-resolution selection.
      const camera: ObservationCamera = { kind: 'control-network', project: encounter.project, ray: encounter.ray, positionMeters: encounter.positionMeters, positionKm: encounter.positionKm,
        sunDirection: encounter.sunDirection, pinhole: true, nominalPixelScaleMeters: registration.nominalPixelScaleMeters, report: encounter.report };
      const image: ObservationImage = { width: decoded.width, height: decoded.height, values: decoded.values, reject: decoded.reason,
        startTime: String(decoded.startTime), filter: String(decoded.filter), report: decoded.report };
      const frame = cameraFrame({ id: f.id, image, camera, geometry: castSourceRays(camera, radial.grid, decoded.width, decoded.height), photometry, limits: recipe.transfer, mesh: radial.grid, report: { registration } });
      validateEncounterImageReference(control, references.get(control.registration.reference?.id ?? ''), radial.grid);
      references.set(f.id, { id: f.id, camera, sample: frame.sample });
      frames.push(frame); units ||= decoded.units;
    }
    const { report: limits, exceeded } = deriveLimits(recipe.transfer, frames, config.geometry.radialTerrain.simplification.maximumErrorMeters);
    return { frames, exceeded, policy: { format: recipe.format,
      selection: frames.length === 1 ? 'single' : recipe.selection === 'finest-resolution' ? 'finest-resolution' : 'lowest-emission',
      levelMatching: recipe.levelMatching, samplesPerTriangle: recipe.levelMatching?.samplesPerTriangle ?? 8,
      display: { range: 'surface-samples', percentiles: recipe.display.percentiles ?? [], units: photometry.units ?? units, ...displayBasis(recipe.display) }, photometry: photometry.report, retainsIllumination: photometry.retainsIllumination, limits } };
  },
};
