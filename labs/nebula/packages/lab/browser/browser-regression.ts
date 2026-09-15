/** Browser-only regression probes; never touch the operator's browser context. */
import assert from 'node:assert/strict';
import type { BrowserContext, JSHandle, Page } from 'playwright';

export async function blockProcessingWrites(context: BrowserContext) {
  const blocked: string[] = [];
  const handler: Parameters<BrowserContext['route']>[1] = async route => {
    const request = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.fallback();
    blocked.push(`${request.method()} ${request.url()}`);
    await route.abort('blockedbyclient');
  };
  await context.route('**/*', handler);
  return { blocked, dispose: () => context.unroute('**/*', handler) };
}

const retainedSelector = '.css-volume-projection, .css-volume-scene, .css-volume-mesh, .css-volume-mesh s, [data-compiler-stars], [data-compiler-stars] s';
type RetainedScene = JSHandle<{ root: Element; nodes: Element[] }>;
export async function retainCompilerScene(page: Page): Promise<RetainedScene> {
  return page.evaluateHandle(selector => {
    const root = document.querySelector('[data-compiler-root]');
    if (!root || document.querySelectorAll('[data-compiler-root]').length !== 1) throw new Error('Exactly one ready compiler scene is required.');
    const nodes = [...root.querySelectorAll(selector)];
    if (!root.querySelector('.css-volume-mesh s') || !root.querySelector('[data-compiler-stars] s'))
      throw new Error('A retained-scene check requires real volume leaves and stars.');
    return { root, nodes };
  }, retainedSelector);
}
export async function assertCompilerSceneRetained(page: Page, saved: RetainedScene, label: string) {
  const retained = await page.evaluate(({ saved, selector }) => {
    const root = document.querySelector('[data-compiler-root]');
    const nodes = root ? [...root.querySelectorAll(selector)] : [];
    return document.querySelectorAll('[data-compiler-root]').length === 1 && saved.root === root && saved.root.isConnected && nodes.length === saved.nodes.length &&
      nodes.every((node, index) => node === saved.nodes[index]);
  }, { saved, selector: retainedSelector });
  assert.equal(retained, true, `${label}: a compiler scene, bank, leaf or star node was replaced.`);
}

export async function compilerPresentation(page: Page) {
  const root = page.locator('[data-compiler-root]');
  return {
    lens: await page.locator('#compiler-lens').inputValue(),
    material: await root.getAttribute('data-material'),
    pose: await root.getAttribute('data-pose'),
    framing: await root.getAttribute('data-framing'),
    stars: await page.getByRole('checkbox', { name: 'Stars', exact: true }).isChecked(),
    renderedStars: await root.getAttribute('data-stars'),
    original: await page.getByRole('checkbox', { name: 'Original', exact: true }).isChecked(),
    orbit: await page.getByRole('button', { name: 'Orbit', exact: true }).getAttribute('aria-pressed'),
  };
}

declare global {
  interface Window {
    __nebulaDecodeProbe?: { original: typeof createImageBitmap; held: boolean; active: number; calls: number; release(): void };
  }
}

/** Hold a real decoded bitmap so a superseding UI choice overtakes its material load. */
export async function delayNextBitmap(page: Page) {
  await page.evaluate(() => {
    if (window.__nebulaDecodeProbe) throw new Error('A bitmap probe is already installed.');
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const probe = { original: window.createImageBitmap, held: false, active: 0, calls: 0, release };
    window.__nebulaDecodeProbe = probe;
    function decode(source: ImageBitmapSource, options?: ImageBitmapOptions): Promise<ImageBitmap>;
    function decode(source: ImageBitmapSource, sx: number, sy: number, sw: number, sh: number, options?: ImageBitmapOptions): Promise<ImageBitmap>;
    async function decode(source: ImageBitmapSource, sx?: number | ImageBitmapOptions, sy?: number, sw?: number, sh?: number, options?: ImageBitmapOptions) {
      const first = probe.calls++ === 0; probe.active++;
      try {
        const decodeOriginal = probe.original.bind(window);
        const bitmap = typeof sx === 'number' ? await decodeOriginal(source, sx, sy!, sw!, sh!, options) : await decodeOriginal(source, sx);
        if (first) { probe.held = true; await gate; }
        return bitmap;
      } finally { probe.active--; }
    }
    window.createImageBitmap = decode;
  });
  return {
    held: () => page.waitForFunction(() => window.__nebulaDecodeProbe?.held === true, null, { timeout: 60000 }),
    release: () => page.evaluate(() => window.__nebulaDecodeProbe?.release()),
    async settled() {
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => Boolean(window.__nebulaDecodeProbe?.calls) && window.__nebulaDecodeProbe?.active === 0);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    },
    restore: () => page.evaluate(() => {
      const probe = window.__nebulaDecodeProbe;
      if (probe) { probe.release(); window.createImageBitmap = probe.original; delete window.__nebulaDecodeProbe; }
    }),
  };
}
