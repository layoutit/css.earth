/** The surface-observation route: one validator and one loader for every photograph format. See README.md. */
import type { SurfaceOptions } from '../terrestrial-layers/contracts.mts';
import type { SurfaceObservationFormat } from './contract.mts';
import { requireRecord, requireString } from '@cssearth/core';
import { GEO_FORMATS, geoFormat } from './formats/geo.mts';
import { encounterFormat } from './formats/encounter.mts';
import { orthographicFormat } from './formats/orthographic.mts';
import { controlledCameraFormat, controlledColorFormat } from './formats/controlled-camera.mts';
import { junocamFormat } from './formats/junocam.mts';
import { JUNOCAM_FORMAT } from '../terrestrial-layers/junocam.mts';
import { createSurfaceObservation, type SurfaceObservation } from './surface.mts';
import { TILT, parseRefinement, refinementDecision, refinementKept, registrationStage, tiltDecision } from './registration.mts';
import { tiltedCamera, turnedCamera } from './cameras.mts';

export type { SurfaceObservation, SurfaceObservationReport } from './surface.mts';

/** Every format an owner can name in `raster.surfaceObservations`. A new archive product adds an adapter here. */
export const SURFACE_OBSERVATION_FORMATS: Readonly<Record<string, SurfaceObservationFormat>> = {
  ...Object.fromEntries(GEO_FORMATS.map(format => [format, geoFormat])),
  'encounter-fits': encounterFormat,
  'isis2-orthographic': orthographicFormat,
  'controlled-shape-camera': controlledCameraFormat,
  'controlled-shape-color': controlledColorFormat,
  [JUNOCAM_FORMAT]: junocamFormat,
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
  // Every camera route is measured the same way after it loads.
  const lens = requireRecord(recipe);
  let measured = frames, stage = await registrationStage(frames, lens, context), refinement: Record<string, unknown> | undefined;
  // A refinement names a reference and may turn every camera of the lens by that reference's decisive median, once, when no other
  // reference disagrees; the turned lens is measured again. A route's own limb fit is `limbRefinement`, which the format applies.
  if (lens.refinement !== undefined) {
    const wanted = parseRefinement(lens.refinement);
    if (!stage) throw new Error('A refinement needs frames that carry cameras.');
    // The turn about the pole comes from the named sweep, the tilt about the line of sight from the silhouette; both are
    // decided on the untouched measurement, applied once, and the corrected lens is measured again.
    const turn = wanted.by ? refinementDecision(stage, wanted) : undefined, tilt = wanted.tilt ? tiltDecision(stage) : undefined;
    refinement = { ...(turn ? { turn } : {}), ...(tilt ? { tilt } : {}), rule: { minimumFrames: stage.reference.rule.minimumFrames, minimumScored: TILT.minimumScored, agreementDegrees: wanted.agreementDegrees } };
    let turnBy = turn?.applied && turn.turnDegrees ? turn.turnDegrees : 0, tiltBy = tilt?.applied && tilt.tiltDegrees ? tilt.tiltDegrees : 0;
    const corrected = (turnDegrees: number, tiltDegrees: number) => frames.map(frame => {
      if (!frame.detector || !frame.withCamera) return frame;
      let camera = frame.detector.camera;
      if (turnDegrees) camera = turnedCamera(camera, turnDegrees, { by: wanted.by });
      if (tiltDegrees) camera = tiltedCamera(camera, tiltDegrees, { tilt: wanted.tilt });
      return frame.withCamera(camera);
    });
    const summary = (report: NonNullable<typeof stage>) => ({ silhouette: { rmsDegrees: report.silhouette.rmsDegrees, noiseFloorDegrees: report.silhouette.noiseFloorDegrees, systematicDegrees: report.silhouette.systematicDegrees }, reference: { decisive: report.reference.decisive, medianOffsetDegrees: report.reference.medianOffsetDegrees }, relief: { decisive: report.relief.decisive, medianOffsetDegrees: report.relief.medianOffsetDegrees } });
    if (turnBy || tiltBy) {
      const before = stage;
      // A correction is kept only if the second measurement improves what it came from; one that does not is reverted and the rest measured again.
      const measure = async (turnDegrees: number, tiltDegrees: number) => { const report = await registrationStage(corrected(turnDegrees, tiltDegrees), lens, context); if (!report) throw new Error('The corrected lens lost its cameras.'); return report; };
      let attempt = await measure(turnBy, tiltBy), kept = refinementKept(before, attempt, turnBy ? wanted.by : undefined, tiltBy !== 0);
      refinement.before = summary(before);
      if ((kept.turn && !kept.turn.kept) || (kept.tilt && !kept.tilt.kept)) {
        refinement.reverted = { ...(kept.turn && !kept.turn.kept ? { turn: kept.turn.reason } : {}), ...(kept.tilt && !kept.tilt.kept ? { tilt: kept.tilt.reason } : {}) };
        if (kept.turn && !kept.turn.kept) turnBy = 0;
        if (kept.tilt && !kept.tilt.kept) tiltBy = 0;
        attempt = turnBy || tiltBy ? await measure(turnBy, tiltBy) : before;
        kept = turnBy || tiltBy ? refinementKept(before, attempt, turnBy ? wanted.by : undefined, tiltBy !== 0) : {};
      }
      refinement.kept = kept;
      if (turn) (refinement.turn as Record<string, unknown>).applied = turnBy !== 0;
      if (tilt) (refinement.tilt as Record<string, unknown>).applied = tiltBy !== 0;
      if (turnBy || tiltBy) { measured = corrected(turnBy, tiltBy); stage = attempt; }
    }
  }
  const registration = stage ? { ...stage, ...(refinement ? { refinement } : {}) } : undefined;
  return createSurfaceObservation({ frames: measured, policy: { ...policy, registration }, radial, config, entries });
}
