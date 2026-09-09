import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { prepareReconstructionStars, type ReconstructionStarsInput } from './reconstruction-stars.js';
import { parsePreparedLmcStars, mountPreparedLmcStars, type PreparedLmcStars } from '../stars/lmc-stars.js';

const path = 'labs/nebula/models/lmc/stars/prepared/stars.json';
const cloudPath = 'labs/nebula/models/lmc/clouds/object.json';
async function fixture() {
  const bytes = await readFile(path), catalogue = JSON.parse(bytes.toString()) as PreparedLmcStars, cloudBytes = await readFile(cloudPath);
  const input: ReconstructionStarsInput = {
    frame: catalogue.frame, source: { path, sha256: createHash('sha256').update(bytes).digest('hex') },
    canonicalCloud: { path: cloudPath, sha256: createHash('sha256').update(cloudBytes).digest('hex') },
  };
  return { catalogue, input };
}

test('all 943 accepted-cloud stars retain exact XYZ, observed astrometry, photometry and cloudSignal across image variants', async () => {
  const { catalogue, input } = await fixture(), before = structuredClone(catalogue);
  const result = prepareReconstructionStars(catalogue, input)!;
  parsePreparedLmcStars(result, catalogue.frame);
  const expected = catalogue.stars;
  assert.equal(expected.length, 943);
  assert.deepEqual(result.stars.map(star => star.id), expected.map(star => star.id));
  result.stars.forEach((star, index) => {
    const previous = expected[index];
    assert.deepEqual(star, { ...previous, cloudPartIds: ['all-light'] });
    assert.notEqual(star.positionUnits, previous.positionUnits);
  });
  assert.deepEqual(catalogue, before);
  assert.deepEqual((result.provenance as any).inheritedCatalogue, input.source);
  assert.deepEqual((result.provenance as any).inheritedProvenance, catalogue.provenance);
  assert.deepEqual((result.provenance as any).canonicalCloud, input.canonicalCloud);
  assert.equal((result.provenance as any).excludedStars, 0);
  assert.match(result.depthAssumption, /No new stellar distances/);
  // Neither differing image bytes nor image dimensions enter this API.
  assert.deepEqual(prepareReconstructionStars(catalogue, input), result);
  assert.match((result.provenance as any).support, /No image/);
  // Preserving old image-derived part membership would disable the new star layer.
  assert.throws(() => assert.deepEqual(catalogue.stars[0].cloudPartIds, ['all-light']));
});

test('wrong cloud identity and image/resampling inputs reject instead of filtering the accepted catalogue', async () => {
  const { catalogue, input } = await fixture();
  assert.throws(() => prepareReconstructionStars(catalogue, { ...input,
    canonicalCloud: { ...input.canonicalCloud, sha256: 'a'.repeat(64) } }), /Canonical cloud differs/);
  const changed = structuredClone(catalogue); delete (changed.provenance as any).depthModel.cloudObject;
  assert.throws(() => prepareReconstructionStars(changed, input), /Canonical cloud differs/);
  // Historical path aliases do not alter the verified object identity.
  const aliased = prepareReconstructionStars(catalogue, { ...input,
    canonicalCloud: { ...input.canonicalCloud, path: 'labs/nebula/models/lmc-clouds/object.json' } });
  assert.deepEqual(aliased.stars, prepareReconstructionStars(catalogue, input).stars);
  for (const additional of [{ imageId: 'any-image' }, { sampleDensity: () => 0 }, { sampleProjectedDensitySignal: () => .5 }])
    assert.throws(() => prepareReconstructionStars(catalogue, { ...input, ...additional } as ReconstructionStarsInput), /not image or density resampling/);
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
test('all-light membership supports the existing retained star toggle and signal cutoff', async () => {
  const { catalogue, input } = await fixture(), payload = prepareReconstructionStars(catalogue, input)!;
  const host = new Element(), layer = mountPreparedLmcStars({ host: host as unknown as HTMLElement, payload });
  const root = host.children[0], nodes = [...root.children];
  layer.setVisible(false); assert.equal(root.style.display, 'none');
  layer.setVisible(true); assert.equal(root.style.display, 'block');
  layer.setCloudSupport({ cutoff: .5, softness: 0, showRemoved: false }, ['all-light']);
  payload.stars.forEach((star, i) => assert.equal(Number(nodes[i].style.opacity), star.cloudSignal > .5 ? star.opacity : 0));
  assert.ok(nodes.some(node => Number(node.style.opacity) > 0));
  assert.ok(nodes.some(node => Number(node.style.opacity) === 0));
  layer.setCloudSupport({ cutoff: 0, softness: 0, showRemoved: false }, []);
  assert.ok(nodes.every(node => Number(node.style.opacity) === 0));
  assert.deepEqual(root.children, nodes);
});
