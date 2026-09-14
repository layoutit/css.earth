import { expect, test, vi } from 'vitest';
import { imageLayerAxisWeights, mountPreparedCssImageLayers } from './prepared-image-layer-runtime.js';
import type { PreparedCssImageLayers, PreparedImageLayerView } from './loader.js';

const views: readonly PreparedImageLayerView[] = [
  { axis: 'x', normalUnits: [1, 0, 0], samplingStepUnits: 1 },
  { axis: 'y', normalUnits: [0, 1, 0], samplingStepUnits: 1 },
  { axis: 'z', normalUnits: [0, 0, 1], samplingStepUnits: 1 },
];

test('image banks keep an active, normalized non-edge-on projection through a complete turn', () => {
  for (let degrees = 0; degrees <= 360; degrees++) {
    const angle = degrees * Math.PI / 360;
    const weights = imageLayerAxisWeights([Math.sin(angle), 0, 0, Math.cos(angle)], views);
    expect(weights.x + weights.y + weights.z).toBeCloseTo(1, 12);
    expect(Math.max(weights.x, weights.y, weights.z)).toBeGreaterThanOrEqual(.5);
  }
  expect(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], views)).toEqual({ x: 0, y: 1, z: 0 });
});
test('selection follows baked plane normals and sample density instead of bank names', () => {
  const tilted = views.map(view => view.axis === 'z' ? { ...view, normalUnits: [0, 1, 0] as const } : view);
  expect(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], tilted).z).toBeGreaterThan(0);
  const dense = tilted.map(view => view.axis === 'z' ? { ...view, samplingStepUnits: .1 } : view);
  expect(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], dense)).toEqual({ x: 0, y: 0, z: 1 });
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
    resources: views.map(({ axis }) => ({ path: `${axis}.png`, sha256: 'a'.repeat(64), bytes: 1, width: 1, height: 1 })),
    provenance: {}, approximation: {},
  };
  const resolveResource = vi.fn((path: string) => `/prepared/${path}`);
  const runtime = mountPreparedCssImageLayers({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resolveResource });
  const retained = [...document.elements];
  const leaf = (axis: string) => document.elements.find(element => element.dataset.imageLayerLeaf === axis)!;
  const bank = (axis: string) => document.elements.find(element => element.dataset.imageLayerAxis === axis)!;
  const publish = (orientationXyzw: readonly [number, number, number, number]) => runtime.publish({
    world: { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM: [0, 0, 10], orientationXyzw } },
    viewport: { focalPixels: 600, principalOffsetPixels: [0, 0] },
  });
  expect(resolveResource).not.toHaveBeenCalled();
  for (const { axis } of views) expect(leaf(axis).style.backgroundImage).toBeUndefined();
  publish([0, 0, 0, 1]);
  expect(resolveResource.mock.calls).toEqual([['z.png']]);
  expect(leaf('z').style.backgroundImage).toBe('url("/prepared/z.png")');
  expect(leaf('x').style.backgroundImage).toBeUndefined();
  expect(leaf('y').style.backgroundImage).toBeUndefined();
  expect(bank('z').style.visibility).toBe('visible');
  expect(bank('y').style.display).toBe('none');
  publish([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  expect(resolveResource.mock.calls).toEqual([['z.png'], ['y.png']]);
  expect(bank('z').style.display).toBe('none');
  expect(bank('y').style.visibility).toBe('visible');
  publish([0, 0, 0, 1]);
  expect(resolveResource).toHaveBeenCalledTimes(2);
  expect(document.elements).toEqual(retained);
  runtime.destroy();
  publish([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  expect(resolveResource).toHaveBeenCalledTimes(2);
});
