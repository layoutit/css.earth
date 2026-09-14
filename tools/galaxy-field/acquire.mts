import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceArray, sourceObject, sourceText, sourceDigest, sourcePath } from '../../src/platform/source-catalog.mts';
const pinned=sourceObject(JSON.parse(await readFile('src/objects/nearby-universe/source/catalogue.json','utf8')));
if(pinned.schema!=='cssearth-galaxy-field-sources@1')throw new TypeError('Invalid field sources.');
const directory='.local/galaxy-field/sources';
await mkdir(directory,{recursive:true});
await Promise.all(sourceArray(pinned.sources,sourceObject).map(async source=>{
  const id=sourceText(source.id),path=sourcePath(source.path),expectedHash=sourceDigest(source.sha256);
  if(path!==`${directory}/${id}.tsv`||!Number.isSafeInteger(source.bytes)||!Number.isSafeInteger(source.rows))throw new TypeError('Invalid source pin.');
  const matches=(bytes:Buffer)=>bytes.length===source.bytes&&createHash('sha256').update(bytes).digest('hex')===expectedHash;
  const cached=await readFile(path).catch(()=>null);
  if(cached&&matches(cached)){console.log(`${id}: verified cache`);return;}
  const url=new URL('https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync');
  for(const [key,value] of Object.entries({REQUEST:'doQuery',LANG:'ADQL',FORMAT:'tsv',MAXREC:'1000000',QUERY:sourceText(source.query)}))url.searchParams.set(key,value);
  if(url.href!==source.url)throw new TypeError(`Acquisition URL does not match pinned query: ${id}`);
  const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw new Error(`${id}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer()),content=bytes.toString('utf8');
  if(!matches(bytes)||!content.startsWith('PGC\t')||content.trim().split('\n').length-1!==source.rows)throw new Error(`Changed source response: ${id}; review pins before accepting.`);
  await writeFile(path,bytes);console.log(`${id}: ${source.rows} rows, ${bytes.length} bytes`);
}));
console.log('Galaxy field source pins verified.');
