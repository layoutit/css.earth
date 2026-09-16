/** The surface-observation route: one validator and one loader for every photograph format. See README.md. */
import type { SurfaceOptions } from '../terrestrial-layers/contracts.mts';
import type { SurfaceObservationFormat } from './contract.mts';
import { requireRecord, requireString } from '../../source-values.mts';
import { GEO_FORMATS, geoFormat } from './formats/geo.mts';
import { encounterFormat } from './formats/encounter.mts';
import { orthographicFormat } from './formats/orthographic.mts';
import { controlledCameraFormat, controlledColorFormat } from './formats/controlled-camera.mts';
import { createSurfaceObservation, type SurfaceObservation } from './surface.mts';
import { parseRefinement, refinementDecision, registrationStage } from './registration.mts';
import { turnedCamera } from './cameras.mts';

export type { SurfaceObservation, SurfaceObservationReport } from './surface.mts';

/** Every format an owner can name in `raster.surfaceObservations`. A new archive product adds an adapter here. */
export const SURFACE_OBSERVATION_FORMATS: Readonly<Record<string, SurfaceObservationFormat>> = {
  ...Object.fromEntries(GEO_FORMATS.map(format => [format, geoFormat])),
  'encounter-fits': encounterFormat,
  'isis2-orthographic': orthographicFormat,
  'controlled-shape-camera': controlledCameraFormat,
  'controlled-shape-color': controlledColorFormat,
};

const formatOf = (recipe: unknown) => {
  const format = SURFACE_OBSERVATION_FORMATS[String(requireRecord(recipe).format)];
  if (!format) throw new TypeError('Invalid source-bound surface observation format.');
  return format;
};

export function validateSurfaceObservation(recipe: unknown, sourceGeometry: unknown) {
  formatOf(recipe).validate(recipe, sourceGeometry);
}

export async function loadSurfaceObservation({ sourceDirectory, source, recipe, radial, config }: SurfaceOptions): Promise<SurfaceObservation> {
  const format = formatOf(recipe);
  format.validate(recipe, config.geometry.radialTerrain);
  const entries = await source.validateGroup(requireString(requireRecord(recipe).consumer)), paths = format.paths(recipe);
  if (entries.length !== paths.length || new Set(paths).size !== paths.length || !paths.every(path => entries.some(entry => entry.path === path))) {
    throw new Error('A surface observation must consume exactly its pinned images, labels, cameras and companions.');
  }
  const context = { sourceDirectory, source, radial, config, entries };
  const { frames, policy, exceeded } = await format.load(recipe, context);
  // A limit looser than the frames' measured footprint and the mesh error allow would admit pixels across a limb or a neck.
  if (exceeded.length) throw new Error(`Surface observation ${String(requireRecord(recipe).id)} states ${exceeded.join(' and ')} beyond what its frames support: ${JSON.stringify(requireRecord(policy.limits).derived)}.`);
  // Every camera route is measured the same way after it loads; a format's own registration, such as filter bands, is kept beside it.
  const lens = requireRecord(recipe);
  let measured = frames, stage = await registrationStage(frames, lens, context), refinement: Record<string, unknown> | undefined;
  // A format's own refinement, such as the kernel route's limb refinement, states a `method` and is the format's business;
  // a refinement that names a reference `by` is the stage's, and may turn every camera of the lens by that reference's
  // decisive median, once, when no other reference disagrees. The turned lens is measured again.
  if (lens.refinement !== undefined && requireRecord(lens.refinement).by !== undefined) {
    const wanted = parseRefinement(lens.refinement);
    if (!stage) throw new Error('A refinement needs frames that carry cameras.');
    const decision = refinementDecision(stage, wanted);
    refinement = { ...decision, rule: { minimumFrames: stage.reference.rule.minimumFrames } };
    if (decision.applied && decision.turnDegrees !== null && decision.turnDegrees !== 0) {
      const before = stage;
      measured = frames.map(frame => frame.detector && frame.withCamera ? frame.withCamera(turnedCamera(frame.detector.camera, decision.turnDegrees as number, { by: wanted.by })) : frame);
      stage = await registrationStage(measured, lens, context);
      refinement.before = { silhouette: { rmsDegrees: before.silhouette.rmsDegrees, systematicDegrees: before.silhouette.systematicDegrees }, reference: { decisive: before.reference.decisive, medianOffsetDegrees: before.reference.medianOffsetDegrees }, relief: { decisive: before.relief.decisive, medianOffsetDegrees: before.relief.medianOffsetDegrees } };
    }
  }
  const registration = policy.registration || stage ? { ...(policy.registration ? { bands: policy.registration } : {}), ...(stage ?? {}), ...(refinement ? { refinement } : {}) } : undefined;
  return createSurfaceObservation({ frames: measured, policy: { ...policy, registration }, radial, config, entries });
}
