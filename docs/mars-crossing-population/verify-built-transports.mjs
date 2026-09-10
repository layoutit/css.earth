import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {OBJECTS} from '../../site/objects.mjs';
import {loadObjectPageData} from '../../site/object-page-data.mjs';
const results=[];
for(const {id} of OBJECTS){
 const descriptor=JSON.parse(await readFile(`src/planets/${id}/object.json`));
 const path=`dist/objects/${id}/${descriptor.prepared.sha256}.json`,hash=createHash('sha256');let bytes=0;
 for await(const chunk of createReadStream(path)){hash.update(chunk);bytes+=chunk.length;}
 assert.equal(hash.digest('hex'),descriptor.prepared.sha256,`${id}: emitted transport bytes`);
 const page=await loadObjectPageData(id),html=await readFile(`dist/${id}/index.html`,'utf8');
 const keys=new Set(page.assets.startup);
 const expected=[...new Set(page.assets.entries.filter(asset=>keys.has(asset.key)).map(asset=>asset.url).filter(url=>typeof url==='string'&&url.length))];
 const preloads=[...html.matchAll(/<link rel="preload" href="([^"]+)" as="image"/gu)].map(match=>match[1].replaceAll('&amp;','&'));
 assert.deepEqual(preloads,expected,`${id}: prepared startup images in built HTML`);
 results.push({id,path,bytes,sha256:descriptor.prepared.sha256,preloads:preloads.length});
}
await writeFile('docs/mars-crossing-population/built-transports.json',JSON.stringify({objects:OBJECTS.length,totalBytes:results.reduce((sum,row)=>sum+row.bytes,0),scope:'Every emitted static JSON file is byte-identical to its descriptor pin; every object page retains the exact prepared startup image URLs.',results},null,2)+'\n');
console.log('Verified',results.length,'static transports and page preload sets');
