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
  parent: ImageElement | null = null;
  readonly style: Record<string, string> = {};
  readonly dataset: Record<string, string> = {};
  className = '';
  removed = false;
  readonly ownerDocument: ImageDocument;
  constructor(ownerDocument: ImageDocument) { this.ownerDocument = ownerDocument; }
  // A child that is appended moves: it leaves the parent it had.
  private adopt(child: ImageElement) { child.detach(); child.parent = this; }
  private detach() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  appendChild(child: ImageElement) { this.adopt(child); this.children.push(child); }
  insertBefore(child: ImageElement, before: ImageElement) { this.adopt(child); this.children.splice(this.children.indexOf(before), 0, child); }
  remove() { this.detach(); this.removed = true; }
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

test('around a body, a sheet within one sampling step of the camera or of the body is left out, by its prepared corners', () => {
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
  // The body stands far behind every sheet unless a case says otherwise.
  const publish = (positionM: readonly [number, number, number], around: readonly [number, number, number] | false = [0, 0, -90]) => runtime.publish({
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
  publish([0, 0, 50], [0, 0, 0]);
  assert.equal(opacity()[1], '0', 'the sheet through the body is left out however far the camera is: the body is drawn in its place');
  publish([0, 0, 50]);
  assert.equal(opacity()[1], '', 'and draws again around a body that stands elsewhere');
  // Around a body the sheets are out of their scene, under one flat element, and paint farthest first on each side of
  // the camera; back as the page's subject they are in their scene again, sorted by the browser.
  const over = () => ['behind', 'middle', 'ahead'].map(id => document.elements.find(element => element.dataset.imageLayerLeaf === id)!.style.zIndex ?? '');
  assert.deepEqual(over(), ['0', '1', '2'], 'in front of them all, the nearest sheet is painted last');
  publish([0, 0, .5]);
  assert.deepEqual(over(), ['0', '1', '0'], 'between two sheets, each side paints toward the camera');
  publish([0, 0, -5]);
  assert.deepEqual(over(), ['2', '1', '0'], 'behind them all, the order is the other way');
  publish([0, 0, -5], false);
  assert.deepEqual(over(), ['', '', ''], 'in its own scene again a sheet has no paint order of its own');
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
  // Around a body the patches leave their runs' scenes for one flat element that carries the perspective, in the stack's
  // order, each with the camera's transform before its own; as the page's subject again they are back in their runs.
  const world = { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM: [0, 0, 10] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const projection = named('css-volume-projection')[0]!, cameras = named('css-volume-camera'), ids = (parent: ImageElement) => parent.children.map(element => element.dataset.imageLayerLeaf);
  const viewport = { focalPixels: 600, principalOffsetPixels: [3, 4] as const };
  runtime.publish({ world, viewport });
  const camera = first!.style.transform;
  runtime.publish({ world, viewport }, [0, 0, -90]);
  assert.equal(projection.children.length, 1);
  const flat = projection.children[0]!;
  assert.deepEqual([flat.className, flat.style.transformStyle, flat.style.perspective, flat.style.perspectiveOrigin], ['css-volume-mesh', 'flat', '600px', '3px 4px']);
  assert.deepEqual(ids(flat), ['flat', 'a', 'b']);
  assert.ok(flat.children.every(element => element.style.transform === `${camera} ${style.transform}`), 'each patch carries the camera before its own transform');
  runtime.publish({ world: { ...world, pose: { ...world.pose, positionM: [0, 0, 12] } }, viewport }, [0, 0, -90]);
  assert.ok(flat.children.every(element => element.style.transform !== `${camera} ${style.transform}` && element.style.transform.endsWith(` ${style.transform}`)), 'and follows it');
  runtime.publish({ world, viewport });
  assert.deepEqual(projection.children, cameras);
  assert.deepEqual(named('css-volume-mesh').filter(mesh => mesh !== flat).map(ids), [['flat'], ['a', 'b']]);
  assert.ok([leaf('flat'), leaf('a'), leaf('b')].every(element => element.style.transform === style.transform));
  assert.ok(first!.style.transform === camera && second!.style.transform === camera && cameras.every(each => each.style.perspective === '600px'));
  // Seen edge-on the stack is still the only one that draws: it keeps the whole weight.
  publish([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  // A stack of patches is drawn at 1, not under the ceiling a stack of sheets is held to.
  assert.equal(named('css-volume-projection')[0]!.style.opacity, '1');
  assert.equal(named('css-volume-projection')[0]!.style.visibility, 'visible');
  assert.deepEqual(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], views.filter(view => view.axis === 'z')), { z: 1 });
});
