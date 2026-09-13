import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readStructureCatalogue } from '../../alignment/observations-ui/structures-model';
import { prepareEvidenceInputs } from '../evidence-fusion/provider';
import { combineEvidence } from '../evidence-fusion/combine';
import { buildRidgeGraph } from '../evidence-fusion/ridge-graph';
import { loadMolecularCatalogue } from '../kinematics/molecular-source';
import { readGeometryLocal, geometrySha } from '../geometry/registered-source';
import { readJointRecipe, type JointRequest, type JointEvidence, type JointRidgePoint } from './model';
import { velocityPoint } from './fitter';

/** Small-angle sky registration at the 70-arcsec beam scale, not a precision FK5/ICRS transformation. */
export function tangentOffsetWestNorth(origin: [number, number], center: [number, number]): [number, number] {
  let ra = origin[0] - center[0]; while (ra > 180) ra -= 360; while (ra < -180) ra += 360;
  return [-ra * Math.cos(center[1] * Math.PI / 180) * 3600, (origin[1] - center[1]) * 3600];
}
export async function prepareJointInput(root: string, request: JointRequest) {
  const recipeBytes = await readFile(resolve(root, request.recipePath)), recipe = readJointRecipe(JSON.parse(recipeBytes.toString()));
  const catalogue = readStructureCatalogue(JSON.parse((await readGeometryLocal(root, request.cataloguePath)).toString()));
  const [inputs, molecular] = await Promise.all([
    prepareEvidenceInputs(root, request.cataloguePath, { imageToFrame: request.imageToFrame }),
    loadMolecularCatalogue(root, recipe.molecularSource),
  ]);
  const combined = combineEvidence(inputs, { ...request.evidence, channel: 'ridges' });
  const graph = buildRidgeGraph(inputs, combined, { threshold: request.controls.ridgeThreshold, minLengthArcseconds: request.controls.minLengthArcseconds });
  const frameOffset = tangentOffsetWestNorth(catalogue.frame.centerIcrsDegrees, recipe.centerIcrsDegrees), grid = inputs.grid;
  const pixelToSky = (x: number, y: number): [number, number] => [
    (grid.originX + x / grid.width * grid.extentWidth - grid.frameWidth / 2) * grid.fieldArcminutes[0] * 60 / grid.frameWidth + frameOffset[0],
    (grid.frameHeight / 2 - grid.originY - y / grid.height * grid.extentHeight) * grid.fieldArcminutes[1] * 60 / grid.frameHeight + frameOffset[1],
  ];
  const skyToPixel = (x: number, y: number): [number, number] => [
    ((x - frameOffset[0]) * grid.frameWidth / (grid.fieldArcminutes[0] * 60) + grid.frameWidth / 2 - grid.originX) / grid.extentWidth * grid.width,
    (grid.frameHeight / 2 - (y - frameOffset[1]) * grid.frameHeight / (grid.fieldArcminutes[1] * 60) - grid.originY) / grid.extentHeight * grid.height,
  ];
  const ridges: JointRidgePoint[] = [];
  for (const line of graph.polylines) for (const p of line.points) {
    const [x, y] = pixelToSky(p.x, p.y), radius = Math.hypot(x, y);
    if (radius >= recipe.morphologyRadiusArcsec[0] && radius <= recipe.morphologyRadiusArcsec[1]) ridges.push({ x, y, weight: p.score, polylineId: line.id });
  }
  const origin = molecular.recipe.coordinates.originJ2000Degrees;
  const molecularOffset = tangentOffsetWestNorth([origin.ra, origin.dec], recipe.centerIcrsDegrees);
  const velocities = molecular.points.filter(p => p.status === 'detection' && p.velocityLsrKmS !== null).map(p =>
    velocityPoint(p.id, p.pointingKey, p.xWestArcsec + molecularOffset[0], p.yNorthArcsec + molecularOffset[1], p.velocityLsrKmS!));
  const evidence: JointEvidence = { ridges, velocities, beamFwhmArcsec: molecular.recipe.instrument.beamFwhmArcsec };
  return { recipe, recipeSha256: geometrySha(recipeBytes), catalogue, inputs, combined, graph, molecular, evidence, pixelToSky, skyToPixel, molecularOffset };
}
