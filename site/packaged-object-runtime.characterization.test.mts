import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { parseHTML } from 'linkedom';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as renderer from '@cssearth/renderer';
import { parsePreparedObjectRuntime, type PreparedWorldCameraFrame } from '@cssearth/objects';
import { characterizationRuntime } from './test/fixtures/characterization-runtime.mts';
import { unusedMountOptions, required } from './test/navigation-test-values.mts';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import * as runtimePolicy from './runtime-policy.mts';

const frame: PreparedWorldCameraFrame = { referenceFrame: 'ICRF', epochJdTt: 2451545, originM: [0, 0, 0], presentationToReference: [1, 0, 0, 0, 1, 0, 0, 0, -1], metersPerUnit: 1, bodyRadiusM: 1 };
const requests: { url: string; signal?: AbortSignal }[] = [];
let reference = 'prepared/object.json', status = 200, mountedOptions: unknown = null, configuration: unknown = null;
const mounted = { owner: 'mounted' };
mock.module('@cssearth/renderer', { namedExports: { ...renderer,
  createWorldContextObjectRuntime(config: unknown) { configuration = config; return (_stage: HTMLElement, options: unknown) => { mountedOptions = options; return mounted; }; },
  async loadNavigableObject(_descriptor: unknown, reader: { read(reference: string, signal?: AbortSignal): Promise<ArrayBuffer> }, _bind: unknown, signal?: AbortSignal) { return reader.read(reference, signal); },
} });
mock.module(new URL('./inside-view.mts', import.meta.url).href, { namedExports: { insideViewDescriptor: async (value: unknown) => value } });
mock.module(new URL('./startup-requests.mts', import.meta.url).href, { namedExports: {
  async startupFetch(url: string, options: { signal?: AbortSignal }) { requests.push({ url, signal: options.signal }); return new Response(new Uint8Array([1, 2, 3]), { status }); },
} });

const descriptor = (id = 'moon', url = 'prepared/object.json') => ({ schema: 'cssearth-object@2', id, type: 'layered-body', properties: { radiusKm: 1, layers: ['surface'] }, prepared: { format: 'example-artifact@1', url } });
let instance = 0;
async function subject(markup = '', reload = false) {
  const { document } = parseHTML(`<html><body>${markup}</body></html>`);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true });
  try {
    const url = new URL('./packaged-object-runtime.mts', import.meta.url);
    if (reload) url.searchParams.set('instance', String(++instance));
    return { api: await import(url.href) as typeof import('./packaged-object-runtime.mts'), document };
  } finally { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); }
}

const initial = await subject('<div class="object-input-surface"></div><div class="object-stage" data-prepared-object="moon"></div>');

test('packaged binding forwards options and supplies shared policy, capabilities, input and diagnostics', async t => {
  const root = await mkdtemp(join(tmpdir(), 'packaged-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'runtime.json');
  await writeFile(path, JSON.stringify({ ...characterizationRuntime(), id: 'moon' }));
  const definition = parsePreparedObjectRuntime(JSON.parse(await readFile(path, 'utf8')));
  const { api, document } = initial;
  const stage = required(document.querySelector<HTMLElement>('.object-stage'));
  const bind = api.bindPackagedObject(definition, frame);
  const onError = () => {};
  assert.equal(bind(stage, { ...unusedMountOptions, onError, arriving: true }), mounted);
  assert.deepEqual(configuration, { definition, context: undefined, frame });
  assert.deepEqual(mountedOptions, { ...unusedMountOptions, onError, arriving: true, runtimePolicy, capabilities: renderer.preparedObjectCapabilities, inputSurface: document.querySelector('.object-input-surface'), diagnostics: DIAGNOSTICS_ENABLED });
  document.querySelector('.object-input-surface')?.remove();
  assert.throws(() => bind(stage, { ...unusedMountOptions, onError }), /Missing shell element: \.object-input-surface\./);
});

test('initial server markup is adopted once, mismatched objects leave it available, and dataset/settings markup uses full bytes', async () => {
  reference = 'prepared/object.json'; status = 200; requests.length = 0;
  const { api } = initial;
  const signal = new AbortController().signal;
  assert.deepEqual(await api.loadPackagedObject(descriptor('earth'), signal), new Uint8Array([1, 2, 3]).buffer);
  await api.loadPackagedObject(descriptor('moon'), signal); await api.loadPackagedObject(descriptor('moon'), signal);
  assert.deepEqual(requests.map(request => request.url), ['/objects/earth/object.json', '/objects/moon/first-view.json', '/objects/moon/object.json']);
  assert.ok(requests.every(request => request.signal === signal));
  for (const attribute of ['data-prepared-dataset="normal"', 'data-prepared-settings="custom"']) {
    const next = await subject(`<div class="object-stage" data-prepared-object="moon" ${attribute}></div>`, true);
    await next.api.loadPackagedObject(descriptor()); assert.equal(requests.at(-1)?.url, '/objects/moon/object.json');
  }
  const empty = await subject('', true); await empty.api.loadPackagedObject(descriptor()); assert.equal(requests.at(-1)?.url, '/objects/moon/object.json');
});

test('packaged reader handles dataset references and rejects unavailable assets and response failures', async () => {
  const { api } = initial; status = 200;
  reference = 'prepared/datasets/clouds.json'; await api.loadPackagedObject(descriptor('earth')); assert.equal(requests.at(-1)?.url, '/objects/earth/datasets/clouds.json');
  reference = 'prepared/object.json';
  await assert.rejects(api.loadPackagedObject(descriptor('moon', 'prepared/other.json')), /Prepared object asset is not available: prepared\/object\.json\./);
  await assert.rejects(api.loadPackagedObject(descriptor('Moon')), /object.id must be a stable identifier/);
  await assert.rejects(api.loadPackagedObject(descriptor('moon.example')), /Prepared object asset is not available: prepared\/object\.json\./);
  status = 503; await assert.rejects(api.loadPackagedObject(descriptor('earth')), /Prepared object asset request failed: 503\./); status = 200;
  reference = 'missing.json'; await assert.rejects(api.loadPackagedObject(descriptor('earth')), /Prepared object asset is not available: missing\.json\./);
  reference = 'prepared/object.json';
});
