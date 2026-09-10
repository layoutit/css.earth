import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OBJECTS } from '../site/objects.mts';
import { sourceObject, sourceArray, sourceText, parseSourceCatalog } from '../src/platform/source-catalog.mts';
import { parsePreparedSources } from '../src/platform/prepared-sources.mts';
import { parsePreparedExploration } from '../src/platform/prepared-exploration.mts';
import { canonicalSourceJson, sourceSha256 } from './source-catalogue-inputs.mts';
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path,'utf8'));
/** One-time migration audit against the frozen docs-PR baseline. Future source updates do not rerun this historical comparison in the normal suite. */
export async function checkSourceMigration() {
  const fixture = sourceObject(await read('tests/fixtures/sources/migration.json'));
  const prepared = parsePreparedSources(await read('site/prepared-sources.json'));
  const exploration = parsePreparedExploration(await read('site/prepared-spacecraft.json'),prepared.sources);

  const referenceMap = sourceObject(fixture.missionReferences);
  const reverse = new Map(Object.entries(referenceMap).map(([id,ref]) => [canonicalSourceJson(ref),id]));
  for (const [path,hash] of Object.entries(sourceObject(fixture.ownerSha256))) {
    const owner=sourceObject(await read(path));
    if (path.endsWith('/manifest.json')) {
      owner.schema=sourceText(owner.schema).replace('@2','@1');
      for (const collection of ['inputs','documents','generatedIntermediates']) for (const row of sourceArray(owner[collection],sourceObject)) delete row.sourceBinding;
    } else if (path.endsWith('/catalog.json')) {
      const walk = (raw: unknown): unknown => {
        if (Array.isArray(raw)) return raw.map(walk);
        if (!raw || typeof raw !== 'object') return raw;
        return Object.fromEntries(Object.entries(sourceObject(raw)).map(([key,value]) => key === 'citations'
          ? ['referenceIds',sourceArray(value,ref => {const id=reverse.get(canonicalSourceJson(ref));assert.ok(id,'original claim citation');return id;})] : [key,walk(value)]));
      };
      Object.assign(owner,sourceObject(walk(owner)));
      owner.schema='cssearth-spacecraft-catalog@2';
      // Original order and titles are fixed by historical evidence, not current URLs.
      const catalog=parseSourceCatalog(await read('src/sources/catalog.json'));
      owner.references=Object.entries(referenceMap).map(([id,raw]) => {
        const citation=sourceObject(raw),record=catalog.records.find(record=>record.id===citation.catalogueId)!;
        return {id,title:record.title,url:record.links[0].url,checkedOn:citation.checkedOn,...(citation.locator?{locator:citation.locator}:{})};
      });
    } else {
      owner.schema=sourceText(owner.schema).replace('@2','@1');
      for (const row of sourceArray(owner.entries,sourceObject)) delete row.sourceBinding;
    }
    assert.equal(sourceSha256(canonicalSourceJson(owner)),hash,path);
  }
  assert.equal(OBJECTS.length,473);
  assert.equal(prepared.inventory.filter(row=>row.ownerPath.includes('/planets/') && row.binding.kind==='catalogued').length,2412);
  assert.equal(sourceSha256(canonicalSourceJson(exploration.graph)),fixture.contributionGraphSha256,'capture graph remains unchanged');
  return {baseline:fixture.revision,objects:OBJECTS.length,owners:Object.keys(sourceObject(fixture.ownerSha256)).length,unchanged:true};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(await checkSourceMigration()));
