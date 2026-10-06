/** Discover metadata only. Resumable snapshots never download or bake scientific imagery. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { archiveProviders, readArchiveQuery, readMessierCatalogue, readMessierInventory, type ArchiveProvider, type MessierInventory } from '../../../features/catalogue/types.ts';
import { inventoryPolicy, inventoryQuery, pendingQuery } from '../../../features/catalogue/archives.ts';
import { inventoryStorage } from '../../../features/catalogue/selection.ts';
import { archiveTable } from '../../../adapters/sources/archive-tables.ts';

const root = process.cwd(), args = process.argv.slice(2);
const allowed = /^(--refresh|--retry-errors|--object=m(?:[1-9]|[1-9][0-9]|10[0-9]|110)|--provider=(?:mast|irsa|eso)|--max-records=\d+)$/;
if (args.some(a => !allowed.test(a))) throw new TypeError('Usage: inventory-messier [--object=m42] [--provider=mast|irsa|eso] [--max-records=2000] [--refresh|--retry-errors]');
const objectIds = args.filter(a => a.startsWith('--object=')).map(a => a.slice(9));
const providers = args.filter(a => a.startsWith('--provider=')).map(a => a.slice(11));
const maxRecords = Number(args.find(a => a.startsWith('--max-records='))?.slice(14) ?? 2000);
if (!Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > 20000) throw new TypeError('max-records must be 1–20000 per object/archive.');
const cataloguePath = 'labs/nebula/models/messier/catalogue.json', bytes = await readFile(resolve(root, cataloguePath));
const catalogue = readMessierCatalogue(JSON.parse(bytes.toString()));
const directory = resolve(root, '.local/nebula-lab/catalogue/messier');
await mkdir(directory, { recursive: true });
await mkdir(resolve(directory, 'queries'), { recursive: true });
const indexPath = resolve(directory, 'index.json');
let inventory: MessierInventory = { schema: 'cssearth-messier-inventory@1', generatedAt: new Date().toISOString(), catalogue: cataloguePath,
  policy: inventoryPolicy, targets: catalogue.objects.map(object => ({ objectId: object.id, queries: archiveProviders.map(p => pendingQuery(p, object)) })) };
try {
  const saved = readMessierInventory(JSON.parse(await readFile(indexPath, 'utf8')));
  if (saved.catalogue === cataloguePath && saved.policy === inventoryPolicy) {
    for (const target of saved.targets) for (let index = 0; index < target.queries.length; index++) {
      const query = target.queries[index]!;
      if (!query.imagesPath) continue;
      const content = await readFile(resolve(root, query.imagesPath)), page = readArchiveQuery(JSON.parse(content.toString()));
      if (page.provider !== query.provider || page.images.length !== query.imageCount) throw new Error(`Cached archive page ${query.imagesPath} does not match its index entry.`);
      target.queries[index] = page;
    }
    delete saved.storage; inventory = saved;
  }
} catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) console.warn(`Previous snapshot cannot be resumed: ${String(error)}`); }
let writing = Promise.resolve();
function save() {
  inventory.generatedAt = new Date().toISOString();
  const files = inventory.targets.flatMap(target => target.queries.filter(q => q.status !== 'pending').map(query => ({
    path: `.local/nebula-lab/catalogue/messier/queries/${target.objectId}-${query.provider}.json`,
    contents: JSON.stringify(query), query,
  })));
  const snapshot: MessierInventory = { ...inventory, storage: inventoryStorage(inventory), targets: inventory.targets.map(target => ({ ...target,
    queries: target.queries.map(query => {
      const file = files.find(f => f.query === query); return file ? { ...query, images: [], imageCount: query.images.length,
        imagesPath: file.path } : query;
    }),
  })) };
  writing = writing.then(async () => {
    // Write each changed page first, then atomically replace its index. Readers check each page's provider and count.
    for (const file of files) {
      if (writtenPages.get(file.path) === file.contents) continue;
      const path = resolve(root, file.path); await writeFile(`${path}.tmp`, file.contents); await rename(`${path}.tmp`, path); writtenPages.set(file.path, file.contents);
    }
    const temporary = `${indexPath}.tmp`; await writeFile(temporary, JSON.stringify(snapshot)); await rename(temporary, indexPath);
  });
  return writing;
}
const writtenPages = new Map<string, string>();
await save();
const controller = new AbortController();
process.once('SIGINT', () => controller.abort()); process.once('SIGTERM', () => controller.abort());
// One in-flight query per archive; independent providers run concurrently, never a request storm.
await Promise.all(archiveProviders.filter(p => !providers.length || providers.includes(p)).map(async (provider: ArchiveProvider) => {
  for (const object of catalogue.objects.filter(o => !objectIds.length || objectIds.includes(o.id))) {
    if (controller.signal.aborted) break;
    const target = inventory.targets.find(t => t.objectId === object.id)!, index = target.queries.findIndex(q => q.provider === provider), previous = target.queries[index]!;
    if (!args.includes('--refresh') && previous.status !== 'pending' && !(args.includes('--retry-errors') && previous.status === 'error')) continue;
    const started = Date.now();
    console.log(`QUERY ${object.id} ${provider}`);
    const result = await inventoryQuery(provider, object, maxRecords, archiveTable, controller.signal);
    target.queries[index] = readArchiveQuery(result);
    await save();
    console.log(`RESULT ${object.id} ${provider} ${result.status} ${result.images.length} images ${((Date.now() - started) / 1000).toFixed(1)}s${result.error ? ` ${result.error}` : ''}`);
  }
}));
await writing;
const verified = readMessierInventory(JSON.parse(await readFile(indexPath, 'utf8'))), storage = inventoryStorage(verified);
await writeFile(resolve(directory, 'summary.json'), `${JSON.stringify({ generatedAt: verified.generatedAt, catalogue: cataloguePath,
  policy: verified.policy, ...storage, indexBytes: (await readFile(indexPath)).byteLength }, null, 2)}\n`);
console.log(`MESSIER_INVENTORY_SAVED ${JSON.stringify(storage)}`);
// Partial/error receipts are useful evidence, but must not masquerade as successful queries.
const selected = verified.targets.filter(t => !objectIds.length || objectIds.includes(t.objectId)).flatMap(t => t.queries).filter(q => !providers.length || providers.includes(q.provider));
if (selected.some(q => q.status === 'error' || q.status === 'pending')) process.exitCode = 2;
