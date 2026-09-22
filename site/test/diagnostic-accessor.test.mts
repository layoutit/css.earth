import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { publishObjectDiagnostics, readObjectDiagnostics } from '../../src/renderers/css/dist/testing.js';
import type { ObjectDiagnosticsOptions } from '../../src/renderers/css/runtime/object-diagnostics.ts';

// This seam tests publication ownership only. Missing native methods fail if the
// publisher starts consuming them, rather than silently growing a permissive mock.
function boundary<T extends object>(provided: Partial<T>): T {
  return new Proxy(provided, { get(target, key, receiver) {
    if (!Reflect.has(target, key)) throw new Error(`Unexpected diagnostics fixture read: ${String(key)}`);
    return Reflect.get(target, key, receiver);
  } }) as T;
}
const unused = (): never => { throw new Error('Diagnostics observation is outside this ownership test.'); };
const emptyNodes: NodeListOf<never> = { length: 0, item: unused, forEach() {},
  entries: () => [][Symbol.iterator](), keys: () => [].keys(), values: () => [].values(),
  [Symbol.iterator]: () => [].values() };
function publisher(target: Window & typeof globalThis, id: string) {
  const disposers: (() => void)[] = [];
  const options: ObjectDiagnosticsOptions = {
    stage: boundary<HTMLElement>({ ownerDocument: boundary<Document>({ defaultView: target }), querySelectorAll: () => emptyNodes }),
    definition: boundary<ObjectDiagnosticsOptions['definition']>({ id,
      sky: boundary<ObjectDiagnosticsOptions['definition']['sky']>({ sceneRegistration: undefined }),
      sun: undefined }),
    mounted: boundary<ObjectDiagnosticsOptions['mounted']>({ observe: unused }),
    orbit: boundary<ObjectDiagnosticsOptions['orbit']>({ state: unused, setState: unused, flyToState: unused,
      stats: unused, publicationState: unused, captureWorldCamera: unused, applyWorldCamera: unused }),
    selection: boundary<ObjectDiagnosticsOptions['selection']>({ state: unused }),
    controls: boundary<ObjectDiagnosticsOptions['controls']>({ stats: unused }),
    resources: boundary<ObjectDiagnosticsOptions['resources']>({ stats: unused }),
    playback: boundary<ObjectDiagnosticsOptions['playback']>({ stats: unused }),
    lifetime: boundary<ObjectDiagnosticsOptions['lifetime']>({ stats: unused }),
    context: { density: 2, own: disposer => disposers.push(disposer) }, initialSelection: { lensId: 'test' },
    startupDecodedAssets: 0, getCurrentView: () => null,
  };
  return { diagnostics: publishObjectDiagnostics(options), dispose() { for (const dispose of disposers) dispose(); } };
}

test('diagnostic lookup requires the current published identity and cleanup preserves a replacement owner', () => {
  // Publication needs a property bag; no browser methods are used at this boundary.
  const target = {} as Window & typeof globalThis, id = 'future-registry-object';
  assert.equal(readObjectDiagnostics(target, id), undefined);
  const first = publisher(target, id);
  assert.equal(readObjectDiagnostics(target, id), first.diagnostics);
  Reflect.set(target, `__${id}`, { ready: true });
  assert.equal(readObjectDiagnostics(target, id), undefined, 'A foreign object cannot impersonate the publisher.');
  Reflect.set(target, `__${id}`, first.diagnostics);
  assert.equal(readObjectDiagnostics(target, id), first.diagnostics);
  const second = publisher(target, id);
  first.dispose();
  assert.equal(readObjectDiagnostics(target, id), second.diagnostics, 'Old cleanup cannot retire the new mount.');
  second.dispose();
  assert.equal(readObjectDiagnostics(target, id), undefined);
  assert.equal(Reflect.has(target, `__${id}`), false);
});
