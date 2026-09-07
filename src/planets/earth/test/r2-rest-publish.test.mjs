import test from 'node:test';
import assert from 'node:assert/strict';
import { publishCityRestBatches } from '../tools/city/r2-publish.mjs';

function fixture(count) {
  let time = 0;
  const assets = Array.from({ length: count }, (_, i) => ({ filename: `${i}.webp`, url: `https://example.invalid/${i}`, bytes: i + 1, type: 'image/webp' }));
  const remote = new Map(), writes = [], pauses = [];
  const fetcher = async url => new Response(null, { status: remote.has(url) ? 200 : 404,
    headers: remote.has(url) ? { 'content-length': String(remote.get(url)) } : {} });
  const upload = async batch => {
    writes.push({ at: time, files: batch.map(asset => asset.filename) });
    for (const asset of batch) remote.set(asset.url, asset.bytes);
  };
  return { assets, remote, writes, pauses, fetcher, upload, now: () => time,
    wait: async ms => { pauses.push(ms); time += ms; } };
}

test('REST publication skips existing objects and paces new batches across content types', async () => {
  const f = fixture(5); f.remote.set(f.assets[0].url, f.assets[0].bytes);
  f.assets[4].type = 'application/json';
  const result = await publishCityRestBatches(f.assets, { ...f, batchSize: 2 });
  assert.deepEqual(result, { uploaded: 4, reused: 1 });
  assert.deepEqual(f.writes.map(write => write.files), [['1.webp', '2.webp'], ['3.webp'], ['4.webp']]);
  assert.ok(f.writes[1].at - f.writes[0].at >= 2000 / 3);
  assert.ok(f.writes[2].at - f.writes[1].at >= 1000 / 3);
});

test('a partial rate-limited batch waits and resumes without uploading successful objects again', async () => {
  const f = fixture(2); let calls = 0;
  const upload = async batch => {
    f.writes.push({ at: f.now(), files: batch.map(asset => asset.filename) });
    if (calls++ === 0) {
      f.remote.set(batch[0].url, batch[0].bytes);
      throw Object.assign(new Error('HTTP 429'), { rateLimited: true });
    }
    for (const asset of batch) f.remote.set(asset.url, asset.bytes);
  };
  assert.deepEqual(await publishCityRestBatches(f.assets, { ...f, upload }), { uploaded: 2, reused: 0 });
  assert.deepEqual(f.writes.map(write => write.files), [['0.webp', '1.webp'], ['1.webp']]);
  assert.ok(f.writes[1].at >= 300000);
  assert.ok(f.pauses.every(ms => ms <= 30000));
});

test('conflicting remote bytes and ordinary upload errors remain explicit failures', async () => {
  const f = fixture(2); f.remote.set(f.assets[0].url, 100);
  await assert.rejects(publishCityRestBatches(f.assets, f), /Cannot reuse immutable/);
  assert.equal(f.writes.length, 0);
  f.remote.clear();
  await assert.rejects(publishCityRestBatches(f.assets, { ...f, upload: async () => { throw Error('credentials unavailable'); } }), /credentials unavailable/);
  assert.equal(f.pauses.length, 0);
});

test('persistent rate limiting has bounded retries and cannot report completion', async () => {
  const f = fixture(1); let calls = 0;
  await assert.rejects(publishCityRestBatches(f.assets, { ...f,
    upload: async () => { calls++; throw Object.assign(new Error('HTTP 429'), { rateLimited: true }); } }), /HTTP 429/);
  assert.equal(calls, 3); assert.equal(f.now(), 600000);
});
