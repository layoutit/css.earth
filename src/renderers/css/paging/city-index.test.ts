import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { createCityIndex } from './city-index.js';
import type { PreparedPagePlan } from './types.js';

test('moving the view reprioritizes waiting metadata without restarting live or loaded entries', async () => {
  const directories = [0, 1, 2].map(id => {
    const bytes = Buffer.from(JSON.stringify({schema:'cssearth-city-index@1',dataset:'priority',nodes:[],external:[],id}));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return {bytes, ref:{url:`https://earth-assets.lowpoly.cc/scenes/earth/city-index-priority-0-${id}-0-${sha256.slice(0,16)}.json`,bytes:bytes.length,sha256}};
  });
  const [a,b,c] = directories;
  const started: string[] = [], pending = new Map<string, () => void>();
  let aborted = 0;
  const plan = {roots:[],assetPath:'/scenes/earth/',assetOrigin:'https://earth-assets.lowpoly.cc',dataset:'priority',
    index:{maximumDirectories:3,maximumBytes:4096,maximumDirectoryBytes:1024,maximumConcurrentLoads:1}} as PreparedPagePlan;
  const index = createCityIndex(plan, () => {}, (async (url, {signal}) => {
    const key = String(url), directory = directories.find(d => d.ref.url === key)!;
    started.push(key);
    return new Promise<Response>((resolve,reject) => {
      pending.set(key, () => resolve(new Response(directory.bytes)));
      signal!.addEventListener('abort', () => {aborted++;reject(signal!.reason);}, {once:true});
    });
  }) as typeof fetch);
  const wait = async (condition: () => boolean) => {
    for(let i=0;i<100&&!condition();i++) await new Promise(resolve => setTimeout(resolve,2));
    assert.ok(condition());
  };
  try {
    index.update([a.ref,b.ref,c.ref]);
    assert.deepEqual(started,[a.ref.url]);
    index.update([c.ref,a.ref,b.ref]);
    assert.deepEqual(started,[a.ref.url], 'Current request retains its reservation');
    assert.equal(aborted,0);
    pending.get(a.ref.url)!();
    await wait(() => started.length === 2);
    assert.deepEqual(started,[a.ref.url,c.ref.url], 'Newly central directory starts next');
    index.update([b.ref,a.ref,c.ref]);
    pending.get(c.ref.url)!();
    await wait(() => started.length === 3);
    assert.deepEqual(started,[a.ref.url,c.ref.url,b.ref.url]);
    pending.get(b.ref.url)!();
    await wait(() => index.stats().activeLoads === 0);
    index.update([c.ref,b.ref,a.ref]);
    assert.equal(index.stats().requests,3, 'Loaded entries survive priority changes');
    assert.equal(index.stats().reservedEncodedBytes,directories.reduce((sum,d) => sum+d.bytes.length,0));
    assert.equal(index.stats().residentDirectories,3);
    assert.deepEqual(index.stats().errors,[]);
    assert.equal(aborted,0);
  } finally { index.destroy(); }
});
