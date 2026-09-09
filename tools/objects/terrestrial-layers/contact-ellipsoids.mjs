import { readFile } from 'node:fs/promises';
import { parseObjShape } from './obj-shape.mjs';

/** Tessellate published contact-body parameters. This is an inferred model,
 * never recovered terrain. X joins the lobe centres; Z is the spin axis.
 * The equal-density volume centroid is a declared modelling origin. */
export function contactEllipsoidMesh(model) {
  if (model.schema !== 'cssearth-contact-ellipsoids@1' ||
      model.origin !== 'equal-density-volume-centroid' ||
      !Array.isArray(model.lobes) || model.lobes.length !== 2 ||
      model.lobes.some(lobe => !Array.isArray(lobe.semiaxesKm) || lobe.semiaxesKm.length !== 3 ||
        lobe.semiaxesKm.some(n => !Number.isFinite(n) || n <= 0)) ||
      !Number.isFinite(model.fluxScale) || model.fluxScale <= 0 ||
      !Number.isInteger(model.subdivisions) || model.subdivisions < 1 || model.subdivisions > 5) {
    throw new TypeError('Invalid published contact-ellipsoid model.');
  }
  // Flux scales with area: dimensions scale with sqrt(gamma), not gamma.
  const axes = model.lobes.map(lobe => lobe.semiaxesKm.map(n => n * 1000 * Math.sqrt(model.fluxScale)));
  const volumeWeights = axes.map(a => a.reduce((p, n) => p * n, 1));
  const separation = axes[0][0] + axes[1][0];
  const centers = [-separation * volumeWeights[1] / (volumeWeights[0] + volumeWeights[1]),
    separation * volumeWeights[0] / (volumeWeights[0] + volumeWeights[1])];
  let unit = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  let faces = [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
  for (let level = 0; level < model.subdivisions; level++) {
    const mids = new Map();
    const midpoint = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!mids.has(key)) {
        const v = unit[a].map((n, i) => n + unit[b][i]), length = Math.hypot(...v);
        mids.set(key, unit.length); unit.push(v.map(n => n / length));
      }
      return mids.get(key);
    };
    faces = faces.flatMap(([a,b,c]) => {
      const ab = midpoint(a,b), bc = midpoint(b,c), ca = midpoint(c,a);
      return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];
    });
  }
  const positions = axes.flatMap((a, lobe) => unit.map(v =>
    v.map((n, i) => n * a[i] + (i === 0 ? centers[lobe] : 0))));
  const indices = [...faces, ...faces.map(f => f.map(i => i + unit.length))];
  return { positions, indices, axesMeters: axes, centersMeters: centers,
    contactXMeters: centers[0] + axes[0][0] };
}

export async function loadContactEllipsoids(path, profile) {
  if (profile.metersPerUnit !== 1) throw new TypeError('Contact-model coordinates are prepared in metres.');
  const mesh = contactEllipsoidMesh(JSON.parse(await readFile(path, 'utf8')));
  const text = [...mesh.positions.map(v => `v ${v.join(' ')}`),
    ...mesh.indices.map(f => `f ${f.map(i => i + 1).join(' ')}`)].join('\n');
  // Retain full connectivity through the shared source-mesh route. Radial
  // previews do not replace the concave surface or the point of contact.
  return { ...parseObjShape(text, { ...profile, metersPerUnit: 1 }),
    lockedPositions: [[mesh.contactXMeters, 0, 0]] };

}
