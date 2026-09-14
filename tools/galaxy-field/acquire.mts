import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const endpoint='https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync';
const queries=[
  {id:'cosmicflows-4',catalogue:'J/ApJ/944/94/table2',citation:'Tully et al. (2023), Cosmicflows-4, ApJ 944, 94',doi:'https://doi.org/10.3847/1538-4357/ac94d8',query:'SELECT PGC,DM,e_DM,RAJ2000 AS RAdeg,DEJ2000 AS DEdeg FROM "J/ApJ/944/94/table2" ORDER BY PGC'},
  {id:'hyperleda-pgc',catalogue:'VII/237/pgc',citation:'Paturel et al. (2003), HYPERLEDA I, A&A 412, 45',doi:'https://doi.org/10.1051/0004-6361:20031411',query:'SELECT TOP 50000 PGC,RAJ2000 AS RAdeg,DEJ2000 AS DEdeg,MType,logD25 FROM "VII/237/pgc" WHERE logD25 IS NOT NULL AND RAJ2000 IS NOT NULL AND DEJ2000 IS NOT NULL ORDER BY logD25 DESC, PGC ASC'},
  {id:'hyperleda-hi',catalogue:'VII/238/hidat',citation:'Paturel et al. (2003), HYPERLEDA II, A&A 412, 57',doi:'https://doi.org/10.1051/0004-6361:20031412',query:'SELECT PGC,VHI FROM "VII/238/hidat" WHERE VHI IS NOT NULL ORDER BY PGC'},
];
const pinPath='src/objects/nearby-universe/source/catalogue.json';
const pinned=await readFile(pinPath,'utf8');
const expected=JSON.parse(pinned);
const directory='.local/galaxy-field/sources';
await mkdir(directory,{recursive:true});
const receipts=await Promise.all(queries.map(async source=>{
  const url=new URL(endpoint);for(const [key,value] of Object.entries({REQUEST:'doQuery',LANG:'ADQL',FORMAT:'tsv',MAXREC:'1000000',QUERY:source.query}))url.searchParams.set(key,value);
  const pin=expected.sources.find((entry: {id: string}) => entry.id === source.id);
  const cached=await readFile(`${directory}/${source.id}.tsv`).catch(()=>null);
  if(cached && pin && cached.length===pin.bytes && createHash('sha256').update(cached).digest('hex')===pin.sha256) { console.log(`${source.id}: verified cache`); return pin; }
  const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw new Error(`${source.id}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  const content=bytes.toString('utf8');if(!content.startsWith('PGC\t')||content.includes('QUERY_STATUS'))throw new Error(`${source.id}: invalid TAP response`);
  const path=`${directory}/${source.id}.tsv`;
  const result={...source,path,url:url.href,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,rows:content.trim().split('\n').length-1};
  await writeFile(path,bytes);console.log(`${source.id}: ${result.rows} rows, ${bytes.length} bytes`);return result;
}));
const document={schema:'cssearth-galaxy-field-sources@1',sources:receipts};
if(pinned && JSON.stringify(JSON.parse(pinned))!==JSON.stringify(document))throw new Error('Source response changed; review acquisition pins before baking.');

console.log('Galaxy field source pins verified.');
