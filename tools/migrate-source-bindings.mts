import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { sourceArray, sourceObject, sourceText, parseSourceCatalog, sourceResolver, parseSourceBinding } from '../src/platform/source-catalog.mts';
import { canonicalSourceJson, sourceSha256 } from './source-catalogue-inputs.mts';
import { writePreparedSet } from './write-prepared-set.mts';
/** Explicit historical migration. Normal preparation never guesses a binding. */
export async function migrateSourceBindings(root = process.cwd()) {
  const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(root,path),'utf8'));
  const sources = sourceResolver(parseSourceCatalog(await read('src/sources/catalog.json')));
  const fixture = sourceObject(await read('tests/fixtures/sources/migration.json'));
  if (fixture.schema !== 'cssearth-source-migration@1') throw new TypeError('Unsupported source migration.');
  const owners = new Map<string,Record<string,unknown>>();
  for (const entry of sourceArray(fixture.entries,sourceObject)) {
    const path = sourceText(entry.ownerPath), locator = sourceText(entry.locator);
    if (!/^src\/planets\/[a-z0-9-]+\/source\/manifest.json$/.test(path) || !/^\/(inputs|documents|generatedIntermediates)\/\d+$/.test(locator)) throw new TypeError('Invalid migration owner.');
    const owner = owners.get(path) ?? sourceObject(await read(path)); owners.set(path,owner);
    const [,section,index] = locator.split('/'), rows = sourceArray(owner[section],sourceObject), row = rows[Number(index)];
    if (!row || (row.id ?? row.path) !== entry.localId) throw new TypeError(`Migration row moved: ${path}${locator}.`);
    const {sourceBinding, ...original} = row;
    if (sourceSha256(canonicalSourceJson(original)) !== entry.beforeSha256) throw new TypeError(`Migration source changed: ${path}${locator}.`);
    const binding = parseSourceBinding(entry.binding,sources);
    if (sourceBinding && canonicalSourceJson(sourceBinding) !== canonicalSourceJson(binding)) throw new TypeError(`Migration would replace an authored binding: ${path}${locator}.`);
    row.sourceBinding = binding;
    owner.schema = `css${path.split('/')[2]}-authoritative-sources@2`;
  }
  await writePreparedSet([...owners].map(([path,owner]) => ({path:resolve(root,path),text:JSON.stringify(owner,null,2)+'\n'})));
  return owners.size;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(`Migrated ${await migrateSourceBindings()} manifests from the reviewed mapping.`);
