import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparedContextNavigation } from '../prepared-context-navigation.mjs';

function fixture({ object = {}, imageLayerFrames = {} } = {}) {
  let current = null, signal;
  const callbacks = new Set(), errors = [], selections = [], writes = [], content = [];
  const windowTarget = { location: new URL('https://example.test/mercury/?focus=catalogue:a&v=saved'),
    history: { state: {}, replaceState(state, _, url) { windowTarget.location = new URL(url, windowTarget.location); writes.push(url); } } };
  const owner = { preparedFocus: () => current,
    setPreparedFocus(focus) { current = focus; for (const callback of callbacks) callback(); },
    subscribe(callback) { callbacks.add(callback); callback(); return () => callbacks.delete(callback); },
    flyToPreparedFocus(focus, options) { signal = options.signal; this.setPreparedFocus(focus);
      return new Promise(resolve => signal.addEventListener('abort', () => resolve({ completed: false }), { once: true })); } };
  const layer = { imageLayerFrames, selectGalaxy: id => selections.push(id),
    resolveGalaxy: id => ['catalogue:a','catalogue:b'].includes(id) ? { id, name: id, positionM: [1e20, 0, 0],
      skyPosition: { sourceRef: 'positions:row' }, distance: { sourceRef: 'UnresolvedBibliographicKey' },
      membership: { sourceRef: 'membership:row' }, ...object } : null };
  const sources = [{ id: 'positions', url: 'https://example.test/positions', citation: 'Published positions' },
    { id: 'membership', url: 'https://example.test/membership', citation: 'Published membership' },
    { id: 'unrelated', url: 'https://example.test/unrelated', citation: 'Unused audit input' }];
  const controller = createPreparedContextNavigation({ layer, windowTarget, onError: error => errors.push(error),
    sources, presentation: { metersPerParsec: 3e16, defaultFocusRadiusM: 1e18, minimumDistanceRadii: .01, maximumDistanceM: 1e23 } });
  controller.connect(owner, { onFocusContentChange: (record, references) => content.push({ record, references }) });
  return { controller, owner, windowTarget, errors, selections, writes, callbacks, content, signal: () => signal };
}

test('suspension isolates camera restore publications from incoming focus history and cancels an older selection flight', async () => {
  const f = fixture();
  f.controller.restore(f.windowTarget.location.href);
  assert.equal(f.content.at(-1).record.id, 'catalogue:a');
  assert.deepEqual(f.content.at(-1).references.map(source => source.id), ['positions', 'membership']);
  assert.equal(f.content.at(-1).record.distance.sourceRef, 'UnresolvedBibliographicKey');
  const flight = f.controller.select({ id: 'catalogue:b' });
  assert.equal(f.owner.preparedFocus().id, 'catalogue:b');
  assert.equal(f.content.at(-1).record.id, 'catalogue:b');
  const incoming = 'https://example.test/mercury/?focus=catalogue:a&v=restored';
  f.windowTarget.location = new URL(incoming);
  f.controller.suspend();
  f.owner.setPreparedFocus(null); // Shared v restoration clears the runtime pivot.
  assert.equal(f.windowTarget.location.href, incoming);
  assert.equal(f.signal().aborted, true);
  await flight;
  assert.equal(f.windowTarget.location.href, incoming);
  f.controller.restore(incoming);
  assert.equal(f.owner.preparedFocus().id, 'catalogue:a');
  assert.equal(f.content.at(-1).record.id, 'catalogue:a');
  assert.equal(f.windowTarget.location.href, incoming);
  assert.deepEqual(f.errors, []);
  f.controller.destroy();
  assert.equal(f.callbacks.size, 0);
});

test('an invalid incoming catalogue ID remains available for diagnosis after restoration publications', () => {
  const f = fixture();
  f.controller.restore(f.windowTarget.location.href);
  f.controller.suspend();
  const incoming = 'https://example.test/mercury/?focus=unknown&v=restored';
  f.windowTarget.location = new URL(incoming);
  f.owner.setPreparedFocus(null);
  f.controller.restore(incoming);
  f.owner.setPreparedFocus(null);
  assert.equal(f.errors.length, 1);
  assert.match(f.errors[0].message, /Unknown prepared galaxy/);
  assert.equal(f.windowTarget.location.href, incoming);
  assert.equal(f.selections.at(-1), null);
  assert.equal(f.content.at(-1).record, null);
  f.controller.destroy();
});

test('an authored framing radius takes precedence over an oversized transparent image frame', () => {
  const imageLayerFrames = { detailed: { boundsUnits: { min: [-500,-500,-500], max: [500,500,500] }, metersPerUnit: 1e18 } };
  const f = fixture({ imageLayerFrames, object: { detailedObjectId: 'detailed', presentation: { focusRadiusM: 2e18 } } });
  f.controller.restore(f.windowTarget.location.href);
  assert.equal(f.owner.preparedFocus().framingRadiusM, 2e18);
  assert.equal(f.owner.preparedFocus().limits.minimumDistanceM, 2e16);
  assert.equal(f.owner.preparedFocus().limits.maximumDistanceM, 1e23);
  assert.deepEqual(f.errors, []);
  f.controller.destroy();
  const fallback = fixture({ imageLayerFrames, object: { detailedObjectId: 'detailed' } });
  fallback.controller.restore(fallback.windowTarget.location.href);
  assert.equal(fallback.owner.preparedFocus().framingRadiusM, 5e20);
  fallback.controller.destroy();
});

test('a cluster focus uses its prepared aperture framing and source without pretending it has galaxy membership', () => {
  const f = fixture({ object: { kind: 'galaxy-cluster', membership: undefined,
    classification: { sourceRef: 'membership:cluster-row' }, presentation: { focusRadiusM: 9e22 } } });
  f.controller.restore(f.windowTarget.location.href);
  assert.deepEqual(f.errors, []);
  assert.equal(f.owner.preparedFocus().framingRadiusM, 9e22);
  assert.deepEqual(f.content.at(-1).references.map(source => source.id), ['positions', 'membership']);
  assert.equal(f.content.at(-1).record.kind, 'galaxy-cluster');
  f.controller.destroy();
});
