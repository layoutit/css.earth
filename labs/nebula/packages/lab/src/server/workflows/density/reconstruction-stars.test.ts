import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { prepareReconstructionStars, type ReconstructionStarsInput } from './reconstruction-stars.ts';
import { mountPreparedLmcStars, type PreparedLmcStars } from '@cssearth/nebula-lab/adapters/viewer/catalogue-stars';
import { loadVolumeSource, sampleEncoded } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { sha256 } from '@cssearth/core/node';
import { prepareDensityProjection } from './density-projection.ts';

const path = 'labs/nebula/models/lmc/stars/prepared/stars.json';
const cloudPath = 'labs/nebula/models/lmc/full-density/object.json';
const referencePath = 'labs/nebula/models/lmc/stars/source/alignment.json';
const close = (a: number, b: number, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const fixturePromise = (async () => {
  const bytes = await readFile(path), catalogue = JSON.parse(bytes.toString()) as PreparedLmcStars;
  const referenceBytes = await readFile(referencePath), reference = JSON.parse(referenceBytes.toString());
  const overlay = reference.overlay;
  const recipe = JSON.parse(await readFile('labs/nebula/models/lmc/full-density/source/volume.json', 'utf8'));
  const densitySource = await loadVolumeSource('labs/nebula/models/lmc/full-density/source', recipe);
  const projection = prepareDensityProjection(densitySource, Math.hypot(...catalogue.frame.originM) / catalogue.frame.metersPerUnit);
  const input: ReconstructionStarsInput = { frame: catalogue.frame, source: { path },
    canonicalCloud: { path: cloudPath }, densitySource,
    reference: { wcs: (catalogue.provenance as any).footprint.wcs, alignment: { ...overlay, placement: overlay.initialPlacement },
      provenancePin: { path: referencePath } }, sampleProjectedDensitySignal: projection.sampleSignal };
  return { catalogue, input, projection, overlay };
})();

test('all 943 stars follow the fixed reference-image fit and occupy the unchanged source density', async () => {
  const { catalogue, input, projection, overlay } = await fixturePromise, before = structuredClone(catalogue);
  const gridBefore = sha256(input.densitySource.encodedRgba), result = prepareReconstructionStars(catalogue, input);
  assert.equal(result.stars.length, 943); assert.deepEqual(catalogue, before);
  assert.equal(sha256(input.densitySource.encodedRgba), gridBefore);
  const m = overlay.style.transform.slice(9, -1).split(',').map(Number), w = input.reference.wcs;
  const rad = Math.PI / 180, [a0, d0] = w.referenceValueDeg.map(v => v * rad), angle = w.rotationDeg * rad;
  const distance = Math.hypot(...input.frame.originM) / input.frame.metersPerUnit, encoded: [number, number, number, number] = [0, 0, 0, 0];
  let moved = 0;
  result.stars.forEach((star, i) => {
    const old = catalogue.stars[i];
    assert.deepEqual({ ...star, positionUnits: old.positionUnits, cloudSignal: old.cloudSignal, cloudPartIds: old.cloudPartIds }, old);
    sampleEncoded(input.densitySource, ...star.positionUnits, encoded); assert.ok(encoded[3] > 0, `${star.id} escaped density`);
    close(star.cloudSignal, projection.sampleSignal(...star.positionUnits), 1e-12);
    assert.deepEqual(star.cloudPartIds, ['all-light']);
    // Independent spherical TAN inverse, then point-wise CSS scale/rotation/offset.
    // This does not use either mapping helper that prepares the catalogue.
    const a = star.raDeg * rad, d = star.decDeg * rad;
    const den = Math.sin(d) * Math.sin(d0) + Math.cos(d) * Math.cos(d0) * Math.cos(a - a0);
    const east = Math.cos(d) * Math.sin(a - a0) / den;
    const north = (Math.sin(d) * Math.cos(d0) - Math.cos(d) * Math.sin(d0) * Math.cos(a - a0)) / den;
    const fx = w.referencePixel[0] + (Math.cos(angle) * east + Math.sin(angle) * north) / (w.scaleDeg[0] * rad);
    const fy = w.referencePixel[1] + (-Math.sin(angle) * east + Math.cos(angle) * north) / (w.scaleDeg[1] * rad);
    const u = (fx - .5) / w.referenceDimension[0], v = 1 - (fy - .5) / w.referenceDimension[1];
    const x = u * overlay.widthPx, y = v * overlay.heightPx, divisor = m[3] * x + m[7] * y + m[15];
    const p = [0, 1, 2].map(c => (m[c] * x + m[c + 4] * y + m[c + 12]) / divisor);
    const fit = overlay.initialPlacement, zAngle = fit.rotationZ * rad;
    const cx = (p[0] - overlay.pivotCssPx[0]) * fit.scale, cy = (p[1] - overlay.pivotCssPx[1]) * fit.scale;
    const fittedX = Math.cos(zAngle) * cx - Math.sin(zAngle) * cy + overlay.pivotCssPx[0] + fit.x * 50;
    const fittedY = Math.sin(zAngle) * cx + Math.cos(zAngle) * cy + overlay.pivotCssPx[1] + fit.y * 50;
    const factor = 1 + star.positionUnits[2] / distance;
    close(star.positionUnits[0] / factor, fittedY / 50);
    close(star.positionUnits[1] / factor, fittedX / 50);
    if (Math.hypot(...star.positionUnits.map((value, j) => value - old.positionUnits[j])) > .1) moved++;
  });
  assert.ok(moved > 900, 'Old unregistered positions must not survive the accepted3x/39° fit.');
  assert.deepEqual(prepareReconstructionStars(catalogue, input), result, 'Every candidate receives the identical common stellar realization.');
  assert.equal((result.provenance as any).excludedStars, 0);
  assert.equal((result.provenance as any).belowProjectionQuantization, 1);
});

test('wrong reference/density, unsupported model rays and candidate-image inputs reject instead of placing or filtering stars', async () => {
  const { catalogue, input } = await fixturePromise;
  assert.throws(() => prepareReconstructionStars(catalogue, { ...input, reference: { ...input.reference,
    wcs: { ...input.reference.wcs, rotationDeg: input.reference.wcs.rotationDeg + 5 } } }), /original catalogue image footprint/);
  assert.throws(() => prepareReconstructionStars(catalogue, { ...input, reference: { ...input.reference, alignment: { ...input.reference.alignment,
    placement: { ...input.reference.alignment.placement, x: 1000 } } } }), /Cannot place 943\/943/);
  assert.throws(() => prepareReconstructionStars(catalogue, { ...input, sampleProjectedDensitySignal: () => NaN }), /Cannot place 943\/943/);
  assert.throws(() => prepareReconstructionStars(catalogue, { ...input, imageId: 'candidate' } as ReconstructionStarsInput), /not candidate image inputs/);
  assert.throws(() => prepareReconstructionStars(catalogue, { ...input,
    frame: { ...input.frame, metersPerUnit: input.frame.metersPerUnit * 3 } }), /different physical frames/);
});

class Element {
  style: any = {}; dataset: any = {}; children: Element[] = [];
  ownerDocument = { createElement: () => new Element() };
  insertBefore(node: Element) { this.children.push(node); }
  append(node: Element) { this.children.push(node); }
  remove() {}
}
test('the common density signal and all-light membership retain star toggle and cutoff behavior', async () => {
  const { catalogue, input } = await fixturePromise, payload = prepareReconstructionStars(catalogue, input);
  const host = new Element(), layer = mountPreparedLmcStars({ host: host as unknown as HTMLElement, payload });
  const root = host.children[0], nodes = [...root.children];
  layer.setVisible(false); assert.equal(root.style.display, 'none'); layer.setVisible(true); assert.equal(root.style.display, 'block');
  const cutoff = [...payload.stars].sort((a, b) => a.cloudSignal - b.cloudSignal)[471].cloudSignal;
  layer.setCloudSupport({ cutoff, softness: 0, showRemoved: false }, ['all-light']);
  payload.stars.forEach((star, i) => assert.equal(Number(nodes[i].style.opacity), star.cloudSignal >= cutoff ? star.opacity : 0));
  assert.ok(nodes.some(node => Number(node.style.opacity) > 0)); assert.ok(nodes.some(node => Number(node.style.opacity) === 0));
  layer.setCloudSupport({ cutoff: 0, softness: 0, showRemoved: false }, ['all-light']);
  assert.ok(nodes.every((node, i) => Number(node.style.opacity) === payload.stars[i].opacity), 'A zero projected byte cannot remove a physically supported star at cutoff0.');
  layer.setCloudSupport({ cutoff: 0, softness: 0, showRemoved: false }, []);
  assert.ok(nodes.every(node => Number(node.style.opacity) === 0)); assert.deepEqual(root.children, nodes);
});
