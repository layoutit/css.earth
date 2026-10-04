import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { mountDatasetBillboards } from './dataset-billboards.js';
import { parseDatasetBillboards } from '@cssearth/objects';

const input = {
  schema: 'cssearth-dataset-billboards@2', imagePx: 256,
  banks: [
    { id: 'nebula', contextVisibility: 'independent', attached: false,
      billboard: { radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] } },
    { id: 'galaxy', contextVisibility: 'galactic', attached: false },
  ],
};
const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
  metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };

test("a billboard waits for its own image's decode, then draws it and obeys visibility", () => {
  const nodes: { tag: string; style: Record<string, string> & { cssText?: string }; dataset: Record<string, string>; append(node: unknown): void }[] = [];
  const create = (tag: string) => {
    const node = { tag, style: {} as Record<string, string>, dataset: {} as Record<string, string>, children: [] as unknown[],
      append(child: unknown) { this.children.push(child); } };
    nodes.push(node); return node;
  };
  const host = { ownerDocument: { createElement: create }, insertBefore() {} } as unknown as HTMLElement;
  const { imagePx, banks } = parseDatasetBillboards(input);
  const prepareAtlas = mock.fn((_url: string) => false);
  const layer = mountDatasetBillboards({ host, before: null, imageUrl: id => `/billboards/${id}.webp`, imagePx, prepareImage: prepareAtlas,
    entries: [{ id: 'nebula', frame, billboard: banks.get('nebula')!.billboard! }] });
  const leaf = nodes.find(node => node.dataset.datasetBillboard === 'nebula')!;
  // The leaf draws a whole image of its own: no cell of a shared atlas is positioned inline.
  assert.equal(leaf.style.cssText, 'width:128px;height:128px;display:none');
  assert.equal(leaf.style.backgroundImage, undefined);
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 400, heightPixels: 300 };
  const world = (orientationXyzw: readonly [number, number, number, number]) =>
    ({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10] as const, orientationXyzw } });
  layer.publish(0, 0, world([0, 0, 0, 1]), viewport);
  assert.equal(prepareAtlas.mock.callCount(), 0);
  layer.publish(0, 0.5, world([0, 0, 0, 1]), viewport);
  assert.equal(prepareAtlas.mock.callCount(), 1);
  assert.deepEqual(prepareAtlas.mock.calls[0]!.arguments, ['/billboards/nebula.webp']);
  assert.equal(leaf.style.backgroundImage, undefined);
  assert.notEqual(leaf.style.display, 'block');
  prepareAtlas.mock.mockImplementation(() => true);
  layer.setCoasting(true);
  layer.publish(0, 0.5, world([0, 0, 0, 1]), viewport);
  assert.equal(leaf.style.backgroundImage, undefined);
  layer.setCoasting(false);
  layer.publish(0, 0.5, world([0, 0, 0, 1]), viewport);
  // A fixed 128 px box (two texels per CSS pixel of a 256 px image) scaled to the 20 px it projects to: the camera
  // changes only its transform (motion-freezes-membership.md).
  assert.partialDeepStrictEqual(leaf.style, { display: 'block', opacity: '0.5', backgroundImage: 'url("/billboards/nebula.webp")' });
  assert.ok(leaf.style.cssText?.includes('width:128px;height:128px'));
  assert.ok(leaf.style.transform.includes(`scale(${20 / 128})`));
  // Seen off its prepared axis the one view still draws, turned toward the camera.
  layer.publish(0, 0.5, { ...world([0, 0, 0, 1]), pose: { positionM: [3, 0, 10] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport);
  assert.equal(leaf.style.display, 'block');
  layer.publish(0, 0.5, world([0, 1, 0, 0]), viewport);
  assert.equal(leaf.style.display, 'none');
  layer.publish(0, 0.5, world([0, 0, 0, 1]), viewport);
  layer.publish(0, 0, world([0, 0, 0, 1]), viewport);
  assert.equal(leaf.style.display, 'none');
});
