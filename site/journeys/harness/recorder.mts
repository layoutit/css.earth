/** Five-family recorder: ordered transitions and explicit barrier observations. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page, Request } from 'playwright';
import { json, type Family, type Json, type Trace } from './trace.mts';
import { boundInitiators, type VolatileInitiator } from './volatile.mts';
import { canonicalTrace } from './canonical.mts';
import { historyValues } from './history.mts';
import { PROBE } from './probe.mts';
export const elements = ['.object-stage', '.object-input-surface', '.object-footer', '.object-sidebar', '.object-settings-panel', '.object-information-panel', '.prepared-context-marker', '.prepared-context-label', '[data-context-body]'];
export function normalized(value: Json, origin: string): Json {
  if (typeof value === 'string') return value.replaceAll(origin, '').replace(/http:\/\/(?:localhost|127\.0\.0\.1):\d+/gu, '');
  if (Array.isArray(value)) return value.map(entry => normalized(entry, origin));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalized(entry, origin)]));
  return value;
}
export async function recorder(page: Page, trace: Trace, origin: string, out: string, engine: string, options: { scheduleWorkers?: boolean; orderings?: string[][]; causalOrders?: { before: string; after: string }[]; volatileInitiators?: VolatileInitiator[] } = {}) {
  let step = 'startup', applicationFrame = 0, stepFrame = 0, stepStarted = Date.now();
  const requestSteps = new Map<Request, { frame: number; nativeStarted: number }>();
  // Native transport durations use declared frame ranges, never machine timestamps.
  const timing = (request?: Request) => {
    const start = request && requestSteps.get(request);
    const frame = Math.floor((Date.now() - (start?.nativeStarted ?? stepStarted)) / 16);
    const ceiling = [0, 1, 4, 16, 64, 256, 1024, 4096, 16384].find(limit => frame <= limit);
    const nativeFrameBound = ceiling === undefined ? '16385+'
      : String(ceiling === 0 ? 0 : ceiling === 1 ? 1 : ceiling / 4 + 1) + '..' + ceiling;
    return { frame: applicationFrame - (start?.frame ?? stepFrame), nativeFrameBound };
  };
  const initiators = new Map<string, Json[]>();
  const cdpRequests = new Map<string, { url: string; cache: string }>();
  const cdpByUrl = new Map<string, string[]>();
  let pageException: string | null = null;
  const historyPrefixes = new Map<string, string>();
  const pendingSizes = new Set<Promise<void>>();
  const inflight = new Set<Request>(), identities = new Map<Request, number>(), cache = new Map<string, string>();
  
  const add = (family: Family, input: unknown, screenshot?: string) => {
    const rows = trace.observations[family];
    rows.push({ sequence: rows.length, step, data: normalized(json(input), origin), ...(screenshot ? { screenshot } : {}) });
  };
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      add('errors', { source: 'foreign-request', url: url.href, message: 'Non-loopback request blocked' });
      await route.abort('blockedbyclient'); return;
    }
    await route.fallback();
  });
  if (options.scheduleWorkers) await page.addInitScript(() => { Reflect.set(window, '__journeyScheduleWorkers', true); });
  await page.addInitScript(PROBE);
  if (engine === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', event => {
      cdpRequests.set(event.requestId, { url: event.request.url, cache: 'network' });
      const ids = cdpByUrl.get(event.request.url) ?? []; ids.push(event.requestId); cdpByUrl.set(event.request.url, ids);
      const input: unknown = event.initiator;
      if (!input || typeof input !== 'object' || !('type' in input) || typeof input.type !== 'string') throw new Error('Invalid CDP initiator');
      const scripts: string[] = [];
      if ('url' in input && typeof input.url === 'string') scripts.push(input.url);
      if ('stack' in input && input.stack && typeof input.stack === 'object' && 'callFrames' in input.stack && Array.isArray(input.stack.callFrames)) {
        for (const frame of input.stack.callFrames) if (frame && typeof frame === 'object' && 'url' in frame && typeof frame.url === 'string' && frame.url) scripts.push(frame.url);
      }
      const list = initiators.get(event.request.url) ?? []; list.push(json({ type: input.type, scripts: [...new Set(scripts)].sort() }));
      initiators.set(event.request.url, list);
    });
    cdp.on('Network.requestServedFromCache', event => { const entry = cdpRequests.get(event.requestId); if (entry) entry.cache = 'memory-cache'; });
    cdp.on('Network.responseReceived', event => {
      const entry = cdpRequests.get(event.requestId);
      if (entry) { if (event.response.fromDiskCache) entry.cache = 'disk-cache'; if (event.response.fromServiceWorker) entry.cache = 'service-worker'; }
      const response: unknown = event.response;
      if (response && typeof response === 'object' && 'url' in response && typeof response.url === 'string') {
        cache.set(response.url, 'fromDiskCache' in response && response.fromDiskCache === true ? 'disk-cache'
          : 'fromServiceWorker' in response && response.fromServiceWorker === true ? 'service-worker' : 'network-or-memory');
      }
    });
  }
  page.context().on('request', request => {
    requestSteps.set(request, { frame: stepFrame, nativeStarted: stepStarted });
    const id = identities.size; identities.set(request, id); inflight.add(request);
    add('network', { kind: 'request', id, url: request.url(), method: request.method(), resourceType: request.resourceType(), observer: false, issue: timing(),
      redirectedFrom: request.redirectedFrom() ? identities.get(request.redirectedFrom()!) ?? null : null });
  });
  page.context().on('response', response => {
    const request = response.request(); const id = identities.get(request) ?? null;
    add('network', { kind: 'response', id, url: response.url(), status: response.status(), response: timing(request), responseStep: step,
      fromServiceWorker: response.fromServiceWorker(), cache: cache.get(response.url()) ?? (engine === 'webkit' ? 'unavailable-webkit' : 'not-reported') });
    if (new URL(response.url()).pathname.startsWith('/_astro/')) {
      const measured = (async () => {
        const header = await response.headerValue('content-length');
        const declared = header !== null && /^(?:0|[1-9][0-9]*)$/u.test(header) ? Number(header) : NaN;
        const bytes = Number.isSafeInteger(declared) && declared >= 0 ? declared : (await response.body()).length;
        add('network', { kind: 'asset-size', id, contentBytes: bytes, sizeClass: bytes === 0 ? 0 : Math.ceil(Math.log2(bytes)) });
      })().catch(error => add('errors', { source: 'asset-size-error', message: String(error) }));
      pendingSizes.add(measured); void measured.finally(() => pendingSizes.delete(measured));
    }
  });
  page.context().on('requestfinished', request => { inflight.delete(request); add('network', { kind: 'finished', id: identities.get(request) ?? null, url: request.url(), completion: timing(request), completionStep: step }); });
  page.context().on('requestfailed', request => {
    inflight.delete(request); const failure = request.failure()?.errorText ?? 'unknown';
    add('network', { kind: 'failed', id: identities.get(request) ?? null, failure, completion: timing(request), completionStep: step, cancelled: /abort|cancel/iu.test(failure) });
  });
  page.on('pageerror', error => { pageException = error.message; add('errors', { source: 'pageerror', message: error.message }); });
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) add('errors', { source: `console-${message.type()}`, message: message.text() }); });
  trace.volatile = [...trace.volatile ?? [], { family: 'content', feature: 'history-entry-random-prefix',
    subject: 'history.state.cssEarthEntry', cause: 'Application creates a random 128-bit prefix; alias each observed prefix, preserving serial and relationships.',
    bound: { prefixPattern: '32 lowercase hexadecimal characters', serialExact: true, otherFieldsExact: true } }];
  await mkdir(out, { recursive: true });
  async function drain() {
    const input: unknown = await page.evaluate(() => {
      const probe: unknown = Reflect.get(window, '__journey');
      if (!probe || typeof probe !== 'object' || !('drain' in probe) || typeof probe.drain !== 'function') throw new Error('Recorder not installed');
      return probe.drain();
    });
    const data = json(input);
    if (!data || Array.isArray(data) || typeof data !== 'object' || !Array.isArray(data.dom) || !Array.isArray(data.errors)) throw new Error('Invalid probe result');
    for (const row of data.dom) add('dom', row);
    for (const row of data.errors) add('errors', row);
  }
  return {
    scheduleWorkers: options.scheduleWorkers === true, inflight, drain,
    assertion(error: unknown) { add('errors', { source: 'journey-assertion', message: error instanceof Error ? error.message : String(error) }); },
    advanceFrame() { applicationFrame++; },
    frame() { return applicationFrame; },
    startupException() { return pageException; },
    quiet(start: number) { add('network', { kind: 'barrier-quiet', framesToQuiet: applicationFrame - start, nativeFrameBound: timing().nativeFrameBound }); },
    setStep(name: string) { if (name !== step) { step = name; stepFrame = applicationFrame; stepStarted = Date.now(); } },
    /** Native timeline time is uncontrolled; permission and prepared animation identity are exact. */
    async playback(name: string) {
      step = name;
      const input: unknown = await page.evaluate(() => document.getAnimations().map(animation => {
        const effect = animation.effect;
        const probe: unknown = Reflect.get(window, '__journey');
        if (!probe || typeof probe !== 'object' || !('subject' in probe) || typeof probe.subject !== 'function') throw new Error('Missing animation identity');
        const subject: unknown = effect instanceof KeyframeEffect && effect.target ? probe.subject(effect.target) : null;
        if (subject !== null && typeof subject !== 'string') throw new Error('Invalid animation subject');
        return { id: animation.id, subject, playState: animation.playState, playbackRate: animation.playbackRate,
          currentTime: typeof animation.currentTime === 'number' ? animation.currentTime : String(animation.currentTime) };
      }).sort((a, b) => JSON.stringify([a.subject, a.id]).localeCompare(JSON.stringify([b.subject, b.id]))));
      add('rendering', { playback: json(input) });
    },
    async snapshot(name: string) {
      await drain();
      const picture = `${name}.png`;
      // Playwright cancels infinite animations for capture and plays them on cleanup, including paused ones.
      // Restore the app's paused permission and pose rather than letting observation start its playback.
      await page.evaluate(() => {
        Reflect.set(window, '__journeyPausedAnimations', document.getAnimations().filter(animation => animation.playState === 'paused')
          .map(animation => ({ animation, time: animation.currentTime })));
      });
      try { await page.screenshot({ path: resolve(out, picture), timeout: 30000, animations: 'disabled', caret: 'hide' }); }
      finally {
        await page.evaluate(() => {
          const saved: unknown = Reflect.get(window, '__journeyPausedAnimations');
          if (!Array.isArray(saved)) throw new Error('Missing paused animation capture');
          for (const value of saved) {
            if (!value || typeof value !== 'object' || !('animation' in value) || !(value.animation instanceof Animation)
              || !('time' in value) || value.time !== null && typeof value.time !== 'number' && !(value.time instanceof CSSNumericValue)) throw new Error('Invalid paused animation capture');
            value.animation.pause(); value.animation.currentTime = value.time;
          }
          Reflect.deleteProperty(window, '__journeyPausedAnimations');
        });
      }
      const rendering: unknown = await page.evaluate(selectors => selectors.map(selector => ({ selector,
        nodes: [...document.querySelectorAll(selector)].map(element => {
          const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
          const probe: unknown = Reflect.get(window, '__journey');
          if (!probe || typeof probe !== 'object' || !('subject' in probe) || typeof probe.subject !== 'function') throw new Error('Missing subject identity');
          const subject: unknown = probe.subject(element); if (typeof subject !== 'string') throw new Error('Invalid subject identity');
          return { subject, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, style: Object.fromEntries(
            ['transform', 'opacity', 'display', 'visibility', 'z-index', 'will-change', 'background-position'].map(key => [key, style.getPropertyValue(key)])) };
        }).sort((a, b) => a.subject.localeCompare(b.subject)) })), elements);
      add('rendering', rendering, picture);
      const content: unknown = await page.evaluate(() => {
        return { title: document.title, url: location.href, history: { length: history.length, state: history.state },
          data: Object.fromEntries([...document.documentElement.attributes].filter(attribute => attribute.name.startsWith('data-')).map(attribute => [attribute.name, attribute.value])),
          focus: document.activeElement ? { tag: document.activeElement.localName, id: document.activeElement.id,
            name: document.activeElement.getAttribute('name'),
            text: document.activeElement instanceof HTMLElement ? document.activeElement.innerText : document.activeElement.textContent,
            value: document.activeElement instanceof HTMLInputElement ? document.activeElement.value : null } : null,
          text: ['.object-ui-layer', '.object-footer', '.object-sidebar'].map(selector => ({ selector,
            text: [...document.querySelectorAll(selector)].map(element => element instanceof HTMLElement ? element.innerText : element.textContent) })) };
      });
      const payload = json(content);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !payload.history
        || typeof payload.history !== 'object' || Array.isArray(payload.history)) throw new Error('Malformed recorded history');
      payload.history.state = historyValues(payload.history.state ?? null, historyPrefixes);
      add('content', payload);
      add('dom', { barrier: name, retained: await page.evaluate(selectors => selectors.map(selector => ({ selector,
        nodes: [...document.querySelectorAll(selector)].map(element => element.querySelectorAll('*').length) })), elements) });
    },
    async save() {
      await Promise.all([...pendingSizes]);
      await drain();
      const seen = new Map<string, number>();
      for (const row of trace.observations.network) {
        const data = row.data;
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.kind !== 'request' || typeof data.url !== 'string') continue;
        const absolute = new URL(data.url, origin).href, index = seen.get(absolute) ?? 0;
        seen.set(absolute, index + 1);
        if (engine === 'chromium') {
          data.initiator = normalized(initiators.get(absolute)?.[index] ?? 'unavailable-worker', origin);
          const id = cdpByUrl.get(absolute)?.[index], metadata = id ? cdpRequests.get(id) : undefined;
          for (const response of trace.observations.network) {
            const payload = response.data;
            if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.kind === 'response' && payload.id === data.id) payload.cache = metadata?.cache ?? 'unavailable-worker';
          }
        }
      }
      for (const declaration of options.causalOrders ?? []) {
        const events = trace.observations.network.flatMap(row => {
          const data = row.data;
          if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.url !== 'string') return [];
          return data.kind === 'finished' && data.url === declaration.before ? ['complete-before']
            : data.kind === 'request' && data.url === declaration.after ? ['issue-after'] : [];
        });
        add('network', { kind: 'causal-order', declaration, events });
      }
      for (const ordering of options.orderings ?? []) {
        const issued = trace.observations.network.flatMap(row => {
          const data = row.data;
          return data && typeof data === 'object' && !Array.isArray(data) && data.kind === 'request' && typeof data.url === 'string' && ordering.includes(data.url) ? [data.url] : [];
        });
        add('network', { kind: 'declared-order', declaration: ordering, issued });
      }
      await writeFile(resolve(out, `${trace.journey}.raw.json`), JSON.stringify(trace) + '\n');
      await writeFile(resolve(out, `${trace.journey}.trace.json`), JSON.stringify(canonicalTrace(boundInitiators(trace, options.volatileInitiators ?? [])), null, 2) + '\n'); },
  };
}
