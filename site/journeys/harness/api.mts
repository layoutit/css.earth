/** Journey API: stepped frames, observed completion barriers and public navigation events. */
import { setTimeout as delay } from 'node:timers/promises';
import type { Page } from 'playwright';
import type { recorder } from './recorder.mts';
export interface Journey { id: string; recipe?: import('./trace.mts').Json; exercises: string[]; orderings?: string[][]; run(api: ReturnType<typeof journeyApi>): Promise<void> }
export function journeyApi(page: Page, origin: string, record: Awaited<ReturnType<typeof recorder>>) {
  /** Protocol completion can precede native input delivery; acknowledge delivery before stepping fake time. */
  async function input(type: 'wheel' | 'keydown' | 'pointerdown' | 'pointerup', action: () => Promise<void>) {
    await page.evaluate(eventType => {
      Reflect.set(window, '__journeyInputDelivered', false);
      const listener = (event: Event) => {
        // Native events use the real document clock; wheel animation reads them beside fake RAF timestamps.
        if (eventType === 'wheel') Object.defineProperty(event, 'timeStamp', { value: performance.now(), configurable: true });
        if (!event.isTrusted || ((eventType === 'pointerdown' || eventType === 'pointerup') && (!(event instanceof PointerEvent) || event.pointerType !== 'mouse'))) return;
        Reflect.set(window, '__journeyInputDelivered', true);
      };
      const controller = new AbortController();
      Reflect.set(window, '__journeyInputController', controller);
      window.addEventListener(eventType, listener, { capture: true, once: true, signal: controller.signal });
    }, type);
    try {
      await action();
      const deadline = Date.now() + 5000;
      while (await page.evaluate(() => Reflect.get(window, '__journeyInputDelivered')) !== true) {
        if (Date.now() >= deadline) throw new Error(`Native ${type} input was not delivered`);
        await delay(2);
      }
      record.capability(type === 'wheel' ? 'capability:wheelTrackpad' : type === 'keydown' ? 'capability:keyboard' : 'capability:mouse');
    } finally {
      await page.evaluate(() => {
        const controller: unknown = Reflect.get(window, '__journeyInputController');
        if (!(controller instanceof AbortController)) throw new Error('Missing native input acknowledgement owner');
        controller.abort();
        Reflect.deleteProperty(window, '__journeyInputDelivered'); Reflect.deleteProperty(window, '__journeyInputController');
      });
    }
  }
  async function frames(count: number, settleIO = false) {
    for (let index = 0; index < count; index++) {
      // Native response/worker completion may schedule work after the prior status read.
      // Require a stable real-task window immediately before releasing the next fake frame.
      const deadline = Date.now() + 120000;
      let previous = '', quiet = 0;
      while (settleIO && record.scheduleWorkers && quiet < 2) {
        const state: unknown = await page.evaluate(() => {
          const probe: unknown = Reflect.get(window, '__journey');
          if (!probe || typeof probe !== 'object' || !('status' in probe) || typeof probe.status !== 'function') throw new Error('Missing recorder status');
          return probe.status();
        });
        if (!state || typeof state !== 'object' || !('jobs' in state) || typeof state.jobs !== 'number'
          || !('messages' in state) || typeof state.messages !== 'number' || !('mutations' in state) || typeof state.mutations !== 'number'
          || !('replies' in state) || typeof state.replies !== 'number') throw new Error('Malformed pre-frame state');
        if (state.jobs === 0 && record.inflight.size === 0 && 'replies' in state && state.replies === 0) break;
        const current = JSON.stringify([state.messages, state.mutations, 'replies' in state ? state.replies : 0]);
        quiet = state.jobs === 0 && record.inflight.size === 0 && current === previous ? quiet + 1 : 0;
        previous = current;
        if (Date.now() >= deadline) throw new Error('Pre-frame IO did not settle');
        if (quiet >= 2) {
          const released: unknown = await page.evaluate(() => {
            const probe: unknown = Reflect.get(window, '__journey');
            if (!probe || typeof probe !== 'object' || !('releaseWorkers' in probe) || typeof probe.releaseWorkers !== 'function') throw new Error('Missing worker scheduler');
            return probe.releaseWorkers();
          });
          if (typeof released !== 'number') throw new Error('Invalid worker release count');
          if (released > 0) { quiet = 0; previous = ''; }
        }
        if (quiet < 2) await delay(20);
      }
      record.advanceFrame();
      await page.clock.runFor(16); await delay(2);
      await page.evaluate(idle => { const probe: unknown = Reflect.get(window, '__journey');
        if (probe && typeof probe === 'object' && 'status' in probe && typeof probe.status === 'function') probe.status();
        if (idle && probe && typeof probe === 'object' && 'releaseIdle' in probe && typeof probe.releaseIdle === 'function') probe.releaseIdle();
      }, record.inflight.size === 0); }
  }
  async function barrier(name: string, route: string) {
    record.setStep(name);
    const startedFrame = record.frame();
    const deadline = Date.now() + 120000;
    let quiet = 0, previous = '', decoded = false, iterations = 0, busy = false, decodedGeneration = '';
    while (Date.now() < deadline) {
      if (busy) await delay(10); else await frames(1, true);
      const state: unknown = await page.evaluate(() => {
        const probe: unknown = Reflect.get(window, '__journey');
        if (!probe || typeof probe !== 'object' || !('status' in probe) || typeof probe.status !== 'function') throw new Error('Missing recorder status');
        return { ready: document.documentElement.dataset.ready, route: location.pathname, fonts: document.fonts.status, ...probe.status() };
      });
      if (!state || typeof state !== 'object' || !('ready' in state) || !('route' in state) || !('jobs' in state) || !('moving' in state)
        || !('idle' in state) || typeof state.idle !== 'number' || !('mutations' in state) || typeof state.mutations !== 'number' || !('messages' in state) || typeof state.messages !== 'number'
        || typeof state.jobs !== 'number' || typeof state.moving !== 'boolean' || !('fonts' in state)) throw new Error('Malformed barrier state');
      if (++iterations % 100 === 0) console.log('BARRIER', name, JSON.stringify(state), [...record.inflight].map(request => request.url()));
      busy = state.jobs > 0 || record.inflight.size > 0;
      if (state.ready !== 'true' && record.startupException()) throw new Error(`App exception at ${name}: ${record.startupException()}`);
      if (state.ready === 'error') throw new Error(`App failed at ${name}`);
      const current = `${state.mutations}/${state.messages}`;
      if (state.ready === 'true' && state.route === route && state.jobs === 0 && state.idle === 0 && !state.moving && record.inflight.size === 0 && state.fonts === 'loaded' && current === previous) quiet++;
      else quiet = 0;
      previous = current;
      // First require sixteen silent frames. Decoding only at the quiet endpoint avoids competing with app loading.
      if (quiet >= 16) {
        if (decoded && decodedGeneration === current) { record.quiet(startedFrame); await record.snapshot(name); return; }
        console.log('DECODING', name, current);
        let completed = false, decodeError: unknown;
        const decode = page.evaluate(() => {
          const probe: unknown = Reflect.get(window, '__journey');
          if (!probe || typeof probe !== 'object' || !('decode' in probe) || typeof probe.decode !== 'function') throw new Error('Missing decode barrier');
          return probe.decode();
        });
        void decode.then(() => { completed = true; }, error => { decodeError = error; completed = true; });
        const decodingDeadline = Math.min(deadline, Date.now() + 30000);
        while (!completed && Date.now() < decodingDeadline) await delay(10);
        if (!completed) throw new Error('Image/font decoding did not complete');
        if (decodeError) throw decodeError;
        decoded = true; decodedGeneration = current; quiet = 0;
      }
      await delay(5);
    }
    throw new Error(`Barrier ${name} timed out: ${route}, ${record.inflight.size} requests outstanding`);
  }
  async function load(url: string, name: string) {
    record.setStep(name);
    if (page.url() !== 'about:blank') await record.drain();
    const response = await page.goto(origin + url, { waitUntil: 'commit' });
    await barrier(name, new URL(url, origin).pathname);
    record.capability('capability:directLoad');
    record.startupEvidence(new URL(url, origin).pathname, await response?.text() ?? '');
    await record.combinationWitness();
    return response;
  }
  let acceptedFlights = 0;
  async function navigationWitness(interrupted = false) {
    if (!acceptedFlights || await page.evaluate(() => Reflect.get(window, '__journeyDocumentStayed')) !== true
      || await page.locator('html').getAttribute('data-ready') !== 'true') throw new Error('Missing completed resident navigation witness');
    record.capability('capability:inAppNavigation');
    if (interrupted) {
      if (acceptedFlights < 2) throw new Error('Interruption needs two accepted flights');
      record.capability('capability:interruptedNavigation');
    }
  }
  async function deepLinkWitness() {
    const url = new URL(page.url());
    if (url.searchParams.get('settings') !== '1' || await page.locator('html').getAttribute('data-ready') !== 'true') throw new Error('Missing restored deep-link witness');
    record.capability('capability:historyDeepLinks');
  }
  async function fly(id: string) {
    const accepted = await page.evaluate(objectId => {
      const query = new CustomEvent('objectnavigationquery', { bubbles: true, cancelable: true, detail: { objectId } });
      document.dispatchEvent(query);
      if (!query.defaultPrevented) return false;
      const event = new CustomEvent('objectnavigate', { bubbles: true, cancelable: true, detail: { objectId } });
      document.dispatchEvent(event); return event.defaultPrevented;
    }, id);
    if (!accepted) throw new Error(`App did not accept flight to ${id}`);
    acceptedFlights++;
  }
  return { page, frames, barrier, load, fly, input, navigationWitness, deepLinkWitness, playback: record.playback, setStep: record.setStep };
}
