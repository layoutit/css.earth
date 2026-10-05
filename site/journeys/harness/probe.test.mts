/** Drift guards read lab source text; no cross-tree imports enter the journey harness. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { ALLOWED, CLASSIFICATION_HELPERS, PROBE } from './probe.mts';
test('coast allowed patterns remain identical to the lab', async () => {
  const source = await readFile(resolve(import.meta.dirname, '../../../labs/performance/coast-writes.mts'), 'utf8');
  const block = source.split('const ALLOWED = [')[1]?.split('\n];')[0];
  assert.ok(block);
  const patterns = [...block.replace(/\/\/[^\n]*/gu, '').matchAll(/\/(?:[^/\\]|\\.)+\/[a-z]*/gu)].map(match => match[0]);
  assert.deepEqual(ALLOWED.map(pattern => pattern.toString()), patterns);
});
test('description, CSS parsing, motion rules and write classification keys equal the lab', async () => {
  const source = await readFile(resolve(import.meta.dirname, '../../../labs/performance/ios-capture.mts'), 'utf8');
  const logger = source.split('export const STYLE_WRITES_LOGGER = `')[1]?.split('`;')[0];
  assert.ok(logger);
  const helpers = logger.slice(logger.indexOf('  const describe ='), logger.indexOf('  const bump ='));
  assert.equal(CLASSIFICATION_HELPERS, helpers);
  for (const prefix of ['  const moving =', '  const onMotion =', '  const onWheel =', '  const ours =']) {
    const line = logger.split('\n').find(line => line.startsWith(prefix));
    assert.ok(line); assert.ok(PROBE.includes(line), prefix);
  }
  const keys = (text: string) => [...new Set([...text.matchAll(/who \+ '(?:[^']*)'(?: \+ (?:property|name|\(node.localName \|\| '#text'\)) \+ '[^']*')?/gu)].map(match => match[0]))].sort();
  assert.deepEqual(keys(PROBE).filter(key => key !== "who + ' [text]'"), keys(logger));
  // Same-value rule uses reconstructed per-write values; the lab uses the final batch value.
  assert.ok(logger.includes("record.oldValue === element.getAttribute(name)"));
  assert.ok(PROBE.includes('record.oldValue === value'));
  assert.ok(PROBE.includes('if (!changed) bump(who +'));
});
