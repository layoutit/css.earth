/** Pins must override caller-provided revision/count and remain stable across Git commits. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pinnedInputs, productionConfig, toolchainMatches} from './build.mts';
test('revision and version are independent fixed build inputs', async()=>{
 const pins=pinnedInputs();
 assert.equal(pins.COMMIT_REF,'0000000000000000000000000000000000000001');
 assert.equal(pins.version,'1.2345');
 assert.equal(pins.CSSEARTH_BUILD_PAGES,'');

 assert.equal(pins.TZ,'UTC'); assert.equal(pins.LC_ALL,'C');
 assert.equal(pins.assetOrigin,'https://earth-assets.lowpoly.cc');
 for(const count of ['-1','NaN','9007199254740992'])assert.throws(()=>pinnedInputs(count));
 const source=await readFile(new URL('./build.mts',import.meta.url),'utf8');
 assert.match(source,/\.\.\.process.env, COMMIT_REF: toolchain.COMMIT_REF/u);
 assert.match(source,/CSSEARTH_BUILD_PAGES: toolchain.CSSEARTH_BUILD_PAGES/u);
 assert.match(source,/lockfileBytes: lock.length, \.\.\.pins/u);
 assert.match(source,/Pinned source revision absent from HTML/u);
});

test('toolchain byte equality rejects same-length lockfile changes', () => {
 const record = { lockfileBytes: 2, node: 'v24' };
 assert.equal(toolchainMatches(record, record, Buffer.from('aa'), Buffer.from('ab')), false);
 assert.equal(toolchainMatches(record, record, Buffer.from('aa'), Buffer.from('aa')), true);
 assert.equal(toolchainMatches(record, { ...record, node: 'v22' }, Buffer.from('aa'), Buffer.from('aa')), false);
});

test('the production build uses the checkout\'s own config, under site/ or at the root', async () => {
 const checkout = await mkdtemp(join(tmpdir(), 'compare-config-'));
 try {
  assert.equal(productionConfig(checkout), 'astro.config.mts');
  await mkdir(join(checkout, 'site')); await writeFile(join(checkout, 'site/astro.config.mts'), '');
  assert.equal(productionConfig(checkout), 'site/astro.config.mts');
 } finally { await rm(checkout, { recursive: true, force: true }); }
});
