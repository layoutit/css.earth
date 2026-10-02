import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { imageLayerAxisWeights, mountPreparedCssImageLayers } from './prepared-image-layer-runtime.js';
import type { PreparedCssImageLayers, PreparedImageLayerView } from './loader.js';
import { readout } from '../rendering/readouts.js';

const views: readonly PreparedImageLayerView[] = [
  { axis: 'x', normalUnits: [1, 0, 0], samplingStepUnits: 1 },
  { axis: 'y', normalUnits: [0, 1, 0], samplingStepUnits: 1 },
  { axis: 'z', normalUnits: [0, 0, 1], samplingStepUnits: 1 },
];

test('image banks keep an active, normalized non-edge-on projection through a complete turn', () => {
  for (let degrees = 0; degrees <= 360; degrees++) {
    const angle = degrees * Math.PI / 360;
    const weights = imageLayerAxisWeights([Math.sin(angle), 0, 0, Math.cos(angle)], views);
    assert.ok(Math.abs((weights.x + weights.y + weights.z) - (1)) < 10 ** -12 / 2, `${(weights.x + weights.y + weights.z)} is not close to ${1}`);
    assert.ok(Math.max(weights.x, weights.y, weights.z) >= .5);
  }
  assert.deepEqual(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], views), { x: 0, y: 1, z: 0 });
});
test('selection follows baked plane normals and sample density instead of bank names', () => {
  const tilted = views.map(view => view.axis === 'z' ? { ...view, normalUnits: [0, 1, 0] as const } : view);
  assert.ok(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], tilted).z > 0);
  const dense = tilted.map(view => view.axis === 'z' ? { ...view, samplingStepUnits: .1 } : view);
  assert.deepEqual(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], dense), { x: 0, y: 0, z: 1 });
});


// Retained DOM stand-in: exercise resource demand without browser image fetching.
class ImageElement {
  readonly children: ImageElement[] = [];
  readonly style: Record<string, string> = {};
  readonly dataset: Record<string, string> = {};
  className = '';
  removed = false;
  parentNode: ImageElement | null = null;
  readonly ownerDocument: ImageDocument;
  constructor(ownerDocument: ImageDocument) { this.ownerDocument = ownerDocument; }
  appendChild(child: ImageElement) { this.children.push(child); child.parentNode = this; }
  insertBefore(child: ImageElement, before: ImageElement | null) {
    this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child); child.parentNode = this;
  }
  remove() {
    this.removed = true;
    if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  }
}
class ImageDocument {
  readonly elements: ImageElement[] = [];
  createElement() { const element = new ImageElement(this); this.elements.push(element); return element; }
}

test('image textures are demanded once when their retained axis first contributes', () => {
  const document = new ImageDocument(), host = document.createElement(), before = document.createElement();
  host.appendChild(before);
  const payload: PreparedCssImageLayers = {
    schema: 'cssearth-css-volume@1', id: 'fixture',
    frame: { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    anchors: [], bankViews: views,
    stacks: views.map(({ axis }) => ({ axis, leaves: [{ id: axis, centerUnits: [0, 0, 0], texturePath: `${axis}.png`,
      widthPx: 1, heightPx: 1, style: { width: '1px', height: '1px', transform: 'translate3d(0,0,0)', backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })),
    resources: views.map(({ axis }) => ({ path: `${axis}.png`, bytes: 1, width: 1, height: 1 })),
    provenance: {}, approximation: {},
  };
  const resolveResource = mock.fn((path: string) => `/prepared/${path}`);
  const runtime = mountPreparedCssImageLayers({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resolveResource });
  const retained = [...document.elements];
  const leaf = (axis: string) => document.elements.find(element => readout(element, 'imageLayerLeaf') === axis)!;
  const bank = (axis: string) => document.elements.find(element => element.dataset.imageLayerAxis === axis)!;
  const publish = (orientationXyzw: readonly [number, number, number, number]) => runtime.publish({
    world: { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM: [0, 0, 10], orientationXyzw } },
    viewport: { focalPixels: 600, principalOffsetPixels: [0, 0] },
  });
  assert.equal(resolveResource.mock.callCount(), 0);
  for (const { axis } of views) assert.equal(leaf(axis).style.backgroundImage, undefined);
  publish([0, 0, 0, 1]);
  assert.deepEqual(resolveResource.mock.calls.map(call => call.arguments), [['z.png']]);
  assert.equal(leaf('z').style.backgroundImage, 'url("/prepared/z.png")');
  assert.equal(leaf('x').style.backgroundImage, undefined);
  assert.equal(leaf('y').style.backgroundImage, undefined);
  // Only a contributing axis is in the document.
  assert.equal(bank('z').style.visibility, 'visible');
  assert.deepEqual(['x', 'y', 'z'].map(axis => bank(axis).parentNode !== null), [false, false, true]);
  publish([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  assert.deepEqual(resolveResource.mock.calls.map(call => call.arguments), [['z.png'], ['y.png']]);
  assert.deepEqual(['x', 'y', 'z'].map(axis => bank(axis).parentNode !== null), [false, true, false]);
  assert.equal(bank('y').style.visibility, 'visible');
  publish([0, 0, 0, 1]);
  assert.equal(resolveResource.mock.callCount(), 2);
  assert.deepEqual(document.elements, retained);
  runtime.destroy();
  publish([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  assert.equal(resolveResource.mock.callCount(), 2);
});
