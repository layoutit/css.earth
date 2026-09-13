import { shape, array, optional, boolean, text, number } from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import { requireRecord } from '../../../../tools/source-values.mts';
import type { SourceMesh } from '../../../../tools/objects/terrestrial-layers/contracts.mts';
// Preparation-only comparison of the published source mesh and retained faces.
// Range differences along matched rays are not a Hausdorff distance or an
// exhaustive source-accuracy bound, especially at silhouette/occlusion edges.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { OBJECTS } from '../../../../site/objects.mts';
import { loadObjShape, loadPdsPlanetocentricShape, loadPdsPlateShape, loadPdsRadiusTable, parseObjShape } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { surfaceDistanceIndex } from './surface-distance.mts';
import { loadImageDem } from '../../../../tools/objects/terrestrial-layers/image-dem.mts';
import { loadContactEllipsoids } from '../../../../tools/objects/terrestrial-layers/contact-ellipsoids.mts';

const output = resolve(process.argv[2] ?? 'output/comet-source-fit');
const selected = OBJECTS.filter(object => object.classification === 'comet' && (!process.argv[3] || object.id === process.argv[3]));
assert.ok(selected.length, 'Select a registered comet for source comparison.');
await mkdir(output, { recursive: true });
const reports = [];
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
for (const { id } of selected) {
  const root = resolve('src/objects', id);
  const profileFields = { path: text, format: text, grid: requireRecord };
  const config = shape({ presentation: shape({ defaultLens: text }), geometry: shape({ radiusKm: number, radius: number,
    radialTerrain: shape(profileFields), radialTerrainAlternatives: optional(array(shape({ ...profileFields, lensId: text }))) }) })(JSON.parse(await readFile(resolve(root, 'source/preparation/terrestrial.json'), 'utf8')));
  const lensId = process.argv[4];
  const alternative = lensId && lensId !== config.presentation.defaultLens
    ? config.geometry.radialTerrainAlternatives?.find(model => model.lensId === lensId) : null;
  if (lensId && lensId !== config.presentation.defaultLens) assert.ok(alternative, 'Select a declared surface model.');
  const profile = alternative ?? config.geometry.radialTerrain;
  const sourcePath = resolve(root, 'source', profile.path);
  const loaders = new Map<string, (path: string, grid: unknown) => Promise<SourceMesh>>([
    ['image-plane-dem', loadImageDem], ['contact-ellipsoids', loadContactEllipsoids], ['wavefront-obj', loadObjShape],
    ['pds-planetocentric-plate', loadPdsPlanetocentricShape], ['pds-plate-model', loadPdsPlateShape], ['pds-radius-table', loadPdsRadiusTable],
  ]);
  const loader = loaders.get(profile.format);
  assert.ok(loader, 'Source comparison requires a supported source mesh.');
  const source = await loader(sourcePath, profile.grid);
  const preparedPath = `prepared/terrain${alternative ? `-${lensId}` : ''}.json`;
  const preparedBytes = await readFile(resolve(root, preparedPath));
  const terrain = shape({faces:array(shape({vertices:array(array(number)),estimated:optional(boolean)}))})(JSON.parse(preparedBytes.toString('utf8')));
  const estimatedFaces = terrain.faces.filter(face => face.estimated).length;
  terrain.faces = terrain.faces.filter(face => !face.estimated);
  const meters = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const points = terrain.faces.flatMap(face => face.vertices.map(point => point.map(v => v * meters)));
  const obj = points.map(point => `v ${point.join(' ')}`).join('\n') + '\n' +
    terrain.faces.map((_, index) => `f ${index * 3 + 1} ${index * 3 + 2} ${index * 3 + 3}`).join('\n');
  const reduced = parseObjShape(obj, { metersPerUnit: 1, expectedVertices: points.length, expectedFaces: terrain.faces.length });
  const sourceDistance = surfaceDistanceIndex(source.positions, source.indices);
  const reducedDistance = surfaceDistanceIndex(reduced.positions, reduced.indices);
  const centerOf = (points: readonly (readonly number[])[]) => [0, 1, 2].map(i => points.reduce((sum, point) => sum + point[i], 0) / points.length);
  const originalSamples = [...source.positions, ...source.indices.map(face => centerOf(face.map(i => source.positions[i])))];
  const preparedSamples = reduced.indices.flatMap(face => {
    const points = face.map(i => reduced.positions[i]);
    return [centerOf(points), ...points.map((point, i) => centerOf([point, points[(i + 1) % 3]]))];
  });
  const surfaceDistances = {
    sourceToPrepared: { sampling: 'Every source vertex and source face centroid; unweighted by face area', ...stats(originalSamples.map(reducedDistance)) },
    preparedToSource: { sampling: 'Every prepared face centroid and its three edge midpoints; unweighted by face area', ...stats(preparedSamples.map(sourceDistance)) },
    interpretation: 'Euclidean closest-point distances in meters on finite sample sets. This is not an exhaustive Hausdorff bound or the uncertainty of the underlying observations.' };
  const [minimum, maximum] = source.bounds;
  const center = minimum.map((v, i) => (v + maximum[i]) / 2);
  const extent = maximum.map((v, i) => v - minimum[i]);
  const grid = 96, padding = 1.04, rays = [], errors = [];
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const horizontal = (axis + 1) % 3, vertical = (axis + 2) % 3;
    const direction = [0, 0, 0]; direction[axis] = -sign;
    let bothHit = 0, bothMiss = 0, sourceOnly = 0, reducedOnly = 0;
    const localErrors = []; let largestRangeDifference = null;
    for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
      const origin = [...center];
      origin[axis] += sign * Math.max(...extent) * 2;
      origin[horizontal] += ((x + .5) / grid - .5) * extent[horizontal] * padding;
      origin[vertical] += ((y + .5) / grid - .5) * extent[vertical] * padding;
      const original = source.intersect(origin, direction), prepared = reduced.intersect(origin, direction);
      if (original && prepared) {
        bothHit++; const difference = Math.abs(original.radius - prepared.radius); localErrors.push(difference);
        if (!largestRangeDifference || difference > largestRangeDifference.rangeDifferenceMeters) {
          const sourcePoint = origin.map((n, i) => n + direction[i] * original.radius);
          const preparedPoint = origin.map((n, i) => n + direction[i] * prepared.radius);
          largestRangeDifference = { gridCell: [x, y], rangeDifferenceMeters: difference, sourcePoint, preparedPoint,
            sourcePointToPreparedSurfaceMeters: reducedDistance(sourcePoint), preparedPointToSourceSurfaceMeters: sourceDistance(preparedPoint) };
        }
      }
      else if (original) sourceOnly++;
      else if (prepared) reducedOnly++;
      else bothMiss++;
    }
    errors.push(...localErrors);
    rays.push({ axis: 'xyz'[axis], viewingFromSign: sign, bothHit, bothMiss, sourceOnly, reducedOnly,
      rangeDifferenceMeters: stats(localErrors), largestRangeDifference });
  }
  assert.ok(errors.length > 0);
  const report = { id, ...(lensId ? { lensId } : {}), source: { path: profile.path, sha256: hash(await readFile(sourcePath)), vertices: source.vertices, faces: source.faces },
    prepared: { path: preparedPath, sha256: hash(preparedBytes), faces: terrain.faces.length, estimatedFacesExcluded: estimatedFaces },
    method: 'Six orthographic +/-XYZ views; first surface intersection from outside the source bounding box; pixel-centered regular grids',
    gridPerView: [grid, grid], boundingBoxPadding: padding, totalRays: grid * grid * 6,
    interpretation: 'Sampled line-of-sight range differences in meters, conditional on both meshes being hit. Silhouette disagreements are reported separately. These are not exhaustive geometric error bounds or observational uncertainties.',
    raySidedness: 'Two-sided geometry intersections; painted-side visibility and browser targeting are qualified separately.',
    sourceBoundsMeters: source.bounds, views: rays, rangeDifferenceMeters: stats(errors), surfaceDistances };
  await writeFile(resolve(output, `${id}.json`), JSON.stringify(report, null, 2) + '\n');
  reports.push(report);
  console.log(JSON.stringify({ id, rangeDifferenceMeters: report.rangeDifferenceMeters, surfaceDistances,
    sourceOnly: rays.reduce((sum, view) => sum + view.sourceOnly, 0), reducedOnly: rays.reduce((sum, view) => sum + view.reducedOnly, 0) }));
}
await writeFile(resolve(output, 'report.json'), JSON.stringify(reports, null, 2) + '\n');

function stats(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: sorted.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1) };
}
