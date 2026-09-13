import { afterEach, expect, test, vi } from 'vitest';
import preparedSky from '../../../planets/mercury/prepared/sky.json';
import { mountRetainedCubicSky } from './cubic-sky-runtime.js';
import type { CubicSkyPlan } from './cubic-sky-runtime.js';

afterEach(() => vi.unstubAllGlobals());

test('the shared-universe path keeps camera orientation without unused sky images or star observers', () => {
  const observers = vi.fn();
  const document = { createElement: () => new Element(),
    defaultView: { getComputedStyle: () => ({ perspective: '1000px' }) } };
  class Element {
    readonly children: Element[] = [];
    readonly style = { setProperty(name: string, value: string) { Object.assign(this, { [name]: value }); } } as unknown as CSSStyleDeclaration;
    readonly dataset = {};
    readonly ownerDocument = document;
    className = ''; ariaHidden = ''; clientWidth = 1440; clientHeight = 900;
    get childElementCount() { return this.children.length; }
    appendChild(child: Element) { this.children.push(child); }
    prepend(child: Element) { this.children.unshift(child); }
    remove() {}
    querySelectorAll(selector: string): Element[] {
      return this.children.flatMap(child => [
        ...(child.className.split(' ').includes(selector.slice(1)) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
  }
  vi.stubGlobal('document', document);
  vi.stubGlobal('HTMLElement', Element);
  vi.stubGlobal('ResizeObserver', class { constructor() { observers(); } observe() {} disconnect() {} });
  const plan = preparedSky as unknown as CubicSkyPlan;
  const mount = (renderContent: boolean) => mountRetainedCubicSky({ host: new Element() as unknown as HTMLElement,
    plan, objectId: 'mercury', renderContent });
  const orientationOnly = mount(false);
  expect(orientationOnly.faceCount).toBe(0);
  expect(orientationOnly.retainedStarCount).toBe(0);
  expect(orientationOnly.starGroup).toBeNull();
  expect(observers).not.toHaveBeenCalled();
  const standalone = mount(true);
  expect(standalone.faceCount).toBe(plan.faces.length);
  expect(standalone.retainedStarCount).toBe(plan.catalogueStars!.retained.length);
  expect(observers).toHaveBeenCalledTimes(1);
  for (const zoom of [1, .5, 3]) {
    const view = { matrix: `rotateY(${zoom * 30}deg)`, zoom, defaultZoom: 1 };
    orientationOnly.setOrientation(view); standalone.setOrientation(view);
    expect(orientationOnly.orientation.style).toMatchObject({ transform: view.matrix });
    expect(properties(orientationOnly.cube.style)).toEqual({});
    expect(properties(standalone.cube.style)).toEqual({});
    expect(properties(orientationOnly.root.style)).toEqual(properties(standalone.root.style));
  }
  orientationOnly.destroy(); standalone.destroy();
});

function properties(style: CSSStyleDeclaration) {
  return Object.fromEntries(Object.entries(style).filter(([, value]) => typeof value === 'string'));
}
