import assert from 'node:assert/strict';
import test from 'node:test';
import { retainedWriteCounts, writeData, writeStyle } from './retained-write.js';

/** A style that stores what the browser would: a normalized transform, so a read-back never equals the written text. */
function element() {
  const sets: string[] = [], stored = new Map<string, string>();
  const style = new Proxy({ setProperty(name: string, value: string) { sets.push(name); stored.set(name, value); } } as Record<string, unknown>, {
    set(_, name: string, value: string) { sets.push(name); stored.set(name, name === 'transform' ? value.replaceAll(',', ', ') : value); return true; },
    get(target, name: string) { return name in target ? target[name] : stored.get(name) ?? ''; },
  });
  return { style, dataset: {} as Record<string, string>, sets, stored };
}

test('an equal value is written once, whatever the page would read back', () => {
  const node = element(), before = retainedWriteCounts();
  assert.equal(writeStyle(node, 'transform', 'translate(1px,2px)'), true);
  assert.notEqual(node.stored.get('transform'), 'translate(1px,2px)');
  assert.equal(writeStyle(node, 'transform', 'translate(1px,2px)'), false);
  assert.equal(writeStyle(node, 'transform', 'translate(3px,2px)'), true);
  assert.deepEqual(node.sets, ['transform', 'transform']);
  const after = retainedWriteCounts();
  assert.deepEqual([after.written - before.written, after.skipped - before.skipped], [2, 1]);
});

test('style properties, data attributes and separate elements keep separate values, and no custom property is written', () => {
  const first = element(), second = element();
  assert.equal(writeStyle(first, 'opacity', '0.5'), true);
  assert.equal(writeStyle(first, 'opacity', '0.5'), false);
  assert.equal(first.stored.get('opacity'), '0.5');
  assert.equal(writeStyle(second, 'opacity', '0.5'), true);
  assert.equal(writeData(first, 'opacity', '1'), true);
  assert.equal(writeData(first, 'opacity', '1'), false);
  assert.equal(writeStyle(first, 'opacity', '1'), true);
  assert.equal(first.dataset.opacity, '1');
  assert.throws(() => writeStyle(first, '--native-volume-mix', '0.5'), /The renderer writes no custom property: --native-volume-mix/u);
});
