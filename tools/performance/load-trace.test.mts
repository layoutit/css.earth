import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { loadTrace } from './load-trace.mts';

test('streamed JSON and gzip preserve all events, split UTF-8 and original-byte identity', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-trace-stream-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const events = [{ name: 'α🌍', args: { text: 'escaped " quote \\ brace } [' }, ts: 123456789.125 },
    { name: 'Frame', args: { nested: [null, true, false, -2.5e-8, { value: 4 }] } }];
  for (const wrapped of [false, true]) for (const compressed of [false, true]) {
    const decoded = Buffer.from(JSON.stringify(wrapped ? { metadata: { clock: 'ticks' }, traceEvents: events } : events, null, 2));
    const bytes = compressed ? gzipSync(decoded) : decoded;
    const path = join(root, `trace-${wrapped}-${compressed}.data`);
    await writeFile(path, bytes);
    const result = await loadTrace(path, { highWaterMark: 1 });
    assert.deepEqual(result.events, events);
    assert.equal(result.bytes, bytes.length); assert.equal(result.decodedBytes, decoded.length);
    assert.equal(result.compressed, compressed);
    assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
});

test('invalid or truncated input fails instead of silently returning a partial trace', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-trace-stream-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [index, bytes] of [Buffer.from('{"traceEvents":[{"name":"incomplete"}'),
    gzipSync('{"traceEvents":[]}').subarray(0, 10), Buffer.from('{"traceEvents":null}')].entries()) {
    const path = join(root, `broken-${index}`); await writeFile(path, bytes);
    await assert.rejects(loadTrace(path, { highWaterMark: 3 }), /Cannot decode trace|does not contain/);
  }
});
