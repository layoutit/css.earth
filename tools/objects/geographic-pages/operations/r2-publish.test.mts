import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { publishPreparedCityAssets } from './r2-publish.mts';

test('publication dry-run validates content addressed inventory without contacting a provider', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'geographic-publish-fixture-'));
  const bytes = Buffer.from('offline inventory fixture');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const filename = `city-fixture-0-0-0-${digest.slice(0,16)}.webp`;
  const source = {dataset:'fixture',delivery:{bucket:'cssearth-assets',accountId:'a'.repeat(32),
    keyPrefix:'scenes/test-one',assetOrigin:'https://geographic-fixture.invalid'}};
  const options = {source,cors:{},assetUrls:[`${source.delivery.assetOrigin}/${source.delivery.keyPrefix}/${filename}`],
    assetPath:'/scenes/test-one/',staging:directory,root:directory,dryRun:true};
  try {
    await writeFile(resolve(directory, filename), bytes);
    const report = await publishPreparedCityAssets(options);
    assert.equal(report.mode, 'dry-run');
    assert.equal(report.objects, 1);
    assert.deepEqual(report.webp, {objects:1,bytes:bytes.length});
    await assert.rejects(publishPreparedCityAssets({...options,assetPath:'/scenes/test-two/'}), /delivery target/);
    await assert.rejects(publishPreparedCityAssets({...options,assetUrls:[options.assetUrls[0]+'?changed']}), /pinned delivery path/);
    await writeFile(resolve(directory, filename), Buffer.alloc(bytes.length));
    await assert.rejects(publishPreparedCityAssets(options), /hash mismatch/);
  } finally { await rm(directory, {recursive:true,force:true}); }
});
