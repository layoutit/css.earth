// Exercise the pinned streaming downloader against a genuinely empty destination.
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {acquirePinnedDownloads,assertSourceFile} from '../../../tools/objects/dist/operations.js';
const manifest=JSON.parse(await readFile('src/planets/moon/source/manifest.json'));
const path='science/diviner-ghrm/dghrm_ra_sam_70s70n_img.img';
const entry=manifest.inputs.find(x=>x.path===path);
const sourceRoot=await mkdtemp(resolve('output/b10-intake/restore-'));
const start=Date.now();
await acquirePinnedDownloads({sourceRoot,manifest,paths:[path]});
await assertSourceFile(entry,resolve(sourceRoot,path));
await writeFile('docs/moons/b10-lunar-thermal/evidence/source-restoration.json',JSON.stringify({status:'PASS',sourceRoot,method:'acquirePinnedDownloads with default network fetch into empty directory; streaming pin verification',path,bytes:entry.expectedBytes,sha256:entry.expectedSha256,url:entry.origin,seconds:(Date.now()-start)/1000},null,2)+'\n');
console.log('PASS: exact 3.3 GB archive restored using the streaming source downloader');
