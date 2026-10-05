/** Delete-the-bound and outside-the-bound mutations qualify the named volatile features. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundInitiators } from './volatile.mts';
import { compareTraces } from './differ.mts';
import { parseTrace } from './trace.mts';
const declarations = [{ url: '/shared.js', scripts: ['/one.js', '/two.js'], cause: 'Concurrent static imports share one module request.' }];
function trace(script: string, count = 1) {
  return parseTrace({ schema: 'cssearth-journey@1', journey: 'volatile-mutation', profile: 'chromium-desktop', toolchain: {}, exercises: ['fixture:initiator'],
    observations: { network: [{ sequence: 0, step: 'ready', data: { url: '/shared.js', method: 'GET', status: 200, count,
      initiator: { type: 'script', scripts: [script] } } }], dom: [], rendering: [], content: [], errors: [] } });
}
test('only the two declared callers compare equally; a new caller is still a network regression', () => {
  assert.deepEqual(compareTraces(boundInitiators(trace('/one.js'), declarations), boundInitiators(trace('/two.js'), declarations)), []);
  assert.deepEqual(compareTraces(trace('/one.js'), trace('/one.js')), []);
  assert.equal(compareTraces(boundInitiators(trace('/one.js'), declarations), boundInitiators(trace('/third.js'), declarations))[0]?.family, 'network');
  assert.equal(compareTraces(boundInitiators(trace('/one.js'), declarations), boundInitiators(trace('/two.js', 2), declarations))[0]?.family, 'network');
  // Deleting the bound leaves the formerly accepted concurrent variation red.
  assert.equal(compareTraces(trace('/one.js'), trace('/two.js'))[0]?.family, 'network');
  // Deleting the observation makes the required outside-caller assertion fail.
  const base = trace('/one.js'), head = trace('/third.js'); base.observations.network = []; head.observations.network = [];
  assert.throws(() => assert.equal(compareTraces(base, head)[0]?.family, 'network'));
});

test('HTML parser chunk bounds retain final text, scripted edits, membership and excess-chunk regressions', async () => {
  const { canonicalDom } = await import('./canonical.mts');
  const attach = { subject: 'style-text', key: 'style <+#text>', parserFinalText: 'abc', value: 'style', before: null };
  const chunk = { subject: 'style-text', key: 'style [text]', parserFinalText: 'abc', value: 'abc', before: 'a', volatile: 'html-parser-text-chunks' };
  const rows = (values: unknown[]) => values.map((value, sequence) => ({ sequence, step: 'load', data: (parseTrace({ ...trace('/one.js'), observations: { network: [], dom: [{ sequence: 0, step: 'load', data: value }], rendering: [], content: [], errors: [] } })).observations.dom[0]!.data }));
  assert.deepEqual(canonicalDom(rows([attach])), canonicalDom(rows([attach, chunk])));
  assert.notDeepEqual(canonicalDom(rows([attach])), canonicalDom(rows([{ ...attach, parserFinalText: 'changed' }, { ...chunk, parserFinalText: 'changed' }])));
  assert.notDeepEqual(canonicalDom(rows([attach])), canonicalDom(rows([attach, { ...chunk, volatile: null }])));
  assert.notDeepEqual(canonicalDom(rows([attach])), canonicalDom(rows([attach, { subject: 'style-text', key: 'style <-#text>', value: 'style' }])));
  assert.notDeepEqual(canonicalDom(rows([attach])), canonicalDom(rows([attach, chunk, chunk, chunk, chunk])));
});
