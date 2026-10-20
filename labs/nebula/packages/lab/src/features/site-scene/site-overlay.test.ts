import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePreparedCssVolume, type PreparedCssVolume } from '@cssearth/objects';
import { mountPreparedCssVolume } from '@cssearth/renderer/volume/prepared-volume-runtime.ts';
import { EMBED_BRIDGE_PROTOCOL, parseEmbedPageMessage, embedCamera } from '@cssearth/renderer/embed/embed-bridge.ts';
import { mountReconstructionOverlay } from '../../adapters/viewer/reconstruction-overlay.ts';
// The site and lab use the shared camera transport owned by the renderer's protocol.

/** The few DOM members both mounts use. */
class FakeElement {
  readonly nodeType = 1; readonly children: FakeElement[] = []; readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> & { setProperty(name: string, value: string): void };
  parentNode: FakeElement | null = null; className = ''; hidden = false;
  readonly ownerDocument: FakeDocument; readonly tagName: string;
  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument; this.tagName = tagName;
    const style: Record<string, string> = {};
    Object.defineProperty(style, 'setProperty', { value: (name: string, value: string) => { style[name] = value; } });
    this.style = style as FakeElement['style'];
  }
  append(child: FakeElement) { this.insertBefore(child, null); }
  insertBefore(child: FakeElement, before: FakeElement | null) { child.remove(); child.parentNode = this; this.children.splice(before === null ? this.children.length : this.children.indexOf(before), 0, child); }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  setAttribute(name: string, value: string) { this.dataset[name] = value; }
  find(className: string): FakeElement | undefined {
    for (const child of this.children) { if (child.className.split(' ').includes(className)) return child; const found = child.find(className); if (found) return found; }
    return undefined;
  }
}
class FakeDocument { createElement(tag = 'div') { return new FakeElement(this, tag); } }

// A small body's bank far from the Sun: metres per unit so small that a camera rebuilt from its position alone, without
// its exact offset from the body, stands units away from where the page draws from.
const ORIGIN: [number, number, number] = [6.1e19, -2.3e19, 1.1e19];
const payload: PreparedCssVolume = validatePreparedCssVolume({
  schema: 'cssearth-css-volume@1', id: 'fixture', frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: ORIGIN,
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1e3, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } }, anchors: [],
  stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0], texturePath: `${axis}.png`, widthPx: 1, heightPx: 1,
    style: { width: '2px', height: '2px', transform: 'matrix3d(50,0,0,0,0,50,0,0,0,0,1,0,-50,-50,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] })),
  resources: (['x', 'y', 'z'] as const).map(axis => ({ path: `${axis}.png`, bytes: 1, width: 1, height: 1 })), provenance: {}, approximation: {},
});
const offsetM: [number, number, number] = [3.7e3, -1.9e3, 2.0e4];
const world = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, pose: {
  positionM: ORIGIN.map((value, axis) => value + offsetM[axis]!) as [number, number, number],
  orientationXyzw: [0.2, -0.1, 0.05, Math.sqrt(1 - 0.04 - 0.01 - 0.0025)] as [number, number, number, number],
  focusOffset: { originM: ORIGIN, offsetM } } };
const optics = { focalPixels: 1091.19, principalOffsetPixels: [14, -6] as [number, number], widthPixels: 1200, heightPixels: 700, framingRadiusPixels: 9 };
const numbers = (css: string) => [...css.matchAll(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/giu)].map(match => Number(match[0]));

test('a lab layer published with the camera the page sends lands where the page\'s renderer draws the bank', () => {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.append(before);
  const page = mountPreparedCssVolume({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resolveResource: path => `/prepared/${path}` });
  page.publish({ world, viewport: optics });
  // The page posts its camera; the lab parses the message it receives.
  const message = parseEmbedPageMessage(JSON.parse(JSON.stringify({ protocol: EMBED_BRIDGE_PROTOCOL, type: 'camera', camera: embedCamera(world, optics), moving: false })));
  assert.equal(message?.type, 'camera');
  const camera = message!.type === 'camera' ? message!.camera : null;
  const overlay = mountReconstructionOverlay({ host: host as unknown as HTMLElement, before: before as unknown as Node, frame: payload.frame, url: '/photo.png',
    overlay: { id: 'photo', label: 'Original image', texturePath: 'photo.png', widthPx: 2, heightPx: 2, pivotCssPx: [0, 0, 0], sourcePageUrl: 'https://example.test', credit: '', registrationNote: '',
      style: { width: '2px', height: '2px', transform: 'matrix3d(50,0,0,0,0,50,0,0,0,0,1,0,-50,-50,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } } });
  overlay.publish(camera!);
  const pageRoot = page.roots[0] as unknown as FakeElement, labRoot = overlay.root as unknown as FakeElement;
  const pageScene = pageRoot.find('css-volume-scene')!, labScene = labRoot.find('css-volume-scene')!;
  const pageCamera = pageRoot.find('css-volume-camera')!, labCamera = labRoot.find('css-volume-camera')!;
  const drawn = numbers(pageScene.style.transform!), laid = numbers(labScene.style.transform!);
  assert.equal(laid.length, drawn.length);
  laid.forEach((value, index) => assert.ok(Math.abs(value - drawn[index]!) < 1e-5, `transform term ${index}: ${value} against the page's ${drawn[index]}`));
  assert.deepEqual(numbers(labCamera.style.perspective!), numbers(pageCamera.style.perspective!));
  assert.deepEqual(numbers(labCamera.style.perspectiveOrigin!), numbers(pageCamera.style.perspectiveOrigin!));
  // The camera stands 20 m (20 units) from the bank: the test would pass with any camera were it at the origin.
  assert.ok(Math.abs(drawn[2]!) > 100, 'the fixture camera is off the bank\'s origin');
});
