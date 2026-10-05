/** Normalization qualification: remove unrelated interleaving, retain every owned regression. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalDom, canonicalNetwork, traceHistogram, ambiguousChunks, canonicalTrace } from './canonical.mts';
import { compareTraces } from './differ.mts';
import { type Family, type Json, type Observation, type Trace } from './trace.mts';

function observations(data: Json[]): Observation[] {
  return data.map((entry, sequence) => ({ sequence, step: 'ready', data: entry }));
}
function trace(family: Family, rows: Observation[]): Trace {
  return { schema: 'cssearth-journey@1', journey: 'normalization', profile: 'chromium-desktop',
    toolchain: {}, exercises: ['capability:directLoad'],
    observations: { network: [], dom: [], rendering: [], content: [], errors: [], [family]: rows.map((row, sequence) => ({ ...row, sequence })) } };
}
function exactFamily(family: Family, base: Observation[], head: Observation[]) {
  assert.deepEqual(compareTraces(trace(family, base), trace(family, base)), []);
  const differences = compareTraces(trace(family, base), trace(family, head));
  assert.equal(differences.length, 1);
  assert.equal(differences[0]?.family, family);
}
function request(id: number, url: string, changes: Record<string, Json> = {}): Json {
  return { kind: 'request', id, url, method: 'GET', resourceType: 'fetch', redirectedFrom: null,
    initiator: { type: 'script', scripts: ['/startup.mjs'] }, ...changes };
}
function response(id: number, url: string, changes: Record<string, Json> = {}): Json {
  return { kind: 'response', id, url, status: 200, cache: 'network-or-memory', fromServiceWorker: false, ...changes };
}
const finished = (id: number): Json => ({ kind: 'finished', id });
function network(changes: Record<string, Json> = {}): Observation[] {
  return observations([request(0, '/a'), response(0, '/a', changes), finished(0)]);
}
const dom = (subject: string, key: string, changes: Record<string, Json> = {}): Json => ({
  subject, key, value: '', before: null, moving: false, coasting: false, classification: 'OFF-PATH/REST', ...changes,
});

test('concurrent request issue and response permutation has an identical multiset', () => {
  const a = observations([request(0, '/a'), request(1, '/b'), response(1, '/b'), finished(1), response(0, '/a'), finished(0)]);
  const b = observations([request(7, '/b'), request(8, '/a'), response(8, '/a'), finished(8), response(7, '/b'), finished(7)]);
  assert.deepEqual(canonicalNetwork(a), canonicalNetwork(b));
  assert.deepEqual(compareTraces(trace('network', a), trace('network', b)), []);
});
test('duplicate request count remains exact after concurrent aggregation', () => {
  const repeated = observations([request(0, '/a'), request(1, '/a'), response(0, '/a'), response(1, '/a'), finished(1), finished(0)]);
  assert.deepEqual(canonicalNetwork(repeated).map(row => row.data), [
    { url: '/a', method: 'GET', resourceType: 'fetch', redirectedFrom: null,
      initiator: { type: 'script', scripts: ['/startup.mjs'] }, status: 200, cache: 'network-or-memory',
      fromServiceWorker: false, outcome: 'finished', count: 2 },
  ]);
  exactFamily('network', network(), repeated);
});
const responseMutations: Record<string, Record<string, Json>> = { status: { status: 503 }, cache: { cache: 'disk-cache' },
  serviceWorker: { fromServiceWorker: true } };
for (const [name, changes] of Object.entries(responseMutations)) {
  test(`network ${name} survives multiset normalization`, () => exactFamily('network', network(), network(changes)));
}
for (const [name, failure, cancelled] of [
  ['failure', 'net::ERR_CONNECTION_RESET', false], ['cancellation', 'net::ERR_ABORTED', true],
] as const) {
  test(`network ${name} survives multiset normalization`, () => {
    const failed = observations([request(0, '/a'), { kind: 'failed', id: 0, failure, cancelled }]);
    exactFamily('network', network(), failed);
    exactFamily('network', failed, observations([request(0, '/a'), { kind: 'failed', id: 0, failure, cancelled: !cancelled }]));
  });
}
test('redirect identities normalize but redirect destination changes stay red', () => {
  const chain = (a: number, b: number, target: string) => observations([
    request(a, '/a'), response(a, '/a', { status: 302 }), finished(a),
    request(b, target, { redirectedFrom: a }), response(b, target), finished(b),
  ]);
  assert.deepEqual(canonicalNetwork(chain(0, 1, '/b')), canonicalNetwork(chain(8, 9, '/b')));
  exactFamily('network', chain(0, 1, '/b'), chain(0, 1, '/c'));
  const redirected = observations([request(0, '/a'), response(0, '/a'), finished(0),
    request(1, '/b', { redirectedFrom: 0 }), response(1, '/b'), finished(1)]);
  const independent = observations([request(0, '/a'), response(0, '/a'), finished(0),
    request(1, '/b'), response(1, '/b'), finished(1)]);
  exactFamily('network', redirected, independent);
});
test('declared dependent request order is retained separately from the multiset', () => {
  const declaration = ['/a', '/b'];
  const ordered = [...network(), ...observations([{ kind: 'declared-order', declaration, issued: ['/a', '/b'] }])];
  const swapped = [...network(), ...observations([{ kind: 'declared-order', declaration, issued: ['/b', '/a'] }])];
  exactFamily('network', ordered, swapped);
});
test('proven initiator changes remain a network difference', () => {
  const base = network();
  const head = observations([request(0, '/a', { initiator: { type: 'script', scripts: ['/other.mjs'] } }), response(0, '/a'), finished(0)]);
  exactFamily('network', base, head);
});
test('network step attribution remains exact', () => {
  exactFamily('network', network(), network().map(row => ({ ...row, step: 'later' })));
});
test('independent cross-subject interleaving normalizes with exact per-subject lifecycles', () => {
  const attachA = dom('a@0', 'div <+span>'), attachB = dom('b@0', 'div <+span>');
  const detachA = dom('a@0', 'div <-span>'), detachB = dom('b@0', 'div <-span>');
  const a = observations([attachA, attachB, detachA, detachB]);
  const b = observations([attachB, detachB, attachA, detachA]);
  assert.deepEqual(canonicalDom(a), canonicalDom(b));
  assert.deepEqual(compareTraces(trace('dom', a), trace('dom', b)), []);
});
test('per-subject DOM write order survives normalization', () => {
  const base = observations([dom('a@0', 'div [data-state]', { value: 'loading' }), dom('a@0', 'div [data-state]', { value: 'ready' })]);
  exactFamily('dom', base, observations([...base].reverse().map(row => row.data)));
});
test('transient attach and detach stays red despite equal final membership', () => {
  exactFamily('dom', [], observations([dom('transient@0', 'div <+span>'), dom('transient@0', 'div <-span>')]));
});
test('style write classification stays exact within a subject lifecycle', () => {
  const base = observations([dom('retained@0', 'div { transform }', { value: 'translateX(1px)', classification: 'ALLOWED/COASTING', coasting: true })]);
  const head = observations([dom('retained@0', 'div { transform }', { value: 'translateX(1px)', classification: 'OFF-PATH/COASTING', coasting: true })]);
  exactFamily('dom', base, head);
});
test('duplicate DOM writes and retained barrier counts stay exact', () => {
  const write = dom('retained@0', 'div { transform }', { value: 'translateX(1px)' });
  exactFamily('dom', observations([write]), observations([write, write]));
  exactFamily('dom', observations([{ barrier: 'ready', retained: [{ selector: '.object-stage', nodes: [1] }] }]),
    observations([{ barrier: 'ready', retained: [{ selector: '.object-stage', nodes: [2] }] }]));
});
test('DOM subject identity and barrier ownership remain exact', () => {
  exactFamily('dom', observations([dom('a@0', 'div { transform }')]), observations([dom('b@0', 'div { transform }')]));
  exactFamily('dom', observations([dom('a@0', 'div { transform }')]), observations([dom('a@0', 'div { transform }')]).map(row => ({ ...row, step: 'later' })));
});
test('histogram exposes normalized family path templates without suppressing comparison', () => {
  const base = trace('network', network()), head = trace('network', network({ status: 503 }));
  const histogram = traceHistogram(base, head);
  assert.equal(histogram.get('$.network[*].data.status'), 1);
  assert.equal(histogram.size, 1);
  assert.equal(compareTraces(base, head)[0]?.family, 'network');
  assert.deepEqual([...traceHistogram(base, base)], []);
});

test('chunk suffixes normalize only at comparison; raw input stays unchanged', () => {
  const chunk = (hash: string) => observations([request(0, `/_astro/startup.${hash}.js`), response(0, `/_astro/startup.${hash}.js`), finished(0)]);
  const a = trace('network', chunk('Abcd1234')), b = trace('network', chunk('Zyxw9876'));
  const before = JSON.stringify(a);
  assert.deepEqual(compareTraces(a, b), []);
  assert.equal(JSON.stringify(a), before);
});
for (const dimension of ['count', 'name', 'status', 'failure', 'cancellation', 'order'] as const) {
  test(`hashed chunk ${dimension} remains network-red`, () => {
    const url = '/_astro/startup.Abcd1234.js', other = '/_astro/startup.Zyxw9876.js';
    const base = observations([request(0, url), response(0, url), finished(0)]);
    let head = observations([request(0, other), response(0, other), finished(0)]);
    if (dimension === 'count') head.push(...observations([request(1, other), response(1, other), finished(1)]));
    if (dimension === 'name') head = observations([request(0, '/_astro/different.Zyxw9876.js'), response(0, '/_astro/different.Zyxw9876.js'), finished(0)]);
    if (dimension === 'status') head = observations([request(0, other), response(0, other, { status: 503 }), finished(0)]);
    if (dimension === 'failure' || dimension === 'cancellation') head = observations([request(0, other), { kind: 'failed', id: 0, failure: 'net::ERR_ABORTED', cancelled: dimension === 'cancellation' }]);
    if (dimension === 'order') {
      base.push(...observations([{ kind: 'declared-order', issued: [url, '/world/anywhere.json'] }]));
      head.push(...observations([{ kind: 'declared-order', issued: ['/world/anywhere.json', other] }]));
    }
    exactFamily('network', base, head);
  });
}

test('chunk suffix normalization covers extensions, queries, declarations and inline references', () => {
  const value = (hash: string) => observations([{ script: `import('/_astro/entry.${hash}.mjs?mode=1')`,
    css: `url("/_astro/font.${hash}.woff2")`, keep: '/images/photo.Abcd1234.png' }]);
  assert.deepEqual(compareTraces(trace('content', value('Abcd1234')), trace('content', value('Zyxw9876'))), []);
  exactFamily('content', value('Abcd1234'), observations([{ script: "import('/_astro/other.Zyxw9876.mjs?mode=1')", css: 'url("/_astro/font.Zyxw9876.woff2")', keep: '/images/photo.Abcd1234.png' }]));
});

test('deleted chunk suffix, count, name and status protections turn their focused tests red', async () => {
  const parent = resolve('output/journeys'); await mkdir(parent, { recursive: true });
  const root = await mkdtemp(resolve(parent, 'deleted-chunk-'));
  const exec = promisify(execFile), original = await readFile(resolve(import.meta.dirname, 'canonical.mts'), 'utf8');
  try {
    for (const name of ['trace.mts', 'canonical.mts', 'canonical.test.mts', 'differ.mts', 'png.mts'])
      await copyFile(resolve(import.meta.dirname, name), resolve(root, name));
    for (const [before, after, pattern] of [
      ["if (compareChunks) trace = parseTrace(canonicalChunkNames(json(trace), trace.chunkAmbiguities));", '', 'chunk suffixes normalize only'],
      ['count: row.count', 'count: 1', 'hashed chunk count'],
      ['extra.push({ step: row.step, data: row.data });', "if (data?.kind !== 'declared-order') extra.push({ step: row.step, data: row.data });", 'declared dependent request order'],
      ['`/_astro/${name}.HASH.${extension}`', '`/_astro/IGNORED.HASH.${extension}`', 'hashed chunk name'],
      ['delete data.id; delete data.kind;', 'delete data.id; delete data.kind; delete data.status;', 'hashed chunk status'],
    ] as const) {
      assert.ok(original.includes(before));
      await writeFile(resolve(root, 'canonical.mts'), original.replace(before, after));
      await assert.rejects(exec(process.execPath, ['--test', '--test-name-pattern', pattern, resolve(root, 'canonical.test.mts')],
        { env: { ...process.env, NODE_TEST_CONTEXT: undefined } }), error => error instanceof Error && 'code' in error && error.code === 1
          && 'stdout' in error && typeof error.stdout === 'string' && error.stdout.includes('not ok 1 - ' + pattern));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const [name, extension] of [['object-directory', 'js'], ['elevation', 'webp'], ['normal', 'webp'], ['worker', 'js']] as const) {
  test(`ambiguous ${name} assets cannot merge A B into A A`, () => {
    const a = `/_astro/${name}.Abcd1234.${extension}`, b = `/_astro/${name}.Zyxw9876.${extension}`;
    const ambiguity = ambiguousChunks([a, b]);
    assert.deepEqual(ambiguity, [a, b].sort());
    const make = (urls: string[]) => ({ ...trace('network', observations(urls.flatMap((url, id) => [request(id, url), response(id, url, { contentBytes: 100 }), finished(id)]))), chunkAmbiguities: ambiguity });
    assert.deepEqual(compareTraces(make([a, b]), make([a, b])), []);
    assert.equal(compareTraces(make([a, b]), make([a, a]))[0]?.family, 'network');
    // Ambiguity is discovered in the build even if only one member was observed.
    assert.equal(compareTraces(make([a]), make([b]))[0]?.family, 'network');
  });
}
test('response size class stays exact', () => {
  exactFamily('network', network({ contentBytes: 100, sizeClass: 7 }), network({ contentBytes: 200, sizeClass: 8 }));
});
test('worker dash suffix is canonicalized when unique', () => {
  const rows = (hash: string) => observations([request(0, `/_astro/worker-${hash}.js`), response(0, `/_astro/worker-${hash}.js`), finished(0)]);
  assert.deepEqual(compareTraces(trace('network', rows('Abcd1234')), trace('network', rows('Zyxw9876'))), []);
});

test('multi-step identical requests cannot merge across steps', () => {
  const base = [...network(), ...network().map(row => ({ ...row, step: 'later', data: (() => {
    const value = row.data;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request fixture');
    return { ...value, id: 1 };
  })() }))];
  exactFamily('network', base, base.map(row => ({ ...row, step: 'ready' })));
});
test('multi-step identical DOM subjects cannot merge across steps', () => {
  const base = [...observations([dom('same@0', 'div [data-state]', { value: 'ready' })]),
    ...observations([dom('same@0', 'div [data-state]', { value: 'ready' })]).map(row => ({ ...row, step: 'later' }))];
  exactFamily('dom', base, base.map(row => ({ ...row, step: 'ready' })));
});
test('deleting step identity or lifecycle order turns its detector red', async () => {
  const parent = resolve('output/journeys'); await mkdir(parent, { recursive: true });
  const root = await mkdtemp(resolve(parent, 'deleted-step-'));
  const exec = promisify(execFile), original = await readFile(resolve(import.meta.dirname, 'canonical.mts'), 'utf8');
  try {
    for (const name of ['trace.mts', 'canonical.mts', 'canonical.test.mts', 'differ.mts', 'png.mts'])
      await copyFile(resolve(import.meta.dirname, name), resolve(root, name));
    for (const [before, after, pattern] of [
      ['stableKey([request.step, data])', 'stableKey(data)', 'multi-step identical requests'],
      ['JSON.stringify([row.step, data.subject])', 'JSON.stringify(data.subject)', 'multi-step identical DOM subjects'],
      ['entry.writes.push(write);', 'entry.writes.push(write); entry.writes.sort((a, b) => stableKey(a).localeCompare(stableKey(b)));', 'per-subject DOM write order'],
    ] as const) {
      assert.ok(original.includes(before));
      await writeFile(resolve(root, 'canonical.mts'), original.replace(before, after));
      await assert.rejects(exec(process.execPath, ['--test', '--test-name-pattern', pattern, resolve(root, 'canonical.test.mts')],
        { env: { ...process.env, NODE_TEST_CONTEXT: undefined } }), error => error instanceof Error && 'code' in error && error.code === 1
          && 'stdout' in error && typeof error.stdout === 'string' && error.stdout.includes('not ok 1 - ' + pattern));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('native request, DOM and quiet timing is diagnostic; raw traces remain unchanged', () => {
  const make = (frame: number) => ({ ...trace('network', []), observations: { ...trace('network', []).observations,
    network: observations([request(0, '/a', { issue: { frame, nativeFrameBound: String(frame) } }), response(0, '/a', { response: { frame, nativeFrameBound: String(frame) }, responseStep: 'response-' + frame }),
      { kind: 'finished', id: 0, completion: { frame }, completionStep: 'complete-' + frame }, { kind: 'barrier-quiet', framesToQuiet: frame }]),
    dom: observations([dom('a', 'div <+span>', { frame }), dom('b', 'div <+span>', { frame })]),
    rendering: observations([{ playback: [{ id: 'light', subject: 'a', playState: 'paused', playbackRate: 1, currentTime: frame }] }]),
  } });
  const base = make(1), head = make(200), before = JSON.stringify(base);
  assert.deepEqual(compareTraces(base, head), []);
  assert.equal(JSON.stringify(base), before);
  assert.deepEqual(canonicalTrace(canonicalTrace(base)), canonicalTrace(base));
  head.observations.network.push(...observations([request(1, '/a'), response(1, '/a'), finished(1)]));
  head.observations.network = head.observations.network.map((row, sequence) => ({ ...row, sequence }));
  assert.equal(compareTraces(base, head)[0]?.family, 'network');
});

test('raw response bytes are preserved while within-class changes normalize', () => {
  const base = trace('network', network({ contentBytes: 100, sizeClass: 7 }));
  const head = trace('network', network({ contentBytes: 120, sizeClass: 7 }));
  const raw = JSON.stringify(base);
  assert.deepEqual(compareTraces(base, head), []);
  assert.equal(JSON.stringify(base), raw);
});
