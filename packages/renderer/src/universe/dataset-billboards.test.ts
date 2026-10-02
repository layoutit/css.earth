import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { mountDatasetBillboards, parseDatasetBillboards } from './dataset-billboards.js';

const input = {
  schema: 'cssearth-dataset-billboards@1', atlas: { columns: 2, rows: 2, cellPx: 256 },
  banks: [
    { id: 'nebula', contextVisibility: 'independent', attached: false,
      billboard: { cell: 3, radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] } },
    { id: 'galaxy', contextVisibility: 'galactic', attached: false },
  ],
};
const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
  metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };

test('prepared billboards carry every bank once, with an in-atlas cell and no hash', () => {
  const parsed = parseDatasetBillboards(input);
  assert.deepEqual(parsed.banks.get('galaxy'), { id: 'galaxy', contextVisibility: 'galactic', attached: false });
  assert.equal(parsed.banks.get('nebula')?.billboard?.cell, 3);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [...input.banks, input.banks[1]] }), /galaxy is listed twice/);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [{ ...input.banks[1], payloadSha256: 'a'.repeat(64) }] }), /unsupported dataset billboard bank field payloadSha256/);
  assert.throws(() => parseDatasetBillboards({ ...input, atlas: { ...input.atlas, sha256: 'a'.repeat(64) } }), /unsupported dataset billboard atlas field sha256/);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [{ ...input.banks[0], billboard: { ...input.banks[0]!.billboard, cell: 4 } }] }), /outside its atlas/);
  assert.throws(() => parseDatasetBillboards({ ...input, banks: [{ ...input.banks[1], attached: undefined }] }), /attached/);
});

test('a billboard waits for its shared atlas decode, then samples its cell and obeys visibility', () => {
  type Node = { tag: string; style: Record<string, string> & { cssText?: string }; dataset: Record<string, string>; children: Node[];
    insertBefore(child: Node, before: Node | null): void; remove(): void; parent: Node | null };
  const nodes: Node[] = [];
  const create = (tag: string) => {
    const node: Node = { tag, style: {} as Record<string, string>, dataset: {} as Record<string, string>, children: [], parent: null,
      insertBefore(child, before) { this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child); child.parent = this; },
      remove() { this.parent?.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } };
    nodes.push(node); return node;
  };
  const host = { ownerDocument: { createElement: create }, insertBefore() {} } as unknown as HTMLElement;
  const { atlas, banks } = parseDatasetBillboards(input);
  const prepareAtlas = mock.fn(() => false);
  const layer = mountDatasetBillboards({ host, before: null, atlasUrl: '/atlas.webp', atlas, prepareAtlas,
    entries: [{ id: 'nebula', frame, billboard: banks.get('nebula')!.billboard! }] });
  const leaf = nodes.find(node => node.dataset.datasetBillboard === 'nebula')!;
  // A billboard is in the document only while it shows.
  const attached = () => leaf.parent !== null;
  assert.equal(attached(), false);
  assert.ok(leaf.style.cssText?.includes('background-size:200% 200%;background-position:100% 100%'));
  assert.equal(leaf.style.backgroundImage, undefined);
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 400, heightPixels: 300 };
  const world = (orientationXyzw: readonly [number, number, number, number]) =>
    ({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10] as const, orientationXyzw } });
  layer.publish(0, 0, world([0, 0, 0, 1]), viewport);
  assert.equal(prepareAtlas.mock.callCount(), 0);
  layer.publish(0, 0.5, world([0, 0, 0, 1]), viewport);
  assert.equal(prepareAtlas.mock.callCount(), 1);
  assert.equal(leaf.style.backgroundImage, undefined);
  assert.equal(attached(), false);
  prepareAtlas.mock.mockImplementation(() => true);
  layer.setCoasting(true);
  layer.publish(0, 0.5, world([0, 0, 0, 1]), viewport);
  assert.equal(leaf.style.backgroundImage, undefined);
  layer.setCoasting(false);
  layer.publish(0, 0.5, world([0, 0, 0, 1]), viewport);
  // A fixed 128 px box (two texels per CSS pixel of a 256 px cell) scaled to the 20 px it projects to: the camera
  // changes only its transform (motion-freezes-membership.md).
  assert.partialDeepStrictEqual(leaf.style, { opacity: '0.5', backgroundImage: 'url("/atlas.webp")' }); assert.equal(attached(), true);
  assert.ok(leaf.style.cssText?.includes('width:128px;height:128px'));
  assert.ok(leaf.style.transform.includes(`scale(${20 / 128})`));
  // Seen off its prepared axis the one view still draws, turned toward the camera.
  layer.publish(0, 0.5, { ...world([0, 0, 0, 1]), pose: { positionM: [3, 0, 10] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport);
  assert.equal(attached(), true);
  layer.publish(0, 0.5, world([0, 1, 0, 0]), viewport);
  assert.equal(attached(), false);
  layer.publish(0, 0.5, world([0, 0, 0, 1]), viewport);
  assert.equal(attached(), true);
  layer.publish(0, 0, world([0, 0, 0, 1]), viewport);
  assert.equal(attached(), false);
});
