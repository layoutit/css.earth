import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { prepareReconstructionStars, type ReconstructionStarsInput } from './reconstruction-stars.js';
import { parsePreparedLmcStars, mountPreparedLmcStars, type PreparedLmcStars } from '../stars/lmc-stars.js';

const path = 'labs/nebula/models/lmc/stars/prepared/stars.json';
async function fixture() {
  const bytes = await readFile(path), catalogue = JSON.parse(bytes.toString()) as PreparedLmcStars;
  const input: ReconstructionStarsInput = {
    frame: catalogue.frame, source: { path, sha256: createHash('sha256').update(bytes).digest('hex') },
    sampleDensity() { return .2; },
    sampleProjectedDensitySignal(_x, y) { return y > 0 ? .75 : .25; },
  };
  return { catalogue, input };
}

test('all 943 density stars retain exact positions and photometry independently of image variants', async () => {
  const { catalogue, input } = await fixture(), before = structuredClone(catalogue);
  const result = prepareReconstructionStars(catalogue, input)!;
  parsePreparedLmcStars(result, catalogue.frame);
  const expected = catalogue.stars;
  assert.equal(expected.length, 943);
  assert.deepEqual(result.stars.map(star => star.id), expected.map(star => star.id));
  result.stars.forEach((star, index) => {
    const previous = expected[index];
    assert.deepEqual(star, { ...previous, cloudSignal: previous.positionUnits[1] > 0 ? .75 : .25, cloudPartIds: ['all-light'] });
    assert.notEqual(star.positionUnits, previous.positionUnits);
  });
  assert.deepEqual(catalogue, before);
  assert.deepEqual((result.provenance as any).inheritedCatalogue, input.source);
  assert.deepEqual((result.provenance as any).inheritedProvenance, catalogue.provenance);
  assert.match(result.depthAssumption, /No new stellar distances/);
  // Neither differing image bytes nor image dimensions enter this API.
  assert.deepEqual(prepareReconstructionStars(catalogue, input), result);
  assert.match((result.provenance as any).support, /No image/);
  // Preserving old image-derived part membership would disable the new star layer.
  assert.throws(() => assert.deepEqual(catalogue.stars[0].cloudPartIds, ['all-light']));
});

test('only missing density support excludes stars; invalid density signals and incompatible frames fail', async () => {
  const { catalogue, input } = await fixture();
  const supported = prepareReconstructionStars(catalogue, { ...input, sampleDensity: x => x > 0 ? .2 : 0 });
  assert.deepEqual(supported.stars.map(star => star.id), catalogue.stars.filter(star => star.positionUnits[0] > 0).map(star => star.id));
  assert.throws(() => prepareReconstructionStars(catalogue, { ...input, sampleDensity: () => 0 }), /No catalogue stars/);
  for (const value of [NaN, Infinity, -.1, 0, 1.1])
    assert.throws(() => prepareReconstructionStars(catalogue, { ...input, sampleProjectedDensitySignal: () => value }), /normalized/);
  assert.throws(() => prepareReconstructionStars(catalogue, { ...input, sampleDensity: () => NaN }), /density/);
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
