/** Native cross-cutting paths. Missing capability observers are tracked in HARNESS-NEEDS.md. */
import type { Journey } from './harness/api.mts';
type Api = Parameters<Journey['run']>[0];

async function surface(api: Api) {
  const box = await api.page.locator('.object-input-surface').boundingBox();
  if (!box || box.width < 300 || box.height < 200) throw new Error('No visible input surface');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function fling(api: Api, route: string) {
  const { x, y } = await surface(api);
  // Read application-emitted motion; never manufacture a coast or consume the recorder's DOM queue.
  await api.page.evaluate(() => {
    const witness = { coasting: false, rested: false };
    Reflect.set(window, '__capabilityCoast', witness);
    document.addEventListener('objectmotionchange', event => {
      if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== 'object') return;
      if (Reflect.get(event.detail, 'coasting') === true) witness.coasting = true;
      if (witness.coasting && Reflect.get(event.detail, 'active') === false) witness.rested = true;
    }, { capture: true });
  });
  api.setStep('fling');
  let at = x - 120;
  await api.page.mouse.move(at, y);
  await api.input('pointerdown', () => api.page.mouse.down());
  for (const delta of [4, 8, 14, 22, 32, 44, 58]) {
    at += delta;
    await api.page.mouse.move(at, y);
    await api.frames(1, true);
  }
  await api.input('pointerup', () => api.page.mouse.up());
  await api.barrier('coast-rest', route);
  const coasted = await api.page.evaluate(() => {
    const value: unknown = Reflect.get(window, '__capabilityCoast');
    return value !== null && typeof value === 'object' && Reflect.get(value, 'coasting') === true && Reflect.get(value, 'rested') === true;
  });
  if (!coasted) throw new Error('Accelerating native drag did not coast and return to rest');
}
const worldMotion = [
  'handler:site:application-world-context:createApplicationWorldContext:objectmotionchange:1',
  'handler:site:application-world-context:createApplicationWorldContext:objectrotationchange:1',
];

export const journeys: Journey[] = [
  {
    id: 'capabilities-world-motion', recipe: { surface: String(surface) }, exercises: worldMotion,
    async run(api) {
      await api.load('/dione/', 'world-ready');
      const { x, y } = await surface(api);
      await api.page.evaluate(() => {
        const seen = { motion: false, rotation: false };
        Reflect.set(window, '__capabilityWorldMotion', seen);
        for (const type of ['objectmotionchange', 'objectrotationchange']) document.addEventListener(type, event => {
          if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== 'object') return;
          if (Reflect.get(event.detail, 'active') === true) seen[type === 'objectmotionchange' ? 'motion' : 'rotation'] = true;
        }, { capture: true });
      });
      api.setStep('world-drag');
      await api.page.mouse.move(x, y);
      await api.input('pointerdown', () => api.page.mouse.down());
      for (let step = 1; step <= 4; step++) {
        await api.page.mouse.move(x + step * 12, y);
        await api.frames(1, true);
      }
      // A stationary hold before release keeps this separate from the coast recipes.
      await api.frames(12, true);
      await api.input('pointerup', () => api.page.mouse.up());
      await api.barrier('world-rest', '/dione/');
      const moved = await api.page.evaluate(() => {
        const seen: unknown = Reflect.get(window, '__capabilityWorldMotion');
        return seen !== null && typeof seen === 'object' && Reflect.get(seen, 'motion') === true && Reflect.get(seen, 'rotation') === true;
      });
      if (!moved) throw new Error('Native drag did not announce world motion and rotation');
    },
  },
  {
    id: 'capabilities-cache', exercises: ['capability:directLoad'],
    async run(api) {
      // Same context, two completed loads. Native cache credit requires a cache-preserving guard.
      await api.load('/dione/', 'cold');
      await api.load('/dione/', 'revisit');
    },
  },
  {
    id: 'capabilities-dpr', exercises: ['capability:directLoad'],
    async run(api) {
      await api.load('/dione/', 'profile-load');
      const dpr = await api.page.evaluate(() => devicePixelRatio);
      if (![1, 2].includes(dpr)) throw new Error(`Unexpected profile DPR ${dpr}`);
      const box = await api.page.locator('.object-input-surface').boundingBox();
      if (!box || box.width <= 0 || box.height <= 0) throw new Error('DPR profile has no rendered input surface');
    },
  },
  {
    id: 'capabilities-responsive', exercises: ['capability:directLoad'],
    async run(api) {
      await api.load('/dione/', 'desktop');
      for (const [name, width, height] of [['phone', 390, 844], ['tablet', 820, 1094], ['desktop-return', 1280, 800]] as const) {
        api.setStep(name);
        await api.page.setViewportSize({ width, height });
        await api.barrier(name, '/dione/');
        if (await api.page.evaluate(() => innerWidth) !== width) throw new Error('Viewport resize did not land');
        if (!await api.page.locator('.object-settings-action').isVisible()) throw new Error('Responsive layout lost settings');
      }
    },
  },
  {
    id: 'capabilities-reduced-motion', exercises: ['capability:directLoad'],
    async run(api) {
      await api.page.emulateMedia({ reducedMotion: 'no-preference' });
      await api.load('/cv-mon/', 'motion-allowed');
      for (const preference of ['reduce', 'no-preference'] as const) {
        api.setStep(preference === 'reduce' ? 'motion-reduced' : 'motion-restored');
        await api.page.emulateMedia({ reducedMotion: preference });
        await api.barrier(preference === 'reduce' ? 'reduced-settled' : 'restored-settled', '/cv-mon/');
        const state = await api.page.evaluate(() => {
          const animation = document.getAnimations().find(item => item.id === 'cv-mon-light-curve');
          return { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, state: animation?.playState };
        });
        if (state.reduced !== (preference === 'reduce') || state.state !== (state.reduced ? 'paused' : 'running'))
          throw new Error(`Prepared light curve did not follow reduced-motion preference: ${JSON.stringify(state)}`);
        await api.playback(preference === 'reduce' ? 'motion-reduced' : 'motion-restored');
        await api.barrier(preference === 'reduce' ? 'motion-reduced' : 'motion-restored', '/cv-mon/');
      }
    },
  },
  {
    id: 'capabilities-tab-focus', exercises: ['capability:directLoad', 'capability:keyboard'],
    async run(api) {
      await api.load('/dione/', 'direct');
      api.setStep('tab-focus');
      await api.input('keydown', () => api.page.keyboard.press('Tab'));
      const focused = await api.page.evaluate(() => {
        const element = document.activeElement;
        return element instanceof HTMLElement && element !== document.body && !element.closest('[hidden],[inert]')
          && element.getClientRects().length > 0 && element.matches(':focus-visible');
      });
      if (!focused) throw new Error('Native Tab did not focus a visible control');
      await api.page.evaluate(() => { Reflect.set(window, '__capabilityFirstFocus', document.activeElement); });
      await api.barrier('tab-focus', '/dione/');
      api.setStep('tab-next');
      await api.input('keydown', () => api.page.keyboard.press('Tab'));
      await api.barrier('tab-next', '/dione/');
      const advanced = await api.page.evaluate(() => document.activeElement !== Reflect.get(window, '__capabilityFirstFocus'));
      if (!advanced) throw new Error('Second native Tab did not advance focus');
      api.setStep('tab-return');
      await api.input('keydown', () => api.page.keyboard.press('Shift+Tab'));
      await api.barrier('tab-return', '/dione/');
      const returned = await api.page.evaluate(() => document.activeElement === Reflect.get(window, '__capabilityFirstFocus'));
      if (!returned) throw new Error('Native Shift+Tab did not restore focus');
      await api.page.evaluate(() => { Reflect.deleteProperty(window, '__capabilityFirstFocus'); });
    },
  },
  {
    id: 'capabilities-touch', exercises: ['capability:directLoad'],
    async run(api) {
      await api.load('/dione/', 'touch-profile');
      if (await api.page.evaluate(() => navigator.maxTouchPoints) === 0) throw new Error('Touch journey requires a touch profile');
      await api.page.evaluate(() => {
        Reflect.set(window, '__capabilityTouch', false);
        document.addEventListener('pointerdown', event => {
          if (event.isTrusted && event.pointerType === 'touch') Reflect.set(window, '__capabilityTouch', true);
        }, { capture: true, once: true });
      });
      api.setStep('touch-settings');
      await api.page.locator('.object-settings-action').tap();
      if (await api.page.evaluate(() => Reflect.get(window, '__capabilityTouch')) !== true) throw new Error('No trusted touch delivery');
      await api.barrier('touch-settings', '/dione/');
      if (await api.page.locator('.object-settings-action').getAttribute('aria-expanded') !== 'true') throw new Error('Touch did not open settings');
      api.setStep('touch-close');
      await api.page.keyboard.press('Escape');
      await api.barrier('touch-close', '/dione/');
    },
  },
  {
    id: 'capabilities-worker', exercises: ['capability:directLoad'],
    async run(api) {
      const workers: string[] = [];
      const onWorker = (worker: import('playwright').Worker) => workers.push(worker.url());
      api.page.on('worker', onWorker);
      await api.load('/dione/', 'worker-startup');
      api.page.off('worker', onWorker);
      const completed = await api.page.evaluate(() => {
        const probe: unknown = Reflect.get(window, '__journey');
        if (!probe || typeof probe !== 'object' || typeof Reflect.get(probe, 'status') !== 'function') throw new Error('No worker status');
        const value: unknown = Reflect.apply(Reflect.get(probe, 'status'), probe, []);
        if (!value || typeof value !== 'object') throw new Error('Invalid worker status');
        return { messages: Reflect.get(value, 'messages'), jobs: Reflect.get(value, 'jobs'), replies: Reflect.get(value, 'replies') };
      });
      if (!workers.some(url => /world-context-planner-worker|prepared-data-worker/u.test(url)) || typeof completed.messages !== 'number' || completed.messages < 1 || completed.jobs !== 0 || completed.replies !== 0)
        throw new Error('No application worker and completed reply observed');
    },
  },
  {
    id: 'capabilities-visibility', exercises: ['capability:directLoad'],
    async run(api) {
      await api.load('/cv-mon/', 'visible');
      // Native page activation only; headless engines may not expose background-tab visibility.
      const other = await api.page.context().newPage();
      try {
        api.setStep('hidden');
        await other.bringToFront();
        await api.frames(2, true);
        if (await api.page.evaluate(() => document.visibilityState) !== 'hidden') throw new Error('Native tab activation did not hide the page; visibility API needed');
        await api.playback('hidden-playback');
        api.setStep('visible-return');
        await api.page.bringToFront();
        if (await api.page.evaluate(() => document.visibilityState) !== 'visible') throw new Error('Native tab activation did not restore visibility');
        await api.barrier('visible-return', '/cv-mon/');
        await api.playback('visible-playback');
      } finally { await other.close(); }
    },
  },
  {
    id: 'capabilities-recorder', exercises: ['capability:directLoad'],
    async run(api) {
      await api.load('/dione/', 'recorder-ready');
      const button = api.page.locator('[data-diagnostic-record]');
      if (!await button.isVisible()) throw new Error('Diagnostic recorder has no visible user entry point');
      api.setStep('record-start');
      await button.click();
      if (await button.getAttribute('aria-pressed') !== 'true') throw new Error('Recorder did not start');
      await api.frames(12, true);
      api.setStep('record-stop');
      const downloaded = api.page.waitForEvent('download');
      await button.click();
      const download = await downloaded;
      if (!/^cssearth-diagnostics-[a-f0-9]+\.json$/u.test(download.suggestedFilename())) throw new Error('No diagnostic download');
      if (await download.failure()) throw new Error('Diagnostic download failed');
      if (await button.getAttribute('aria-pressed') !== 'false') throw new Error('Recorder did not stop');
      await api.barrier('record-stopped', '/dione/');
    },
  },
  {
    id: 'capabilities-wheel-trackpad', recipe: { surface: String(surface) }, exercises: ['capability:wheelTrackpad', ...worldMotion.slice(0, 1)],
    async run(api) {
      await api.load('/dione/', 'direct');
      const { x, y } = await surface(api);
      await api.page.mouse.move(x, y);
      for (const [name, delta] of [['wheel-notch', -100], ['trackpad-packet', -12.5]] as const) {
        api.setStep(name);
        await api.input('wheel', () => api.page.mouse.wheel(0, delta));
        await api.barrier(name, '/dione/');
      }
    },
  },
];
for (const [id, route] of [
  ['earth', '/earth/?settings=1&shadows=on'], ['orbits', '/earth-system/'],
  ['stars', '/milky-way/'], ['sky', '/dione/'],
]) {
  journeys.push({ id: `capabilities-coast-${id}`, recipe: { route: route!, fling: String(fling), surface: String(surface) },
    exercises: worldMotion,
    async run(api) {
      await api.load(route!, 'direct');
      if (id === 'earth') {
        api.setStep('lighting-settings');
        await api.page.locator('.object-settings-action').click();
        await api.barrier('lighting-settings', '/earth/');
        if (!await api.page.locator('input[type="checkbox"][name="shadows"]').isChecked())
          throw new Error('Earth lighting coast requires restored shadows');
        api.setStep('lighting-ready');
        await api.page.keyboard.press('Escape');
        await api.barrier('lighting-ready', '/earth/');
      }
      await fling(api, new URL(api.page.url()).pathname);
    },
  });
}
journeys.push({
  id: 'capabilities-pen', recipe: { surface: String(surface) }, exercises: ['capability:directLoad'],
  async run(api) {
    await api.load('/dione/', 'pen-ready');
    const { x, y } = await surface(api);
    // CDP sends browser-native pen packets. WebKit must get a real counterpart from the harness owner.
    const session = await api.page.context().newCDPSession(api.page);
    try {
      await api.page.evaluate(() => {
        Reflect.set(window, '__capabilityPen', false);
        document.addEventListener('pointerdown', event => {
          if (event.isTrusted && event.pointerType === 'pen') Reflect.set(window, '__capabilityPen', true);
        }, { capture: true, once: true });
      });
      api.setStep('pen-drag');
      await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'pen' });
      await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen', force: 0.5 });
      for (let step = 1; step <= 4; step++) {
        await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + step * 12, y, button: 'left', buttons: 1, pointerType: 'pen', force: 0.5 });
        await api.frames(1, true);
      }
      await api.frames(12, true);
      await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + 48, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
      if (await api.page.evaluate(() => Reflect.get(window, '__capabilityPen')) !== true) throw new Error('No trusted pen input');
      await api.barrier('pen-rest', '/dione/');
    } finally { await session.detach(); }
  },
}, {
  id: 'capabilities-error-bootstrap', exercises: ['capability:directLoad'],
  async run(api) {
    const response = await api.load('/dione/', 'error-bootstrap');
    const html = await response?.text() ?? '';
    if (!html.includes('/.netlify/functions/report')) throw new Error('No production error bootstrap in served HTML');
    // Read the real gate, do not rewrite hostname or execute a copied bootstrap.
    if (await api.page.evaluate(() => ['css.earth', 'www.css.earth'].includes(location.hostname)) === false)
      throw new Error('Production error-report handlers do not bind on the authorized localhost origin');
  },
});
