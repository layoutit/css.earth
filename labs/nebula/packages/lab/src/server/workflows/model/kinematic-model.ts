/** `model <id> --method kinematic`, its first form: the object's digitised long-slit centroids (`solvers.kinematics`,
 * e.g. the Helix's [O III] slit of Meaburn et al. 2005) fitted with the lab's thin expanding ellipsoid
 * (`methods/kinematics/forward-model.ts`). A grid search over inclination, depth ratio and expansion speed, with the
 * projected radius along the slit held at the evidence's own value, minimises the RMS distance of each point to the
 * nearer of the two predicted branches. The fitted ellipsoid is drawn on the registered photograph. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { calibratedValue, prepareKinematicsComparison, shellVelocities } from '@cssearth/nebula-reconstruction/methods/kinematics/forward-model';
import { readSlitEvidence } from '@cssearth/nebula-reconstruction/methods/kinematics/validation';
import type { KinematicParameters } from '@cssearth/nebula-reconstruction/methods/kinematics/types';
import { photographPixel, readPlateRecipe } from '../../../features/plates/plates-model.ts';
import type { LabObject } from '../lab-objects.ts';
import { readRecipeState } from '../plates/working-copy.ts';
import { ellipsePoints, LAB_MODEL_SCHEMA, shown, type LabModel, creditLabel } from './model-output.ts';

export const KINEMATIC_GRID = { inclinationDegrees: [0, 80, 2], depthRatio: [.5, 2.5, .05], expansionKmS: [4, 40, .5] } as const;
const steps = ([from, to, step]: readonly [number, number, number]) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, k) => Number((from + k * step).toFixed(6)));

/** The observed points' nearest-branch RMS for one ellipsoid: null when a point falls outside its projected outline. */
export function slitRms(points: readonly { offsetArcsec: number; relativeKmS: number }[], parameters: KinematicParameters): number | null {
  let squared = 0;
  for (const point of points) {
    const prediction = shellVelocities(point.offsetArcsec, parameters);
    if (!prediction) return null;
    squared += Math.min(...prediction.map(velocity => Math.abs(velocity - point.relativeKmS))) ** 2;
  }
  return Math.sqrt(squared / points.length);
}
/** The grid's best ellipsoid: lowest RMS, ties to the earlier (smaller) grid values. */
export function fitSlit(points: readonly { offsetArcsec: number; relativeKmS: number }[], radiusArcsec: number, onRow: (fraction: number) => void = () => {}) {
  let best: { parameters: KinematicParameters; rms: number } | null = null, evaluated = 0;
  const inclinations = steps(KINEMATIC_GRID.inclinationDegrees);
  inclinations.forEach((inclinationDegrees, row) => {
    for (const depthRatio of steps(KINEMATIC_GRID.depthRatio)) for (const expansionKmS of steps(KINEMATIC_GRID.expansionKmS)) {
      const parameters = { radiusArcsec, inclinationDegrees, depthRatio, expansionKmS }, rms = slitRms(points, parameters); evaluated++;
      if (rms !== null && (!best || rms < best.rms - 1e-12)) best = { parameters, rms };
    }
    onRow((row + 1) / inclinations.length);
  });
  if (!best) throw new TypeError('No ellipsoid in the grid holds every slit point inside its outline.');
  return { ...(best as { parameters: KinematicParameters; rms: number }), evaluated };
}

export async function kinematicSurfaces(root: string, object: LabObject, stage: (message: string, fraction: number) => void): Promise<LabModel> {
  const path = object.solvers.kinematics;
  if (!path) throw new TypeError(`${object.id} has no long-slit velocity evidence (subjects.json solvers.kinematics). An IFU or a general position–velocity fit is not built yet.`);
  if (object.kind !== 'plates') throw new TypeError(`${object.id}: the kinematic preview draws on a registered plate photograph.`);
  stage('Reading the slit evidence', .05);
  const evidence = readSlitEvidence(JSON.parse(await readFile(resolve(root, path), 'utf8')));
  const f = evidence.figure, points = evidence.samples.map(sample => ({ offsetArcsec: calibratedValue(sample.pixelX, f.offsetCalibration),
    relativeKmS: calibratedValue(sample.pixelY, f.velocityCalibration) - evidence.systemic.valueKmS }));
  stage('Fitting the expanding ellipsoid', .1);
  const fit = fitSlit(points, evidence.defaults.radiusArcsec, fraction => stage('Fitting the expanding ellipsoid', .1 + .7 * fraction));
  const comparison = prepareKinematicsComparison(evidence, fit.parameters, path);
  const start = prepareKinematicsComparison(evidence, evidence.defaults, path);
  stage('Drawing it on the photograph', .85);
  const { recipe: raw } = await readRecipeState(root, object.id);
  const manifest: unknown = JSON.parse(await readFile(resolve(root, object.object, 'source/manifest.json'), 'utf8').catch(() => 'null'));
  const recipe = readPlateRecipe(raw, manifest);
  const p = fit.parameters, angle = p.inclinationDegrees * Math.PI / 180;
  // The forward model's equatorial radius; north–south (across the E–W slit) the outline keeps it, east–west it is the fixed projected radius.
  const equatorial = p.radiusArcsec / Math.sqrt(Math.cos(angle) ** 2 + p.depthRatio ** 2 * Math.sin(angle) ** 2);
  const cosDec = Math.cos(recipe.observation.centerDecDeg * Math.PI / 180);
  const starEast = (recipe.target.raDeg - recipe.observation.centerRaDeg) * cosDec * 3600, starNorth = (recipe.target.decDeg - recipe.observation.centerDecDeg) * 3600;
  const centre = photographPixel(recipe, starEast, starNorth), east = photographPixel(recipe, starEast + p.radiusArcsec, starNorth), north = photographPixel(recipe, starEast, starNorth + equatorial);
  const rx = Math.hypot(east[0] - centre[0], east[1] - centre[1]), ry = Math.hypot(north[0] - centre[0], north[1] - centre[1]);
  const slitEnd = (sign: number) => photographPixel(recipe, starEast + sign * evidence.slit.lengthArcsec / 2, starNorth);
  return { schema: LAB_MODEL_SCHEMA, id: object.id, method: 'kinematic', createdAt: new Date().toISOString(),
    image: { path: `${object.object}/source/${recipe.pictures.original ?? recipe.photograph.path}`, width: recipe.photograph.width, height: recipe.photograph.height,
      label: creditLabel(recipe.photograph.credit) },
    outlines: [{ id: 'ellipsoid', label: 'Fitted shell (sky outline)', kind: 'envelope', closed: true,
      points: ellipsePoints(centre[0], centre[1], rx, ry, Math.atan2(east[1] - centre[1], east[0] - centre[0]) * 180 / Math.PI) },
    { id: 'slit', label: 'Slit', kind: 'outline', closed: false, points: [slitEnd(1), slitEnd(-1)] }],
    points: [],
    surfaces: [{ kind: 'ellipsoid', label: 'Thin expanding ellipsoid', values: { radiusArcsec: p.radiusArcsec, inclinationDeg: p.inclinationDegrees, depthRatio: shown(p.depthRatio),
      expansionKmS: p.expansionKmS, equatorialArcsec: shown(equatorial) } }],
    metrics: { slitPoints: points.length, rmsKmS: shown(fit.rms), startRmsKmS: start.metrics.nearestSurfaceRmsKmS === null ? null : shown(start.metrics.nearestSurfaceRmsKmS),
      evaluated: fit.evaluated, centralApproachingKmS: shown(comparison.metrics.centralApproachingKmS), centralRecedingKmS: shown(comparison.metrics.centralRecedingKmS),
      velocityReadoutKmS: shown(comparison.metrics.velocityReadoutKmS) },
    files: [], notes: [`One digitised slit: ${evidence.citation.label}.`, 'Every point is kept; the fit is to the nearer predicted branch.',
      'Deferred: the HCO+ joint fit (prepare-joint-fit) and a general long-slit / IFU position–velocity fit.'] };
}
