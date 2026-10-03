import { contextLineages } from '@cssearth/bake/sources';
import { spatialSourceCitations } from '@cssearth/bake/sources';
import { sourceResolver, parseSourceBinding } from '@cssearth/objects/sources';
import { PREPARED_EXPLORATION_SCHEMA, PREPARED_SOURCES_SCHEMA, compileSourceUsage, sourceCredits } from '@cssearth/objects/provenance';
import type { SourceUse, SourceUsageObject } from '@cssearth/objects/provenance';
import { parsePreparedSources } from '@cssearth/objects/provenance';
import { readSourceCatalog } from '@cssearth/bake/sources';
import { sourceInventory, metadataCitations, factsheetCitations } from '@cssearth/bake/sources';
import { verifyFactsheetSources } from '@cssearth/bake/sources';
import { sourcePath } from '@cssearth/objects/sources';
import type { SourceInventoryEntry } from '@cssearth/bake/sources';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RUNTIME_ASSET_ORIGIN } from '@cssearth/bake/objects/sources';
import sharp from 'sharp';
import { explorationRecord, explorationArray, explorationText, parseAgencies, parseCapture, validateCapture, parseExplorationCatalog } from '@cssearth/objects/provenance';
import { compileContributions } from '@cssearth/objects/provenance';
import { parsePreparedExploration, parseExplorationImage } from '@cssearth/objects/provenance';
import type { ExplorationImage } from '@cssearth/objects/provenance';
import { bodyLineage } from '@cssearth/bake/objects/lineage';
import { writePreparedSet } from '@cssearth/bake/delivery';
import { restoreFactsheetEvidence } from '@cssearth/bake/objects/acquisition';
import type { FactsheetSourceTransport } from '@cssearth/bake/objects/acquisition';
import { prepareVolumePresentations, readPreparedVolumes, volumePresentationCompilerClosure } from './prepare-volume-presentation.mts';
import { readPreparedObjects } from '@cssearth/objects/node';
import { CONTEXT_ROUTE, DATASET_ROUTES } from '@cssearth/objects/provenance';

const SCENE_OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../../..')).sceneObjects;

export const explorationCompilerClosure = [
  'site/build/prepare/prepare-facilities.mts', 'packages/bake/src/sources/spatial-source-citations.ts', 'packages/catalog/src/spatial.ts', 'packages/objects/src/prepared-data/galaxy-catalog.ts', 'packages/objects/src/prepared-data/spatial-relations.ts', 'packages/objects/src/prepared-data/cluster-catalog.ts', 'packages/objects/src/provenance/exploration-catalog.ts', 'packages/objects/src/provenance/exploration-contributions.ts',
  'packages/objects/src/provenance/prepared-exploration.ts', 'packages/objects/src/provenance/object-lineage.ts', 'packages/objects/src/provenance/product-input-evidence.ts', 'packages/objects/src/node/prepared-registry.ts', 'packages/objects/src/registry/object-schema.ts',
  'packages/objects/src/registry/object-catalog.ts', 'site/prepared-catalogue.mjs', 'site/build/prepare/prepare-catalog.mts', 'packages/objects/src/node/catalog-directory.ts',
  'packages/objects/src/registry/navigable-object.ts', 'packages/objects/src/registry/navigation-distance.ts', 'packages/bake/src/navigation/navigation-destinations.ts',
  'packages/objects/src/registry/object-zoom.ts', 'packages/objects/src/registry/object-tree.ts',
  'site/source/facilities/catalog.json', 'site/source/facilities/render-library.json', 'site/source/facilities/emblem-library.json',
  'site/source/agency-logos.json', 'packages/bake/src/sources/read-source-catalogue.ts',
  'packages/objects/src/sources/catalog.ts', 'packages/objects/src/provenance/source-usage.ts', 'packages/objects/src/node/source-manifest.ts',
  'packages/objects/src/provenance/prepared-sources.ts', 'packages/bake/src/sources/source-catalogue-inputs.ts',
  'packages/objects/src/provenance/dataset-destination.ts', 'packages/objects/src/provenance/dataset-routes.ts', ...volumePresentationCompilerClosure,
  'packages/bake/src/sources/factsheet-sources.ts', 'packages/objects/src/registry/fact-order.ts', 'packages/bake/src/objects/acquisition/restore-factsheet-evidence.ts',
  'packages/core/src/validate.ts', 'packages/bake/src/objects/acquisition/object-operations.ts', 'packages/bake/src/objects/acquisition/operations-acquisition.ts',
  'src/objects/milky-way-volume/source/sky/provenance.json', 'src/objects/milky-way-volume/source/provenance.json',
  'src/objects/stellar-neighbourhood/source/provenance.json', 'src/objects/heliosphere/source/provenance.json',
  'packages/bake/src/objects/lineage/body-lineage.ts', 'packages/bake/src/objects/lineage/lineage-recipes.ts',
] as const;

interface Options { root?: string; publish?: boolean | 'catalogues'; sourceTransport?: FactsheetSourceTransport;
  /** Catalogue consumers validate published package records; authoring explicitly reproduces them. */
  packageMode?: 'author' | 'published';
  /** Skip bodies whose `prepared/controls.json` this checkout has not restored. */
  restoredOnly?: boolean;
  /** Opt-in (default null/off) content-addressed mirror for volume previews; a production caller names
   * RUNTIME_ASSET_ORIGIN explicitly. Left off by default so a test never makes a surprise real request. */
  mirrorOrigin?: string | null; }
/** Runs `job` over `items` with up to `width` in flight, results in the items' order. */
async function pipelined<T, R>(items: readonly T[], width: number, job: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await job(items[index]!); }
  }));
  return results;
}

/** Compile evidenced links and reuse approved artwork, restoring only missing cited evidence. */
export async function prepareFacilities({ root = resolve(import.meta.dirname, '../../..'), publish = true, sourceTransport, mirrorOrigin = null,
  restoredOnly = false,
  packageMode = publish === 'catalogues' ? 'published' : 'author' }: Options = {}) {
  if (!['author', 'published'].includes(packageMode) || publish === 'catalogues' && packageMode !== 'published')
    throw new TypeError('Catalogue-only publication requires published package inputs.');
  const closure = new Set<string>();
  const input = async (path: string) => { const bytes = await readFile(resolve(root, path)); closure.add(path); return bytes; };
  const json = async (path: string): Promise<unknown> => JSON.parse((await input(path)).toString('utf8'));
  for (const path of explorationCompilerClosure) await input(path);
  const agencies = parseAgencies(await json('site/source/agency-logos.json'));
  const sourceCatalog = await readSourceCatalog(root, input), sources = sourceResolver(sourceCatalog);
  const catalog = parseExplorationCatalog(await json('site/source/facilities/catalog.json'), agencies, sources);
  const metadata: SourceUse[] = metadataCitations(catalog, 'site/source/facilities/catalog.json', sources);
  const inventory: SourceInventoryEntry[] = [];
  for (const path of explorationCompilerClosure.filter(path => path.startsWith('src/objects/') && path.endsWith('/provenance.json'))) {
    const owner = explorationRecord(await json(path)), display = explorationRecord(owner.catalogueDisplay);
    const binding = parseSourceBinding(owner.sourceBinding, sources);
    inventory.push({ownerPath:path,localId:explorationText(display.feature),binding,used:true});
    if (binding.kind !== 'catalogued') throw new TypeError('Shared context needs a canonical source.');
    for (const ref of binding.references) metadata.push({catalogueId:sources[ref.catalogueId].id,kind:'shared-context',consumerKind:'shared-context',
      consumerId:explorationText(display.feature),consumerLabel:explorationText(display.label),ownerPath:path,locator:'/sourceBinding',evidence:ref.evidence,
      datasetIds:[],limitations:[explorationText(display.description)],credit:explorationText(display.credit)});
  }
  async function artwork(file: string, emblem: boolean) {
    const library = explorationRecord(await json(file));
    if (library.schema !== (emblem ? 'cssearth-facility-emblems@3' : 'cssearth-facility-render-library@3')) throw new TypeError('Unsupported artwork library.');
    const entries = explorationArray(library.entries, explorationRecord).map((image, index) => {
      const source = explorationRecord(image.source);
      const binding = parseSourceBinding(image.sourceBinding, sources), id = explorationText(image.id);
      inventory.push({ownerPath:file,localId:id,binding,used:true});
      if (binding.kind !== 'catalogued') throw new TypeError('Artwork needs a canonical source.');
      for (const ref of binding.references) metadata.push({catalogueId:sources[ref.catalogueId].id,kind:'artwork',consumerKind:'artwork',consumerId:`${emblem ? 'emblem' : 'render'}/${id}`,
        consumerLabel:`${id} ${emblem ? 'emblem' : 'artwork'}`,ownerPath:file,locator:`/entries/${index}/sourceBinding`,evidence:ref.evidence,datasetIds:[],limitations:[],credit:explorationText(source.credit)});
      return parseExplorationImage({ id: image.id, src: emblem ? image.src : image.url,
        width: image.width, height: image.height, bytes: image.bytes,
        kind: emblem ? 'emblem' : source.kind, sourceUrl: emblem ? source.sourceUrl : source.sourcePage, credit: source.credit,
        ...(image.subject === undefined ? {} : { subject: image.subject }) });
    });
    for (const image of entries) {
      const bytes = await input(`public${image.src}`);
      if (bytes.length !== image.bytes) throw new Error(`Approved artwork identity changed: ${image.id}.`);
      const metadata = await sharp(bytes).metadata();
      if (metadata.format !== (emblem ? 'png' : 'webp') || metadata.width !== image.width || metadata.height !== image.height || (emblem && !metadata.hasAlpha)) throw new Error(`Approved artwork format/dimensions changed: ${image.id}.`);
    }
    return entries;
  }
  const images: readonly ExplorationImage[] = await artwork('site/source/facilities/render-library.json', false);
  const emblems: readonly ExplorationImage[] = await artwork('site/source/facilities/emblem-library.json', true);
  for (const agency of Object.values(agencies)) if (agency.src) {
    const bytes = await input(`public${agency.src}`);
    if (bytes.length !== agency.bytes) throw new Error(`Agency logo identity changed: ${agency.name}.`);
  }
  const objects: SourceUsageObject[] = [];
  const factsheets = { facts: 0 };
  // Each body reads only its own package, so the bodies are read 32 at a time and merged in registry order: one at a time,
  // their six or seven awaited reads left this step idle for 10 of its 18 s.
  const parts = await pipelined(SCENE_OBJECTS, 32, async object => {
    const part = { metadata: [] as SourceUse[], inventory: [] as SourceInventoryEntry[], facts: 0, object: null as SourceUsageObject | null };
    const base = `src/objects/${object.id}`;
    const descriptor = explorationRecord(await json(`${base}/object.json`));
    const manifest = explorationRecord(await json(`${base}/source/manifest.json`));
    const recipe = explorationRecord(explorationRecord(descriptor.properties).recipe);
    const contentReference = explorationArray(recipe.sources, explorationRecord).find(source => source.id === 'content');
    if (!contentReference) throw new Error(`Missing content recipe for ${object.id}.`);
    const contentPath = sourcePath(contentReference.path);
    if (!contentPath.startsWith('source/')) throw new TypeError('Body content must be inside its source directory.');
    const contentBytes = await input(`${base}/${contentPath}`);
    const contentPin = ['inputs', 'documents', 'generatedIntermediates'].flatMap(section => explorationArray(manifest[section] ?? [], explorationRecord))
      .filter(entry => `source/${entry.path}` === contentPath);
    if (contentPin.length !== 1) throw new Error(`Content source for ${object.id} is not declared once in its manifest.`);
    const content = explorationRecord(JSON.parse(contentBytes.toString('utf8')));
    const objectDirectory = resolve(root, base);
    const panel = await verifyFactsheetSources(content.panel, { objectDirectory, manifest, sources,
      read: path => input(`${base}/${path}`),
      restoreMissing: path => restoreFactsheetEvidence({ objectDirectory, path, manifest, transport: sourceTransport }),
    });
    // The published facts in prepared/content.json are written from this same panel by prepare:factsheets, which
    // prepare:object-json runs first.
    part.metadata.push(...factsheetCitations(panel, `${base}/${contentPath}`, object));
    part.facts += panel.facts.length + panel.moreFacts.length;
    for (const source of explorationArray(manifest.inputs, explorationRecord)) if (source.capture !== undefined) validateCapture(parseCapture(source.capture), catalog);
    // The runtime's controls, published beside it. A checkout that deliberately restores no body banks (the typecheck
    // job) lacks them; skipping there yields a partial catalogue, which is all a compiler program needs.
    const controlsPath = `${base}/prepared/controls.json`;
    if (restoredOnly && !existsSync(resolve(root, controlsPath))) return part;
    const controls = explorationRecord(await json(controlsPath));
    const datasets = controls.datasets === null ? [] : explorationArray(explorationRecord(controls.datasets).controls, raw => {
      const control = explorationRecord(raw); return { id: explorationText(control.id), label: explorationText(control.label) };
    });
    // The lineage is a view of this package's manifest and recipes, built here and never written.
    const lineage = await bodyLineage(objectDirectory);
    part.inventory.push(...sourceInventory(manifest, `${base}/source/manifest.json`, sources, new Set(lineage.sources.map(source => source.path))));
    part.object = { id: object.id, name: object.name, route: object.route, base, controls: datasets, lineage };
    return part;
  });
  for (const part of parts) {
    metadata.push(...part.metadata); inventory.push(...part.inventory); factsheets.facts += part.facts;
    if (part.object) objects.push(part.object);
  }
  // Deploys consume the volume presentations restored from R2. Authoring preparation still rebuilds the previews from
  // their sources, but catalog-only publication must never invent a second package identity.
  const volumes = packageMode === 'published' ? await readPreparedVolumes({ root, input }) : await prepareVolumePresentations({ root, input, mirrorOrigin });
  for (const volume of [...volumes, ...await contextLineages({ route: CONTEXT_ROUTE, root, input })]) {
    const manifestPath = `${sourcePath(volume.base)}/${sourcePath(volume.lineage.manifestPath)}`;
    const manifest = explorationRecord(await json(manifestPath));
    for (const source of explorationArray(manifest.inputs, explorationRecord)) if (source.capture !== undefined) validateCapture(parseCapture(source.capture), catalog);
    inventory.push(...sourceInventory(manifest, manifestPath, sources, new Set(volume.lineage.sources.map(source => source.path))));
    objects.push(volume);
  }
  for (const volume of volumes) {
    for (const output of volume.outputs) {
      // Generated presentations and previews join the same atomic set as both graphs.
      const path = sourcePath(output.path.slice(resolve(root).length + 1));
      if (resolve(root, path) !== output.path) throw new TypeError('Volume output escapes its package.');
      if (path.startsWith(`${volume.base}/prepared/`) || path === `${volume.base}/inventory.json`) closure.add(path);
      else if (!new RegExp(`^public/scenes/${volume.id}/datasets/[a-z0-9][a-z0-9-]*\\.webp$`).test(path)) throw new TypeError('Volume output escapes its package.');
    }
  }
  metadata.push(...await spatialSourceCitations(root, sources, input));
  const sourcePayload = {schema:PREPARED_SOURCES_SCHEMA,catalog:sourceCatalog,
    usage:compileSourceUsage(objects,sources,DATASET_ROUTES,metadata),inventory,closure:[...closure].sort()};
  const preparedSources = parsePreparedSources(sourcePayload,DATASET_ROUTES);
  const payload = { schema: PREPARED_EXPLORATION_SCHEMA, catalog, agencies, images, emblems,
    graph: compileContributions(objects, catalog, DATASET_ROUTES) };
  const prepared = parsePreparedExploration(payload,sources,DATASET_ROUTES);
  const output = { path: resolve(root, 'site/prepared-facilities.json'), text: JSON.stringify(payload, null, 2) + '\n' };
  const sourcesOutput = {path:resolve(root,'site/prepared-sources.json'),text:JSON.stringify(sourcePayload,null,2)+'\n'};
  // What the pages read of it: each object's provider index (@cssearth/objects/provenance).
  const creditsOutput = {path:resolve(root,'site/prepared-source-credits.json'),text:JSON.stringify(sourceCredits(preparedSources.usage,preparedSources.sources))+'\n'};
  const catalogueOutputs = [sourcesOutput,creditsOutput,output];
  const outputs = [...volumes.flatMap(volume => volume.outputs),...catalogueOutputs];
  if (publish) await writePreparedSet(publish === 'catalogues' ? catalogueOutputs : outputs);
  return { prepared, preparedSources, output, outputs, catalogueOutputs, factsheets };

}

// Entry script: node site/build/prepare/prepare-facilities.mts [--catalog-only] [--restored-only].
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--catalog-only' && arg !== '--restored-only'))
    throw new TypeError('Usage: node site/build/prepare/prepare-facilities.mts [--catalog-only] [--restored-only]');
  // The real CLI entry point: opts into the mirror explicitly (the library defaults it off).
  const { prepared, factsheets } = await prepareFacilities({ mirrorOrigin: RUNTIME_ASSET_ORIGIN,
    publish: args.includes('--catalog-only') ? 'catalogues' : true, restoredOnly: args.includes('--restored-only') });
  console.log(`Prepared ${prepared.catalog.missions.length} missions, ${prepared.catalog.facilities.length} facilities and ${prepared.graph.datasets.length} dataset destinations.`);
  console.log(`Factsheets: ${factsheets.facts} facts, each with its own citation.`);
}
