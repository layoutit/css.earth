import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { executeAcquisition, parseAcquisitionPlan } from './operations-acquisition.js';

test('ZIP restoration verifies both the streamed archive and its exact extracted member', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-zip-source-'));
  const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  let cache: string | undefined;
  try {
    const content = Buffer.from(`Pinned source fixture ${randomUUID()}\n`);
    await writeFile(join(directory, 'source.bin'), content);
    execFileSync('zip', ['-q', 'archive.zip', 'source.bin'], {cwd: directory});
    const archive = await readFile(join(directory, 'archive.zip'));
    cache = resolve('.local/source-archives', `${digest(archive)}.zip`);
    const step = {kind:'zip-member', path:'restored.bin', url:'https://example.test/archive.zip',
      archiveSha256:digest(archive), archiveBytes:archive.length, member:'source.bin', groups:['restore']};
    const plan = parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1', operations:[step]});
    const manifest = {schema:'cssfixture-authoritative-sources@1', inputs:[{id:'fixture',path:'restored.bin',
      expectedBytes:content.length,expectedSha256:digest(content)}], generatedIntermediates:[],documents:[]};
    await assert.rejects(executeAcquisition({sourceRoot:directory,manifest,plan,group:'restore',
      transport:{fetch:async()=>new Response(Buffer.from('wrong archive'))}}), /ZIP source pin differs/);
    await executeAcquisition({sourceRoot:directory,manifest,plan,group:'restore',
      transport:{fetch:async()=>new Response(archive)}});
    assert.deepEqual(await readFile(join(directory,'restored.bin')), content);
    await rm(join(directory,'restored.bin'));
    await executeAcquisition({sourceRoot:directory,manifest,plan,group:'restore',
      transport:{fetch:async()=>{throw new Error('A verified cache must be reusable');}}});
    assert.deepEqual(await readFile(join(directory,'restored.bin')), content);
    await assert.rejects(executeAcquisition({sourceRoot:directory,
      manifest:{...manifest,inputs:[{...manifest.inputs[0]!,expectedSha256:'0'.repeat(64)}]},plan,group:'restore'}), /pin|hash/i);
    assert.deepEqual(await readFile(join(directory,'restored.bin')), content);
    for (const member of ['../escape', '/absolute', '*.bin', '-option']) {
      assert.throws(()=>parseAcquisitionPlan({schema:plan.schema,operations:[{...step,member}]}));
    }
  } finally { if(cache) await rm(cache,{force:true}); await rm(directory,{recursive:true,force:true}); }
});
