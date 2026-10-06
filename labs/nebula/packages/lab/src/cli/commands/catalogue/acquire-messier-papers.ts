/** Resume object-linked bibliography acquisition; never downloads paper PDFs. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { archiveTable } from '../../../adapters/sources/archive-tables.ts';
import { readMessierCatalogue } from '../../../features/catalogue/types.ts';
import { countQuery, papersQuery, readPaperCounts, papersFromRows } from '../../../features/catalogue/papers/query.ts';
import { paperEndpoint, paperRoot, paperSchema, readPaperIndex, readPaperPage, type PaperIndex, type PaperReference } from '../../../features/catalogue/papers/types.ts';

const args = process.argv.slice(2), refresh = args.includes('--refresh'), objectArg = args.find(a=>a.startsWith('--object='))?.slice(9);
if (args.some(a=>a !== '--refresh' && !/^--object=m(?:[1-9]|[1-9]\d|10\d|110)$/.test(a))) throw new Error('Usage: acquire-messier-papers [--object=m42] [--refresh]');
const cataloguePath = 'labs/nebula/models/messier/catalogue.json';
const catalogue = readMessierCatalogue(JSON.parse(await readFile(cataloguePath,'utf8'))), indexPath = resolve(paperRoot,'index.json');
await mkdir(paperRoot,{recursive:true});
let index: PaperIndex | undefined;
try { index = readPaperIndex(JSON.parse(await readFile(indexPath,'utf8'))); if (index.catalogue !== cataloguePath) index = undefined; }
catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) console.log('PAPER_INDEX_REBUILD',error instanceof Error?error.message:String(error)); }
if (!index || refresh) {
  const counts = await archiveTable(paperEndpoint,countQuery,1000);
  const rows = readPaperCounts(counts), old = index;
  const countSource = `${paperRoot}/counts.json.gz`;
  await writeFile(resolve(countSource),gzipSync(JSON.stringify(counts)));
  index = {schema:'cssearth-messier-paper-index@1',catalogue:cataloguePath,generatedAt:new Date().toISOString(),countQuery,countSource,
    objects:catalogue.objects.map(object=>{
      const row = rows.find(r=>r.objectId === object.id); if(!row) throw new Error(`Missing ${object.id} bibliography identity.`);
      const previous = old?.objects.find(o=>o.objectId===object.id);
      return {...row,count:0,status:'pending',...(previous?.expectedCount===row.expectedCount ? previous : {})};
    })};
}
const snapshot = index;
async function publish() {
  snapshot.generatedAt = new Date().toISOString(); readPaperIndex(snapshot);
  await writeFile(`${indexPath}.tmp`,`${JSON.stringify(snapshot,null,2)}\n`); await rename(`${indexPath}.tmp`,indexPath);
}
// Acquisition is sequential: polite service use, one snapshot writer, visible progress per object.
let downloaded = 0, cached = 0, failures = 0;
console.log(`PAPER_INVENTORY_START objects=${snapshot.objects.length} references=${snapshot.objects.reduce((s,o)=>s+o.expectedCount,0)}`);
await publish();
for (const reference of snapshot.objects) {
  if (objectArg && reference.objectId !== objectArg) continue;
  if (!refresh && reference.status === 'complete' && reference.path) {
    try {
      const bytes = await readFile(reference.path);
      const page = readPaperPage(JSON.parse(gunzipSync(bytes).toString('utf8')));
      if (bytes.length !== reference.bytes || page.objectId !== reference.objectId || page.papers.length !== reference.count) throw new Error(`Cached papers ${reference.path} do not match their index entry.`);
      cached++; console.log(`PAPERS_CACHED ${reference.objectId} count=${reference.count}`); continue;
    } catch { /* Restore invalid/missing cache using its source query. */ }
  }
  try {
    const limit = Math.min(50000,reference.expectedCount+1), query = papersQuery(reference.simbadId,limit);
    const response = await archiveTable(paperEndpoint,query,limit), papers = papersFromRows(response.rows);
    const source = `${paperRoot}/source-${reference.objectId}.json.gz`;
    const page = readPaperPage({schema:paperSchema,objectId:reference.objectId,simbadId:reference.simbadId,retrievedAt:new Date().toISOString(),query,source,expectedCount:reference.expectedCount,papers});
    await writeFile(resolve(source),gzipSync(JSON.stringify(response)));
    const bytes = gzipSync(JSON.stringify(page)), path = `${paperRoot}/${reference.objectId}.json.gzip`;
    await writeFile(`${path}.tmp`,bytes); await rename(`${path}.tmp`,path);
    const status: PaperReference['status'] = !response.overflow && papers.length === reference.expectedCount ? 'complete' : 'partial';
    Object.assign(reference,{count:papers.length,path,bytes:bytes.length,status}); delete reference.error;
    downloaded++; console.log(`PAPERS_SAVED ${reference.objectId} count=${papers.length}/${reference.expectedCount} bytes=${bytes.length} status=${status}`);
  } catch(error) {
    reference.status = 'error'; reference.error = error instanceof Error?error.message:String(error); failures++;
    console.log(`PAPERS_FAILED ${reference.objectId} ${reference.error}`);
  }
  await publish();
}
await publish();
const complete = snapshot.objects.filter(o=>o.status==='complete').length;
console.log(`PAPER_INVENTORY_SAVED complete=${complete}/110 downloaded=${downloaded} cached=${cached} failed=${failures}`);
if (failures || snapshot.objects.some(o=>(!objectArg || o.objectId===objectArg) && o.status!=='complete')) process.exitCode=2;
