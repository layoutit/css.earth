// Bounded browser integration of shared helpers; this does not mount or qualify an object scene.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { SceneLifetime } from '@cssearth/engine';

type LifetimeModule = {
  createSceneLifetime(): SceneLifetime;
  waitForScenePaint(lifetime: SceneLifetime, target?: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>): Promise<void>;
  waitForSceneDocument(lifetime: SceneLifetime, target?: Document): Promise<void>;
};
type DragControls = {
  update(options: { wheel?: boolean; drag?: boolean }): void;
  destroy(): void;
  stats(): { activeMode: string; activeMotionCount: number; pendingPointer: boolean };
};
type DragModule = {
  createUnboundedMatrixDragControls(options: {
    inputSurface: HTMLElement;
    trackballMetrics(): { centerX: number; centerY: number; radius: number; surfaceRadius: number; focalLength: number; viewportWidth: number };
    rotate(update: { rotation: number[] }): void;
    onStart(): void;
    onError(error: Error): void;
  }): DragControls;
};
type Fixture = {
  input: HTMLElement; controls: DragControls; rotations: number[][]; starts: number;
  pointerId: number | null; errors: string[]; destroyPolicy(): void;
};
type FixtureWindow = Window & typeof globalThis & { __ownersFixture: Fixture };

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve('output/playwright/typescript-owners');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE
  ? { executablePath: process.env.CHROME_EXECUTABLE } : { channel: 'chrome' }) });
const errors: string[] = [], moduleRequests = new Set<string>();
const report: Record<string, unknown> = {
  scope: 'Shared helper integration only; no object scene, prepared asset or full conformance claim.',
  browser: browser.version(), origin, errors,
};
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => moduleRequests.add(new URL(request.url()).pathname));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.route('**/__typescript-owners-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><title>TypeScript owner integration</title><style>body{margin:40px;font:18px system-ui}#input{box-sizing:border-box;width:640px;height:400px;border:2px solid #546e7a;padding:24px}output{display:block;margin-top:24px}</style><h1>Shared helper integration</h1><div id="input">Pointer input fixture. No object scene is mounted.</div><output>Waiting for pointer input.</output>' }));
  await page.goto(`${origin}/__typescript-owners-fixture`);

  report.waits = await page.evaluate(async () => {
    const path = '/src/platform/scene-lifetime.mjs';
    const { createSceneLifetime, waitForScenePaint, waitForSceneDocument } = await import(path) as LifetimeModule;
    const lifetime = createSceneLifetime();
    let completedFrames = 0;
    await waitForSceneDocument(lifetime);
    await waitForScenePaint(lifetime, {
      requestAnimationFrame(callback) { return requestAnimationFrame(timestamp => { completedFrames++; callback(timestamp); }); },
      cancelAnimationFrame: cancelAnimationFrame.bind(window),
    });
    lifetime.destroy();
    const cancelled = createSceneLifetime();
    let requestedFrames = 0, observedFrames = 0, cancelledFrames = 0;
    await waitForScenePaint(cancelled, {
      requestAnimationFrame(callback) {
        requestedFrames++;
        return requestAnimationFrame(timestamp => {
          observedFrames++;
          callback(timestamp);
          if (observedFrames === 1) cancelled.destroy();
        });
      },
      cancelAnimationFrame(id) { cancelledFrames++; cancelAnimationFrame(id); },
    });
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return { completedFrames, requestedFrames, observedFrames, cancelledFrames, disposed: cancelled.disposed };
  });
  assert.deepEqual(report.waits, { completedFrames: 2, requestedFrames: 2, observedFrames: 1, cancelledFrames: 1, disposed: true });

  await page.evaluate(async () => {
    const dragPath = '/src/platform/camera-input.mts', policyPath = '/site/runtime-policy.mts';
    const { createUnboundedMatrixDragControls } = await import(dragPath) as DragModule;
    const policy = await import(policyPath) as typeof import('../runtime-policy.mts');
    const input = document.querySelector<HTMLElement>('#input');
    if (!input) throw new Error('Missing pointer fixture.');
    const state = { input, rotations: [] as number[][], starts: 0, pointerId: null as number | null, errors: [] as string[] };
    input.addEventListener('pointerdown', event => { state.pointerId = event.pointerId; });
    const bounds = input.getBoundingClientRect();
    const controls = createUnboundedMatrixDragControls({
      inputSurface: input,
      trackballMetrics: () => ({ centerX: bounds.x + bounds.width / 2, centerY: bounds.y + bounds.height / 2,
        radius: 180, surfaceRadius: 180, focalLength: 640, viewportWidth: 640 }),
      rotate({ rotation }) {
        state.rotations.push(rotation);
        const readout = document.querySelector('output');
        if (readout) readout.textContent = `${state.rotations.length} input publications; quaternion ${rotation.map(value => value.toFixed(5)).join(', ')}`;
      },
      onStart() { state.starts++; },
      onError(error) { state.errors.push(error.message); },
    });
    const responsive = policy.bindResponsiveOrbitPolicy({ controls,
      inputSurface: input, mediaQuery: matchMedia(policy.MOBILE_VIEWPORT_QUERY) });
    (window as FixtureWindow).__ownersFixture = Object.assign(state, { controls, destroyPolicy: responsive.destroy });
  });
  const bounds = await page.locator('#input').boundingBox();
  assert.ok(bounds);
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 90, y + 45, { steps: 6 });
  await page.waitForFunction(() => (window as FixtureWindow).__ownersFixture.rotations.length > 0);
  const active = await page.evaluate(() => {
    const fixture = (window as FixtureWindow).__ownersFixture;
    return { rotations: fixture.rotations, starts: fixture.starts, stats: fixture.controls.stats(),
      captured: fixture.pointerId !== null && fixture.input.hasPointerCapture(fixture.pointerId), errors: fixture.errors };
  });
  assert.equal(active.stats.activeMode, 'drag');
  assert.equal(active.starts, 1);
  assert.equal(active.captured, true);
  assert.deepEqual(active.errors, []);
  assert.ok(active.rotations.every(rotation => rotation.length === 4 && rotation.every(Number.isFinite) && Math.abs(Math.hypot(...rotation) - 1) < 1e-10));
  assert.ok(active.rotations.some(rotation => Math.hypot(...rotation.slice(0, 3)) > 1e-6));
  report.pointer = { publications: active.rotations.length, starts: active.starts, captured: active.captured };
  await page.screenshot({ path: resolve(output, 'pointer-input.png') });
  const retired = await page.evaluate(() => {
    const fixture = (window as FixtureWindow).__ownersFixture;
    fixture.destroyPolicy();
    fixture.controls.destroy();
    return { publications: fixture.rotations.length, starts: fixture.starts, captured:
      fixture.pointerId !== null && fixture.input.hasPointerCapture(fixture.pointerId), cursor: fixture.input.style.cursor };
  });
  assert.equal(retired.captured, false);
  assert.equal(retired.cursor, '');
  await page.mouse.move(x + 120, y + 70);
  await page.mouse.up();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 80, y - 40, { steps: 3 });
  await page.mouse.up();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const after = await page.evaluate(() => {
    const fixture = (window as FixtureWindow).__ownersFixture;
    return { publications: fixture.rotations.length, starts: fixture.starts, stats: fixture.controls.stats(), errors: fixture.errors };
  });
  assert.equal(after.publications, retired.publications);
  assert.equal(after.starts, retired.starts);
  assert.equal(after.stats.activeMode, 'idle');
  assert.equal(after.stats.activeMotionCount, 0);
  assert.equal(after.stats.pendingPointer, false);
  assert.deepEqual(after.errors, []);
  assert.ok(moduleRequests.has('/site/runtime-policy.mts'), 'Vite must load the typed shared policy through its compatibility entry.');
  assert.deepEqual(errors, []);
  report.retirement = { publications: after.publications, noFurtherPublications: true, pointerReleased: true, activeMode: after.stats.activeMode };
  report.modules = [...moduleRequests].filter(path => /(?:camera-input|camera-math|sphere-drag|scene-lifetime|scene-native-waits|runtime-policy)/.test(path));
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await browser.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(`TYPESCRIPT OWNERS PASS: native waits, pointer input, retirement and typed policy import. ${output}/report.json`);
