import { afterEach, expect, test, vi } from 'vitest';
import preparedSky from '../../../objects/mercury/prepared/sky.json';
import { mountRetainedCubicSky } from './cubic-sky-runtime.js';
import type { CubicSkyPlan } from './cubic-sky-runtime.js';

afterEach(() => vi.unstubAllGlobals());

test('an object sky keeps retained orientation handles and draws no sky images or stars', () => {
  class Element {
    readonly children: Element[] = [];
    readonly style = { setProperty(name: string, value: string) { Object.assign(this, { [name]: value }); } } as unknown as CSSStyleDeclaration;
    className = ''; ariaHidden = ''; removed = false;
    appendChild(child: Element) { this.children.push(child); }
    prepend(child: Element) { this.children.unshift(child); }
    remove() { this.removed = true; }
  }
  vi.stubGlobal('document', { createElement: () => new Element() });
  vi.stubGlobal('HTMLElement', Element);
  const host = new Element();
  const plan = preparedSky as unknown as CubicSkyPlan;
  const sky = mountRetainedCubicSky({ host: host as unknown as HTMLElement, plan, objectId: 'mercury' });
  const node = (element: HTMLElement) => element as unknown as Element;
  expect(host.children).toEqual([sky.root]);
  expect(sky.root.className).toBe('object-cubic-sky mercury-skybox');
  expect(node(sky.root).children).toEqual([sky.cube]);
  expect(node(sky.cube).children).toEqual([sky.orientation]);
  expect(node(sky.orientation).children).toEqual([]);
  expect(properties(sky.root.style)).toEqual({ '--object-cubic-sky-camera-distance': plan.projection?.cssPerspective });
  for (const zoom of [1, .5, 3]) {
    const view = { matrix: `rotateY(${zoom * 30}deg)`, zoom, defaultZoom: 1 };
    sky.setOrientation(view);
    expect(sky.orientation.style).toMatchObject({ transform: view.matrix });
    expect(sky.root.style).toMatchObject({ '--object-cubic-sky-zoom': String(1 + plan.cameraZoomResponse * (zoom - 1)) });
  }
  expect(() => sky.setOrientation({ matrix: 'none', zoom: Number.NaN, defaultZoom: 1 })).toThrow(TypeError);
  sky.destroy();
  expect(node(sky.root).removed).toBe(true);
});

function properties(style: CSSStyleDeclaration) {
  return Object.fromEntries(Object.entries(style).filter(([, value]) => typeof value === 'string'));
}
