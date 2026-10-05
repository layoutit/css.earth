/** Renderer input through native Playwright input and Chromium's browser input protocol. */
import { setTimeout as delay } from 'node:timers/promises';
import type { CDPSession } from 'playwright';
import type { Journey } from './harness/api.mts';
import { json } from './harness/trace.mts';

type Api = Parameters<Journey['run']>[0];
const route = '/dione/';
const surface = '.object-input-surface';
/** The application tests changes in recent displacement; constant-speed motion deliberately does not throw. */
export function throwPoint(x: number, y: number, step: number) {
  return { x: x + step * step * 2, y: y + step * step / 2 };
}
async function centre(api: Api) {
  const input = api.page.locator(surface);
  if (!await input.isVisible()) throw new Error('Input surface is not visible');
  const box = await input.boundingBox();
  if (!box || box.width < 200 || box.height < 200) throw new Error('Input surface is too small');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (!await api.page.evaluate(({ x, y, selector }) => document.elementFromPoint(x, y)?.matches(selector), { ...point, selector: surface }))
    throw new Error('Input surface centre is occluded');
  return point;
}
async function matrix(api: Api) {
  return api.page.locator('.dione-scene').evaluate(element => getComputedStyle(element).transform);
}
async function changed(api: Api, before: string) {
  if (await matrix(api) === before) throw new Error('Input did not change the scene transform');
}
/** Observe public motion announcements; no application state is changed. */
async function watchMotion(api: Api) {
  await api.page.evaluate(() => {
    Reflect.set(window, '__inputMotion', { active: false, coasting: false, sawCoast: false });
    document.addEventListener('objectmotionchange', (event: Event) => {
      if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== 'object') throw new Error('Invalid motion announcement');
      const { active, coasting } = event.detail;
      if (typeof active !== 'boolean' || typeof coasting !== 'boolean') throw new Error('Invalid motion flags');
      const previous: unknown = Reflect.get(window, '__inputMotion');
      Reflect.set(window, '__inputMotion', { active, coasting, sawCoast: coasting || Boolean(previous && typeof previous === 'object' && Reflect.get(previous, 'sawCoast')) });
    }, true);
  });
}
async function requireCoast(api: Api) {
  if (!await api.page.evaluate(() => {
    const value: unknown = Reflect.get(window, '__inputMotion');
    return value && typeof value === 'object' && Reflect.get(value, 'coasting') === true;
  })) throw new Error('Release did not start a coast');
}
/** Every protocol action is acknowledged by a trusted event before the next fake frame. */
async function protocolInput(api: Api, type: string, pointerType: 'touch' | 'pen', action: () => Promise<unknown>) {
  await api.page.evaluate(({ type, pointerType }) => {
    Reflect.set(window, '__inputProtocolDelivered', false);
    const controller = new AbortController();
    Reflect.set(window, '__inputProtocolController', controller);
    window.addEventListener(type, event => {
      if (event.isTrusted && event instanceof PointerEvent && event.pointerType === pointerType)
        Reflect.set(window, '__inputProtocolDelivered', true);
    }, { capture: true, signal: controller.signal });
  }, { type, pointerType });
  try {
    await action();
    const deadline = Date.now() + 5000;
    while (await api.page.evaluate(() => Reflect.get(window, '__inputProtocolDelivered')) !== true) {
      if (Date.now() >= deadline) throw new Error(`Native ${pointerType} ${type} was not delivered`);
      await delay(2);
    }
  } finally {
    await api.page.evaluate(() => {
      const controller: unknown = Reflect.get(window, '__inputProtocolController');
      if (controller instanceof AbortController) controller.abort();
      Reflect.deleteProperty(window, '__inputProtocolController');
      Reflect.deleteProperty(window, '__inputProtocolDelivered');
    });
  }
}
async function chromiumInput(api: Api): Promise<CDPSession> {
  if (api.page.context().browser()?.browserType().name() !== 'chromium')
    throw new Error('Native pen/multitouch input needs a WebKit gesture API; see HARNESS-NEEDS.md');
  return api.page.context().newCDPSession(api.page);
}
const mouse: Journey = {
  id: 'input-mouse', exercises: [
    'capability:mouse',
    ...['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'lostpointercapture'].map(event => `handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:${event}:1`),
    ...['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'click', 'pointerleave'].map(event => `handler:packages:renderer:src:navigation:world-camera-picking:releases:${event}:1`),
    'handler:packages:renderer:src:solar-system:heliocentric-navigation:motionHold:objectmotionchange:1',
  ],
  async run(api) {
    await api.load(route, 'direct');
    const { x, y } = await centre(api), before = await matrix(api);
    api.setStep('orbit');
    await api.page.mouse.move(x, y);
    await api.input('pointerdown', () => api.page.mouse.down());
    for (let step = 1; step <= 8; step++) {
      await api.page.mouse.move(x + step * 8, y + step * 2);
      await api.frames(1, true);
    }
    await changed(api, before);
    // End on the held pose: this pair measures orbit independently of release inertia.
    await api.frames(12, true);
    await api.input('pointerup', () => api.page.mouse.up());
    await api.barrier('orbit', route);
    api.setStep('capture-outside');
    await api.page.mouse.move(x, y);
    await api.page.evaluate(() => {
      window.addEventListener('pointerdown', event => {
        if (event.isTrusted) Reflect.set(window, '__inputCapturedPointer', event.pointerId);
      }, { capture: true, once: true });
    });
    await api.input('pointerdown', () => api.page.mouse.down());
    if (!await api.page.locator(surface).evaluate(element => {
      const id: unknown = Reflect.get(window, '__inputCapturedPointer');
      return typeof id === 'number' && element.hasPointerCapture(id);
    })) throw new Error('Native press did not capture its pointer');
    await api.page.mouse.move(-10, -10);
    await api.frames(1, true);
    await api.frames(12, true);
    await api.input('pointerup', () => api.page.mouse.up());
    await api.barrier('capture-outside', route);
    api.setStep('leave');
    await api.page.mouse.move(x, y);
    await api.page.locator('.object-sidebar-search').hover();
    await api.frames(1, true);
    await api.barrier('leave', route);
  },
};
const wheel: Journey = {
  id: 'input-wheel', exercises: ['capability:wheelTrackpad',
    'handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:wheel:1',
    'handler:packages:renderer:src:navigation:prepared-wheel-zoom:releaseWheel:wheel:1',
    'handler:packages:renderer:src:navigation:world-camera-picking:releases:wheel:1'],
  async run(api) {
    await api.load(route, 'direct');
    const { x, y } = await centre(api);
    await api.page.mouse.move(x, y);
    for (const [name, delta, control] of [['wheel', -120, false], ['trackpad', 7, false], ['pinch', -12, true]] as const) {
      const before = await matrix(api);
      api.setStep(name);
      if (control) await api.page.keyboard.down('Control');
      try { await api.input('wheel', () => api.page.mouse.wheel(0, delta)); }
      finally { if (control) await api.page.keyboard.up('Control'); }
      await api.frames(1, true);
      await api.barrier(name, route);
      await changed(api, before);
    }
  },
};
const keyboard: Journey = {
  id: 'input-keyboard', exercises: ['capability:keyboard',
    'handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:dynamic-type:1',
    'handler:packages:renderer:src:solar-system:heliocentric-navigation:bindObjectNavigationTarget:keydown:1'],
  async run(api) {
    await api.load(route, 'direct');
    api.setStep('escape');
    await api.input('keydown', () => api.page.keyboard.press('Escape'));
    await api.barrier('escape', route);
    // Targets are pointer-transparent; their public keyboard path remains tabbable.
    api.setStep('focus-target');
    let found = false;
    for (let index = 0; index < 160; index++) {
      await api.page.keyboard.press('Tab');
      found = await api.page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.matches('[data-object-navigate][role="button"]') && document.activeElement.getBoundingClientRect().width > 0);
      if (found) break;
    }
    if (!found) throw new Error('No visible navigation target reached by Tab');
    await api.barrier('focus-target', route);
    const destination = await api.page.evaluate(() => document.activeElement?.getAttribute('data-object-navigate'));
    if (!destination) throw new Error('Focused target has no destination');
    api.setStep('activate-target');
    await api.input('keydown', () => api.page.keyboard.press('Enter'));
    await api.barrier('activate-target', `/${destination}/`);
    api.setStep('focus-out');
    await api.page.keyboard.press('Tab');
    await api.barrier('focus-out', `/${destination}/`);
  },
};
const coast: Journey = {
  id: 'input-coast', exercises: ['capability:mouse',
    'handler:packages:renderer:src:solar-system:heliocentric-navigation:motionHold:objectmotionchange:1'],
  async run(api) {
    await api.load(route, 'direct');
    await watchMotion(api);
    const { x, y } = await centre(api);
    api.setStep('throw');
    await api.page.mouse.move(x, y);
    await api.input('pointerdown', () => api.page.mouse.down());
    // The native throw gate compares recent displacement deltas: accelerate the hand before release.
    for (let step = 1; step <= 8; step++) {
      const point = throwPoint(x, y, step);
      await api.page.mouse.move(point.x, point.y);
      await api.frames(1, true);
    }
    await api.input('pointerup', () => api.page.mouse.up());
    await requireCoast(api);
    const released = await matrix(api);
    await api.frames(4, true);
    await changed(api, released);
    await api.barrier('coast-stopped', route);
  },
};
const pen: Journey = {
  id: 'input-pen', exercises: ['pointerdown', 'pointermove', 'pointerup', 'lostpointercapture'].map(event => `handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:${event}:1`),
  async run(api) {
    const cdp = await chromiumInput(api);
    try {
      await api.load(route, 'direct');
      const { x, y } = await centre(api), before = await matrix(api);
      api.setStep('pen-orbit');
      await protocolInput(api, 'pointerdown', 'pen', () => cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', pointerType: 'pen', button: 'left', buttons: 1, clickCount: 1, x, y, force: 0.5 }));
      for (let step = 1; step <= 8; step++) {
        await protocolInput(api, 'pointermove', 'pen', () => cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', pointerType: 'pen', button: 'left', buttons: 1, x: x + step * 8, y: y + step * 2, force: 0.5 }));
        await api.frames(1, true);
      }
      await changed(api, before);
      await api.frames(12, true);
      await protocolInput(api, 'pointerup', 'pen', () => cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', pointerType: 'pen', button: 'left', buttons: 0, clickCount: 1, x: x + 64, y: y + 16 }));
      await api.barrier('pen-orbit', route);
    } finally { await cdp.detach(); }
  },
};
function touchJourney(mode: 'orbit' | 'pinch' | 'cancel'): Journey {
  return { id: `input-touch-${mode}`, exercises: [
    ...['pointerdown', 'pointermove', mode === 'cancel' ? 'pointercancel' : 'pointerup'].map(event =>
      `handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:${event}:1`),
    ...(mode === 'pinch' ? ['handler:packages:renderer:src:navigation:prepared-wheel-zoom:releaseWheel:wheel:1'] : []),
  ],
    async run(api) {
      if (!await api.page.evaluate(() => navigator.maxTouchPoints > 0)) throw new Error('Touch journey needs mobile-touch or tablet profile');
      const cdp = await chromiumInput(api);
      try {
        await api.load(route, 'direct');
        const { x, y } = await centre(api), before = await matrix(api);
        api.setStep(`touch-${mode}`);
        await protocolInput(api, 'pointerdown', 'touch', () => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 32, y, id: 1 }] }));
        if (mode === 'pinch') {
          await protocolInput(api, 'pointerdown', 'touch', () => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 32, y, id: 1 }, { x: x + 32, y, id: 2 }] }));
        }
        for (let step = 1; step <= 8; step++) {
          const points = mode === 'pinch' ? [{ x: x - 32 - step * 4, y, id: 1 }, { x: x + 32 + step * 4, y, id: 2 }]
            : [{ x: x - 32 + step * 8, y: y + step * 2, id: 1 }];
          await protocolInput(api, 'pointermove', 'touch', () => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points }));
          await api.frames(1, true);
        }
        await changed(api, before);
        await api.frames(12, true);
        await protocolInput(api, mode === 'cancel' ? 'pointercancel' : 'pointerup', 'touch', () => cdp.send('Input.dispatchTouchEvent', { type: mode === 'cancel' ? 'touchCancel' : 'touchEnd', touchPoints: [] }));
        await api.barrier(`touch-${mode}`, route);
      } finally { await cdp.detach(); }
    },
  };
}

const doubleClick: Journey = {
  id: 'input-double-click', exercises: ['capability:mouse',
    'handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:dblclick:1',
    'handler:packages:renderer:src:navigation:world-camera-picking:releases:dblclick:1'],
  async run(api) {
    await api.load(route, 'direct');
    const { x, y } = await centre(api), before = await matrix(api);
    api.setStep('double-click');
    await api.input('pointerdown', () => api.page.mouse.dblclick(x + 24, y + 12));
    await api.barrier('surface-flight', route);
    await changed(api, before);
  },
};
const blur: Journey = {
  id: 'input-blur', exercises: [],
  async run(api) {
    await api.load(route, 'direct');
    const { x, y } = await centre(api);
    api.setStep('held-focus-loss');
    await api.page.mouse.move(x, y);
    await api.input('pointerdown', () => api.page.mouse.down());
    await api.page.mouse.move(x + 32, y + 8);
    await api.frames(1, true);
    await api.page.evaluate(() => {
      Reflect.set(window, '__inputBlurred', false);
      window.addEventListener('blur', event => {
        if (event.isTrusted) Reflect.set(window, '__inputBlurred', true);
      }, { once: true });
    });
    const other = await api.page.context().newPage();
    try {
      await other.bringToFront();
      if (await api.page.evaluate(() => Reflect.get(window, '__inputBlurred')) !== true)
        throw new Error('Headless tab focus change did not deliver native window blur');
    } finally { await other.close(); await api.page.bringToFront(); }
    // Blur clears picking hover; the camera still owns its press until real release.
    await api.frames(12, true);
    await api.input('pointerup', () => api.page.mouse.up());
    await api.barrier('released-after-blur', route);
  },
};

/** Native hover and picking through the transparent input owner, never a label force-click. */
const feature: Journey = {
  id: 'input-feature', exercises: [
    'handler:packages:renderer:src:labels:surface-feature-labels:mountSurfaceFeatureLabels:objectsurfacelabelschange:1',
    'handler:packages:renderer:src:labels:surface-feature-labels:mountSurfaceFeatureLabels:objecthoverchange:1',
    'handler:packages:renderer:src:labels:surface-feature-labels:createEntry:click:1',
  ],
  async run(api) {
    await api.load(route, 'direct');
    api.setStep('enable-feature-names');
    await api.page.locator('.object-settings-action').click();
    await api.barrier('settings-open', route);
    await api.page.locator('.object-surface-labels-setting-control').click();
    if (!await api.page.locator('.object-surface-labels-setting').isChecked()) throw new Error('Surface label setting did not turn on');
    await api.barrier('feature-names', route);
    await api.page.keyboard.press('Escape');
    await api.barrier('settings-closed', route);
    const center = await centre(api);
    await api.page.mouse.move(center.x, center.y);
    // Names have a prepared zoom gate; approach through the reader's wheel path.
    for (let notch = 1; notch <= 3; notch++) {
      api.setStep(`approach-features-${notch}`);
      await api.input('wheel', () => api.page.mouse.wheel(0, -120));
      await api.barrier(`approach-features-${notch}`, route);
    }
    const point = await api.page.locator('[data-feature-label]').evaluateAll(elements => {
      for (const element of elements) {
        const box = element.getBoundingClientRect(), style = getComputedStyle(element);
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        if (box.width > 0 && box.height > 0 && style.visibility === 'visible' && Number(style.opacity) > .5
          && document.elementFromPoint(x, y)?.matches('.object-input-surface')) return { x, y };
      }
      return null;
    });
    if (!point) throw new Error('No visible feature label has an unoccluded native pick point');
    api.setStep('hover-feature');
    await api.page.mouse.move(point.x, point.y);
    await api.frames(1, true);
    await api.barrier('hover-feature', route);
    const tooltip = api.page.locator('[data-feature-tooltip]');
    if (!await tooltip.isVisible()) throw new Error('Native feature hover did not reveal its caption');
    const featureId = await tooltip.getAttribute('data-feature-tooltip-for');
    if (!featureId) throw new Error('Hovered caption has no feature identity');
    api.setStep('pick-feature');
    await api.input('pointerdown', () => api.page.mouse.click(point.x, point.y));
    await api.barrier('pick-feature', route);
    if (new URL(api.page.url()).searchParams.get('feature') !== featureId)
      throw new Error('Native feature picking did not select the hovered feature');
    api.setStep('clear-feature');
    await api.input('keydown', () => api.page.keyboard.press('Escape'));
    await api.barrier('clear-feature', route);
    if (new URL(api.page.url()).searchParams.has('feature')) throw new Error('Escape did not clear feature selection');
  },
};
const viewport: Journey = {
  id: 'input-viewport', exercises: ['handler:packages:renderer:src:navigation:camera-viewport:createCameraViewport:resize:1'],
  async run(api) {
    await api.load(route, 'direct');
    const original = api.page.viewportSize();
    if (!original) throw new Error('Viewport journey needs an explicit viewport');
    api.setStep('resize');
    await api.page.setViewportSize({ width: original.width - 80, height: original.height - 48 });
    await api.barrier('resize', route);
    const box = await api.page.locator(surface).boundingBox();
    if (!box || box.width > original.width - 80 || box.height > original.height - 48)
      throw new Error('Input surface did not fit the resized viewport');
    api.setStep('restore-viewport');
    await api.page.setViewportSize(original);
    await api.barrier('restore-viewport', route);
  },
};

const hover: Journey = {
  id: 'input-hover', exercises: [
    'handler:packages:renderer:src:labels:surface-feature-labels:mountSurfaceFeatureLabels:objecthoverchange:1',
    'handler:packages:renderer:src:universe:prepared-world-context:mountPreparedWorldContext:objecthoverchange:1',
    'handler:packages:renderer:src:navigation:world-camera-picking:releases:pointerleave:1',
  ],
  async run(api) {
    await api.load(route, 'direct');
    const point = await api.page.locator('[data-object-navigate][role="button"]').evaluateAll(elements => {
      for (const element of elements) {
        const box = element.getBoundingClientRect(), style = getComputedStyle(element);
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        if (box.width > 0 && box.height > 0 && style.visibility === 'visible' && Number(style.opacity) > .5
          && document.elementFromPoint(x, y)?.matches('.object-input-surface')) return { x, y, id: element.getAttribute('data-object-navigate') };
      }
      return null;
    });
    if (!point?.id) throw new Error('No visible navigation target has an unoccluded native hover point');
    api.setStep('hover-target');
    await api.page.mouse.move(point.x, point.y);
    await api.frames(1, true);
    await api.barrier('hover-target', route);
    if (!await api.page.locator(`[data-object-navigate="${point.id}"][data-object-hovered="true"]`).count())
      throw new Error('Native hover did not mark the visible target');
    api.setStep('leave-target');
    await api.page.locator('.object-sidebar-search').hover();
    await api.frames(1, true);
    await api.barrier('leave-target', route);
    if (await api.page.locator('[data-object-navigate][data-object-hovered="true"]').count())
      throw new Error('Native pointerleave did not clear hover');
  },
};
const interruption: Journey = {
  id: 'input-interruption', exercises: ['capability:mouse',
    'handler:packages:renderer:src:navigation:camera-input-listeners:bindCameraInputListeners:lostpointercapture:1'],
  async run(api) {
    await api.load(route, 'direct');
    await watchMotion(api);
    const { x, y } = await centre(api);
    api.setStep('start-coast');
    await api.page.mouse.move(x, y);
    await api.input('pointerdown', () => api.page.mouse.down());
    for (let step = 1; step <= 8; step++) {
      const point = throwPoint(x, y, step);
      await api.page.mouse.move(point.x, point.y);
      await api.frames(1, true);
    }
    await api.input('pointerup', () => api.page.mouse.up());
    await requireCoast(api);
    await api.frames(4, true);
    api.setStep('interrupt-coast');
    await api.page.mouse.move(x, y);
    await api.input('pointerdown', () => api.page.mouse.down());
    if (!await api.page.evaluate(() => {
      const value: unknown = Reflect.get(window, '__inputMotion');
      return value && typeof value === 'object' && Reflect.get(value, 'coasting') === false;
    })) throw new Error('A new native press did not interrupt inertia');
    api.setStep('wheel-during-press');
    await api.input('wheel', () => api.page.mouse.wheel(0, 7));
    await api.input('pointerup', () => api.page.mouse.up());
    await api.barrier('interrupted', route);
    api.setStep('start-surface-flight');
    await api.input('pointerdown', () => api.page.mouse.dblclick(x + 24, y + 12));
    await api.frames(4, true);
    if (!await api.page.evaluate(() => {
      const value: unknown = Reflect.get(window, '__inputMotion');
      return value && typeof value === 'object' && Reflect.get(value, 'active') === true;
    })) throw new Error('Double click did not start a surface flight');
    api.setStep('interrupt-surface-flight');
    await api.page.mouse.move(x, y);
    await api.input('pointerdown', () => api.page.mouse.down());
    await api.frames(12, true);
    await api.input('pointerup', () => api.page.mouse.up());
    await api.barrier('surface-flight-interrupted', route);
  },
};

export const journeys: Journey[] = [mouse, wheel, keyboard, coast, pen, doubleClick, blur, touchJourney('orbit'), touchJourney('pinch'), touchJourney('cancel'), feature, viewport, hover, interruption];
// Qualification must expire when a shared action/assertion changes, as well as when run() changes.
for (const journey of journeys) journey.recipe = json({ route, surface, helpers: [centre, matrix, changed, watchMotion, requireCoast, protocolInput, chromiumInput].map(String), mode: journey.id, ...(['input-coast', 'input-interruption'].includes(journey.id) ? { throwPoint: String(throwPoint) } : {}) });
