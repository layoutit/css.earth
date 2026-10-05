import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { imageLayerAxisWeights, mountPreparedCssImageLayers } from './prepared-image-layer-runtime.js';
import type { PreparedCssImageLayers, PreparedImageLayerView } from '@cssearth/objects';

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
  readonly ownerDocument: ImageDocument;
  constructor(ownerDocument: ImageDocument) { this.ownerDocument = ownerDocument; }
  appendChild(child: ImageElement) { this.children.push(child); }
  insertBefore(child: ImageElement, before: ImageElement) { this.children.splice(this.children.indexOf(before), 0, child); }
  remove() { this.removed = true; }
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
  const leaf = (axis: string) => document.elements.find(element => element.dataset.imageLayerLeaf === axis)!;
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
  assert.equal(bank('z').style.visibility, 'visible');
  // A bank alone in the mix stays just under opaque: its opacity never crosses 1.
  assert.equal(bank('z').style.opacity, '0.999');
  assert.equal(bank('y').style.display, 'none');
  publish([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  assert.deepEqual(resolveResource.mock.calls.map(call => call.arguments), [['z.png'], ['y.png']]);
  assert.equal(bank('z').style.display, 'none');
  assert.equal(bank('y').style.visibility, 'visible');
  publish([0, 0, 0, 1]);
  assert.equal(resolveResource.mock.callCount(), 2);
  assert.deepEqual(document.elements, retained);
  runtime.destroy();
  publish([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  assert.equal(resolveResource.mock.callCount(), 2);
});

test('a stack coming into the drawing stays hidden until its images are decoded, and one that left first never shows', async () => {
  // Each decode is held until the test settles it: the document's Image is what the runtime asks.
  const waiting: { src: string; settle(): void }[] = [];
  class HeldImage { src = ''; decode() { return new Promise<void>(settle => { waiting.push({ src: this.src, settle }); }); } }
  const document = Object.assign(new ImageDocument(), { defaultView: { Image: HeldImage } }), host = document.createElement(), before = document.createElement();
  host.appendChild(before);
  const style = { width: '1px', height: '1px', transform: 'translate3d(0,0,0)', backgroundSize: '1px 1px', backgroundPosition: '0px 0px' };
  const payload: PreparedCssImageLayers = {
    schema: 'cssearth-css-volume@1', id: 'fixture',
    frame: { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    anchors: [], bankViews: views,
    stacks: views.map(({ axis }) => ({ axis, leaves: ['a', 'b'].map(id => ({ id: `${axis}-${id}`, centerUnits: [0, 0, 0] as [number, number, number], texturePath: `${axis}.png`, widthPx: 1, heightPx: 1, style })) })),
    resources: views.map(({ axis }) => ({ path: `${axis}.png`, bytes: 1, width: 1, height: 1 })),
    provenance: {}, approximation: {},
  };
  const runtime = mountPreparedCssImageLayers({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resolveResource: path => `/prepared/${path}` });
  const bank = (axis: string) => document.elements.find(element => element.dataset.imageLayerAxis === axis)!;
  const publish = (orientationXyzw: readonly [number, number, number, number]) => runtime.publish({
    world: { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM: [0, 0, 10], orientationXyzw } },
    viewport: { focalPixels: 600, principalOffsetPixels: [0, 0] },
  });
  const settle = async () => { for (const each of waiting.splice(0)) each.settle(); await new Promise(done => setTimeout(done, 0)); };
  publish([0, 0, 0, 1]);
  // In the drawing, its images on its leaves and one decode asked for each image, but not painted yet.
  assert.deepEqual([bank('z').style.display, bank('z').style.visibility, waiting.map(each => each.src)], ['', 'hidden', ['/prepared/z.png']]);
  publish([0, 0, 0, 1]);
  assert.equal(bank('z').style.visibility, 'hidden', 'a later frame does not show it early');
  await settle();
  assert.equal(bank('z').style.visibility, 'visible');
  // Turned to another stack and away again before its images are ready: its late decode shows nothing.
  publish([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  assert.deepEqual([bank('y').style.visibility, waiting.map(each => each.src)], ['hidden', ['/prepared/y.png']]);
  publish([0, 0, 0, 1]);
  assert.deepEqual([bank('y').style.display, bank('z').style.visibility], ['none', 'hidden'], 'the stack turned back to waits for its own decode again');
  const late = waiting.splice(0, 1);
  for (const each of late) each.settle();
  await new Promise(done => setTimeout(done, 0));
  assert.equal(bank('y').style.visibility, 'hidden');
  await settle();
  assert.equal(bank('z').style.visibility, 'visible');
  // The bank root shown again: the stack it draws waits once more.
  runtime.resume();
  publish([0, 0, 0, 1]);
  assert.equal(bank('z').style.visibility, 'hidden');
  await settle();
  assert.equal(bank('z').style.visibility, 'visible');
});

test('around a body, a sheet within one sampling step of the camera is left out, by its prepared corners, and draws again farther away', () => {
  const document = new ImageDocument(), host = document.createElement(), before = document.createElement();
  host.appendChild(before);
  const style = { width: '1px', height: '1px', transform: 'translate3d(0,0,0)', backgroundSize: '1px 1px', backgroundPosition: '0px 0px' };
  type Corner = [number, number, number];
  const sheet = (id: string, z: number) => ({ id, centerUnits: [0, 0, z] as Corner, texturePath: 'atlas.png', widthPx: 1, heightPx: 1, style,
    verticesUnits: [[-1, -1, z], [1, -1, z], [1, 1, z], [-1, 1, z]] as [Corner, Corner, Corner, Corner] });
  const payload: PreparedCssImageLayers = {
    schema: 'cssearth-css-volume@1', id: 'fixture',
    frame: { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    anchors: [], bankViews: views.filter(view => view.axis === 'z'),
    stacks: [{ axis: 'z', leaves: [sheet('behind', -1), sheet('middle', 0), sheet('ahead', 1)] }],
    resources: [{ path: 'atlas.png', bytes: 1, width: 1, height: 1 }], provenance: {}, approximation: {},
  };
  const runtime = mountPreparedCssImageLayers({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resolveResource: path => `/prepared/${path}` });
  const opacity = () => ['behind', 'middle', 'ahead'].map(id => document.elements.find(element => element.dataset.imageLayerLeaf === id)!.style.opacity ?? '');
  const publish = (positionM: readonly [number, number, number], around = true) => runtime.publish({
    world: { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM, orientationXyzw: [0, 0, 0, 1] } }, viewport: { focalPixels: 600, principalOffsetPixels: [0, 0] } }, around);
  publish([0, 0, .2], false);
  assert.deepEqual(opacity(), ['', '', ''], 'as its page\'s own subject a bank draws every sheet');
  publish([0, 0, .2]);
  assert.deepEqual(opacity(), ['', '0', '0'], 'the sheets within one step of the camera are left out');
  publish([0, 0, 5]);
  assert.deepEqual(opacity(), ['', '', ''], 'farther away every sheet draws');
  publish([3, 0, 0]);
  assert.deepEqual(opacity(), ['', '', ''], 'a sheet beside the camera, past its edge, draws');
  publish([0, 0, .2]); publish([0, 0, .2], false);
  assert.deepEqual(opacity(), ['', '', ''], 'left-out sheets draw again when the bank is its page\'s subject');
});

test('a stack mounts a camera for each of its scenes, and a stack without leaves is not mounted and takes no part', () => {
  const document = new ImageDocument(), host = document.createElement(), before = document.createElement();
  host.appendChild(before);
  const style = { width: '1px', height: '1px', transform: 'translate3d(0,0,0)', backgroundSize: '2px 1px', backgroundPosition: '0px 0px' };
  const payload: PreparedCssImageLayers = {
    schema: 'cssearth-css-volume@1', id: 'fixture',
    frame: { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    anchors: [], bankViews: views.map(view => view.axis === 'z' ? { ...view, sceneSizes: [1, 2] } : view),
    stacks: views.map(({ axis }) => ({ axis, leaves: axis === 'z' ? ['flat', 'a', 'b'].map(id => ({ id, centerUnits: [0, 0, 0] as [number, number, number],
      texturePath: id === 'flat' ? 'flat.png' : 'atlas.png', widthPx: 1, heightPx: 1, style })) : [] })),
    resources: ['flat.png', 'atlas.png'].map(path => ({ path, bytes: 1, width: 2, height: 1 })),
    provenance: {}, approximation: {},
  };
  const resolveResource = mock.fn((path: string) => `/prepared/${path}`);
  const runtime = mountPreparedCssImageLayers({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resolveResource });
  const named = (name: string) => document.elements.filter(element => element.className === name);
  const leaf = (id: string) => document.elements.find(element => element.dataset.imageLayerLeaf === id)!;
  // One projection, for the stack that draws; in it a camera, a scene and a mesh for each run, with the run's leaves.
  assert.deepEqual(named('css-volume-projection').map(element => element.dataset.imageLayerAxis), ['z']);
  assert.equal(named('css-volume-projection')[0]!.children.length, 2);
  assert.deepEqual(named('css-volume-mesh').map(mesh => mesh.children.map(element => element.dataset.imageLayerLeaf)), [['flat'], ['a', 'b']]);
  const publish = (orientationXyzw: readonly [number, number, number, number]) => runtime.publish({
    world: { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM: [0, 0, 10], orientationXyzw } },
    viewport: { focalPixels: 600, principalOffsetPixels: [0, 0] },
  });
  publish([0, 0, 0, 1]);
  // Every scene takes the camera, and leaves cut from one atlas ask for its address once.
  const [first, second] = named('css-volume-scene');
  assert.ok(first!.style.transform && first!.style.transform === second!.style.transform);
  assert.deepEqual(named('css-volume-camera').map(camera => camera.style.perspective), ['600px', '600px']);
  assert.deepEqual(resolveResource.mock.calls.map(call => call.arguments), [['flat.png'], ['atlas.png']]);
  assert.equal(leaf('a').style.backgroundImage, leaf('b').style.backgroundImage);
  // Seen edge-on the stack is still the only one that draws: it keeps the whole weight.
  publish([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  assert.equal(named('css-volume-projection')[0]!.style.opacity, '0.999');
  assert.equal(named('css-volume-projection')[0]!.style.visibility, 'visible');
  assert.deepEqual(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], views.filter(view => view.axis === 'z')), { z: 1 });
});
