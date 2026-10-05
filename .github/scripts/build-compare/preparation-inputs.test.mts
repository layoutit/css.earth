/** Pin the pre-Astro readers to the smallest inventoried public input subset. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {publicPreparationUrls,preparationUrls} from './preparation-inputs.mts';
test('feature banks, places and only fallback multi-dataset thumbnails require local scenes',()=>{
 const features={schema:'cssearth-prepared-features@1',url:'/scenes/earth/main.json',selection:{count:1,banks:[{url:'/scenes/earth/bank.json'}]}};
 const controls={datasets:{controls:[{id:'a',thumbnailUrl:'/scenes/earth/a.webp'},{id:'b',thumbnailUrl:'/scenes/earth/b.webp'}]}};
 const sidebar={images:{'earth/a':{url2x:'/navigation/a.webp'}}};
 assert.deepEqual(publicPreparationUrls(features,{url:'/scenes/earth/places.json'},controls,sidebar,'earth'),['/scenes/earth/b.webp','/scenes/earth/bank.json','/scenes/earth/main.json','/scenes/earth/places.json']);
 assert.deepEqual(publicPreparationUrls(undefined,{url:'/scenes/earth/places.json'},{datasets:{controls:[{id:'a',thumbnailUrl:'/scenes/earth/a.webp'}]}},sidebar,'earth'),[]);
 assert.throws(()=>publicPreparationUrls({...features,url:'/scenes/earth/../escape'},undefined,undefined,sidebar,'earth'),/Unsafe/u);
});

test('fact republishing cannot mutate the hardlinked baseline',async()=>{
 const {mkdtemp,mkdir,writeFile,link,readFile,rm,stat}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {isolatePreparedWrites}=await import('./restore-preparation.mts');
 const root=await mkdtemp(join(tmpdir(),'cssearth-l3-preparation-'));
 try {
  const folder=join(root,'src/objects/probe/prepared'); await mkdir(folder,{recursive:true});
  const baseline=join(root,'baseline.json'),head=join(folder,'content.json');
  await writeFile(baseline,'old');await link(baseline,head);
  await isolatePreparedWrites(root); await writeFile(head,'new');
  assert.equal(await readFile(baseline,'utf8'),'old'); assert.equal((await stat(head)).nlink,1);
 } finally {await rm(root,{recursive:true,force:true});}
});

test('the default arrival billboard is selected even for a single dataset without features', () => {
 const arrival = { url: '/scenes/earth/earth-arrival.webp', size: 512, focalPixels: 500, distanceM: 10000, dataset: 'photo', rotation: [1,0,0,0,1,0,0,0,1] };
 assert.deepEqual(publicPreparationUrls(undefined, undefined, { datasets: { controls: [{ id: 'photo', thumbnailUrl: '/scenes/earth/unneeded.webp' }] } }, { images: {} }, 'earth', arrival), ['/scenes/earth/earth-arrival.webp']);
 assert.throws(() => publicPreparationUrls(undefined, undefined, undefined, { images: {} }, 'earth', { ...arrival, url: '/scenes/earth/../escape.webp' }), /Unsafe/u);
 assert.throws(() => publicPreparationUrls(undefined, undefined, undefined, { images: {} }, 'earth', { ...arrival, size: -1 }));
});

test('the descriptor-driven selector keeps Earth startup imagery from the restored arrival manifest', async () => {
 const { readFile } = await import('node:fs/promises');
 const { fileURLToPath } = await import('node:url');
 const root = fileURLToPath(new URL('../../../', import.meta.url));
 const arrival: unknown = JSON.parse(await readFile(new URL('../../../src/objects/earth/prepared/arrival-billboard.json', import.meta.url), 'utf8'));
 assert.ok(arrival && typeof arrival === 'object' && 'url' in arrival && typeof arrival.url === 'string');
 assert.ok((await preparationUrls(root)).includes(arrival.url));
});
