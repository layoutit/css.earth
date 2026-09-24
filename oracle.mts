// Replay oracle: main's surface feature labels and the refactor receive identical scripted input.
// Records every transport request, stats() snapshot, catalogue and loaded() promise state, onError call,
// pending frame count and written label text; the two traces must be identical.
import { parseHTML } from 'linkedom';
import { readFileSync, writeFileSync } from 'node:fs';
import { createSceneLifetime } from '@cssearth/engine';

type Labels = {
  setPlaying(value: boolean): void; setLens(lens: { id: string | null }): void; setNavigationInFlight(active: boolean, landed?: boolean): void;
  loaded(): Promise<{ features: readonly unknown[] }>; catalog(): { features: readonly unknown[] } | null; stats(): unknown;
  inspect(): { labels: Record<string, { textContent: string | null }> }; destroy(): void;
};
type Module = { mountSurfaceFeatureLabels(options: Record<string, unknown>): Labels; createCameraMotion(): unknown };
const here = new URL('.', import.meta.url);
const variants: Record<string, Module> = {
  main: await import(new URL('labels-main.mjs', here).href) as Module,
  change: await import(new URL('labels-change.mjs', here).href) as Module,
};
const plan = JSON.parse(readFileSync(new URL('callisto-plan.json', here), 'utf8'));
const catalogue = readFileSync(new URL('callisto-features.json', here), 'utf8');
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

interface World {
  labels: Labels; frame(): Promise<void>; frames(count: number): Promise<void>; labelsOn(on: boolean): void;
  press(): void; key(key: string): void; respond(kind: 'ok' | 'error' | '404'): Promise<void>; snapshot(label: string): Promise<void>;
  requestLoaded(): void; destroy(): void;
}
async function run(variant: Module, script: (world: World) => Promise<void>) {
  const trace: unknown[][] = [];
  const { document, window } = parseHTML('<html><body><div id="host"><div id="scene"><div id="mesh"></div></div></div></body></html>');
  const frames = new Map<number, (time: number) => void>();
  let next = 0, now = 0;
  Object.assign(window, {
    requestAnimationFrame: (callback: (time: number) => void) => { frames.set(++next, callback); return next; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  });
  const pendingResponses: ((kind: 'ok' | 'error' | '404') => void)[] = [];
  const lifetime = createSceneLifetime();
  const host = document.getElementById('host')!;
  const unused = (): never => { throw new Error('The oracle must not navigate.'); };
  const labels = variant.mountSurfaceFeatureLabels({ host, plan, objectId: 'callisto', target: document.getElementById('mesh')!,
    pickingHost: host, inputSurface: host, flightLimits: unused,
    navigation: { motion: variant.createCameraMotion(), frame: { referenceFrame: 'test', epochJdTt: 1, originM: [0, 0, 0], presentationToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 },
      capture: unused, apply: unused, preparedFocus: unused, setPreparedFocus: unused, flyToPreparedFocus: unused, optics: unused, subscribe: unused },
    scene: document.getElementById('scene')!, zoomRange: () => ({ minimum: 1, maximum: 2 }), lifetime,
    onError: (error: unknown) => trace.push(['onError', String(error)]),
    transport: (url: string) => { trace.push(['transport', url]); return new Promise<Response>((resolve, reject) => pendingResponses.push(kind =>
      kind === 'error' ? reject(new Error('network down')) : resolve(new Response(kind === 'ok' ? catalogue : 'missing', { status: kind === 'ok' ? 200 : 404 })))); } });
  const fire = (target: EventTarget, type: string, props: Record<string, unknown> = {}) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
  };
  const world: World = {
    labels,
    async frame() { now += 16; const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now); await settle(); },
    async frames(count) { for (let i = 0; i < count; i++) await world.frame(); },
    labelsOn(on) { document.body.dataset.surfaceLabels = on ? 'on' : 'off'; fire(document.body, 'objectsurfacelabelschange'); },
    press() { fire(window, 'pointerdown', { isPrimary: true, clientX: 10, clientY: 10, button: 0 }); },
    key(key) { fire(window, 'keydown', { key }); },
    async respond(kind) { const respond = pendingResponses.shift(); trace.push(['respond', kind, respond !== undefined]); respond?.(kind); await settle(); await settle(); },
    async snapshot(label) {
      await settle();
      const catalog = labels.catalog(), written = Object.values(labels.inspect().labels).filter(label => label.textContent).length;
      trace.push(['stats', label, JSON.stringify(labels.stats()), catalog?.features.length ?? null, written, frames.size]);
    },
    requestLoaded() {
      const id = trace.length;
      trace.push(['loaded()', id]);
      labels.loaded().then(catalog => trace.push(['loaded() resolved', id, catalog.features.length]), error => trace.push(['loaded() rejected', id, String(error)]));
    },
    destroy() { lifetime.destroy(); trace.push(['destroyed']); },
  };
  await script(world);
  await world.snapshot('end');
  if (!('destroyed' in Object.fromEntries(trace.map(entry => [entry[0], true])))) world.destroy();
  await settle();
  trace.push(['frames after', frames.size]);
  return trace;
}

const loadedOn = async (w: World) => { w.labelsOn(true); await w.snapshot('requested'); await w.respond('ok'); await w.snapshot('fetched'); await w.frames(3); await w.snapshot('populated'); };
const scenarios: Record<string, (w: World) => Promise<void>> = {
  'labels off: interaction requests nothing': async w => { w.press(); w.key('a'); await w.snapshot('off'); w.labelsOn(true); await w.snapshot('on'); },
  'labels on load, populate in two batches, then loaded': async w => { w.requestLoaded(); await loadedOn(w); w.press(); await w.snapshot('pressed again'); },
  'second request while fetching fetches once': async w => { w.labelsOn(true); w.press(); w.key('x'); w.requestLoaded(); await w.snapshot('requests'); await w.respond('ok'); await w.frames(3); await w.snapshot('loaded'); },
  'flight holds the load until it lands': async w => {
    w.labels.setNavigationInFlight(true); w.labelsOn(true); w.press(); await w.snapshot('held');
    w.labels.setNavigationInFlight(true); w.labels.setNavigationInFlight(false, true); await w.snapshot('landed'); await w.respond('ok'); await w.frames(3); await w.snapshot('loaded');
  },
  'replaced flight drops the held load': async w => {
    w.labels.setNavigationInFlight(true); w.labelsOn(true); await w.snapshot('held'); w.labels.setNavigationInFlight(false, false); await w.snapshot('dropped');
    w.key('a'); await w.snapshot('requested after'); await w.respond('ok'); await w.frames(3); await w.snapshot('loaded');
  },
  'explicit load during a flight starts at once': async w => {
    w.labels.setNavigationInFlight(true); w.labelsOn(true); w.requestLoaded(); await w.snapshot('explicit');
    w.labels.setNavigationInFlight(false, true); await w.snapshot('landed'); await w.respond('ok'); await w.frames(3); await w.snapshot('loaded');
  },
  'network failure reports once and stays failed': async w => { w.requestLoaded(); w.labelsOn(true); await w.respond('error'); await w.snapshot('failed'); w.press(); w.requestLoaded(); await w.snapshot('retry ignored'); },
  'HTTP 404 fails with the catalogue message': async w => { w.labelsOn(true); await w.respond('404'); await w.snapshot('failed'); },
  'destroy while idle': async w => { w.destroy(); await w.snapshot('destroyed idle'); w.labelsOn(true); await w.snapshot('after'); },
  'destroy while held': async w => { w.labels.setNavigationInFlight(true); w.labelsOn(true); await w.snapshot('held'); w.destroy(); w.labels.setNavigationInFlight(false, true); await w.snapshot('landed after destroy'); },
  'destroy while fetching': async w => { w.labelsOn(true); w.requestLoaded(); w.destroy(); await w.respond('ok'); await w.snapshot('destroyed fetching'); },
  'destroy while populating': async w => { w.labelsOn(true); w.requestLoaded(); await w.respond('ok'); await w.snapshot('first batch'); w.destroy(); await w.frames(2); await w.snapshot('destroyed populating'); },
  'frame loop follows playing and the labels switch': async w => {
    w.labels.setPlaying(true); await w.frames(2); await w.snapshot('playing, labels off');
    w.labelsOn(true); await w.frames(2); await w.snapshot('labels on');
    w.labels.setPlaying(false); await w.snapshot('pause requested'); await w.frames(2); await w.snapshot('paused');
    w.labels.setPlaying(true); await w.snapshot('resumed'); w.labelsOn(false); await w.snapshot('off requested'); await w.frames(2); await w.snapshot('labels off');
    w.labelsOn(true); await w.respond('ok'); await w.frames(4); w.labels.setLens({ id: 'normal' }); await w.frames(2); await w.snapshot('loaded and lens');
  },
};
if (process.argv[2] === 'trace') { console.log((await run(variants.change, scenarios['labels on load, populate in two batches, then loaded'])).map(entry => JSON.stringify(entry).slice(0, 150)).join('\n')); process.exit(0); }
let identical = 0;
const report: Record<string, unknown> = {};
for (const [name, script] of Object.entries(scenarios)) {
  const main = await run(variants.main, script), change = await run(variants.change, script);
  const index = main.findIndex((entry, i) => JSON.stringify(entry) !== JSON.stringify(change[i]));
  const same = index === -1 && main.length === change.length;
  if (same) identical++;
  const fetches = main.filter(entry => entry[0] === 'transport').length, last = main.filter(entry => entry[0] === 'stats').at(-2) ?? [];
  report[name] = { records: main.length, fetches, identical: same, ...(same ? {} : { firstDifference: { main: main[index] ?? null, change: change[index] ?? null } }) };
  console.log(`${same ? 'same' : 'DIFF'}  ${name}  (${main.length} records, ${fetches} fetches, last stats ${String(last[2] ?? '').slice(0, 60)})`);
  if (!same) console.log('   main:  ', JSON.stringify(main[index]).slice(0, 300), '\n   change:', JSON.stringify(change[index]).slice(0, 300));
}
writeFileSync(new URL('oracle-report.json', here), JSON.stringify(report, null, 1));
console.log(`${identical}/${Object.keys(scenarios).length} scenarios identical`);
