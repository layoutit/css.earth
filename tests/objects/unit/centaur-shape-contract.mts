import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BASE_TILE } from '@layoutit/polycss';

// Independent published semiaxes, not read back from the authored inputs.
const sourceAxes = { chariklo: [143.8, 135.2, 99.1], bienor: [127, 55, 45] };
export async function checkShape(id: keyof typeof sourceAxes) {
  const root = `src/planets/${id}`;
  const read = async (path: string) => JSON.parse(await readFile(`${root}/${path}`, 'utf8'));
  const scene = await read('prepared/scene.json');
  const config = await read('source/preparation/terrestrial.json');
  const measurements = await read('source/measurements.json');
  const controls = await read('prepared/controls.json');
  const axes = sourceAxes[id];
  assert.deepEqual(measurements.constraints.semiAxesKm, axes);
  assert.equal(scene.surfaceTriangles.length, 480);
  assert.equal(scene.bodyLeaves.length, 480);
  assert.ok(scene.bodyLeaves.every((leaf: { tag: string; }) => leaf.tag === 'u'));
  const ratio = config.geometry.radiusKm / (config.geometry.radius * BASE_TILE);
  const km = (point: number[]) => [point[1] * ratio, point[0] * ratio, point[2] * ratio];
  const points = scene.surfaceTriangles.flatMap((triangle: number[][]) => {
    const v = triangle.map(km);
    return [...v, [0, 1, 2].map(axis => v.reduce((sum, p) => sum + p[axis], 0) / 3)];
  });
  const residuals = points.map((p:number[]) => Math.abs(Math.sqrt(p.reduce((sum: number, x: number, axis: number) => sum + (x / axes[axis]) ** 2, 0)) - 1));
  const maximumEllipsoidResidual = Math.max(...residuals);
  assert.ok(maximumEllipsoidResidual < .04, `Simplified surface departs from the source ellipsoid: ${maximumEllipsoidResidual}`);
  const extentsKm = [0, 1, 2].map(axis => Math.max(...points.map((p: number[]) => Math.abs(p[axis]))));
  extentsKm.forEach((value, axis) => assert.ok(Math.abs(value / axes[axis] - 1) < .035));
  for (const name of ['shadows', 'orbit']) assert.equal(controls.settings.controls.find((c: { name: string; }) => c.name === name).checked, false);
  if (id === 'chariklo') {
    assert.equal(scene.rings.coverage.sourceFaceCount, 256);
    assert.equal(scene.rings.leaves.length, 16);
    assert.ok(Math.abs(config.rings.bands[0].outerRadiusKm - config.rings.bands[0].innerRadiusKm - 7.04) < 1e-10);
    assert.ok(Math.abs(config.rings.bands[1].outerRadiusKm - config.rings.bands[1].innerRadiusKm - 1.009) < 1e-10);
    assert.equal(config.rings.bands[1].displayOpacity, .048);
    const ringRadiiKm = scene.rings.coverage.sourceFaces.flatMap((face: { vertices: number[][]; }) => face.vertices.map((v: number[]) => Math.hypot(v[0], v[1]) * ratio));
    assert.ok(Math.abs(Math.max(...ringRadiiKm) - 400.8045) < .03);
    assert.ok(Math.abs(Math.min(...ringRadiiKm) - 382.38) < .03);
    const rotation = await read('source/preparation/rotation.json');
    assert.equal(rotation.rightAscensionDegrees, 151.03);
    assert.equal(rotation.declinationDegrees, 41.81);
  } else assert.equal(scene.rings, undefined);
  return { id, triangles: scene.surfaceTriangles.length, samples: points.length, maximumEllipsoidResidual,
    extentsKm, ringTiles: scene.rings?.leaves.length ?? 0, defaultShadows: false, defaultOrbit: false };
}
