import { prepareContextProvenance, contextProvenanceCompilerClosure, readPreparedContextProvenance } from '@cssearth/bake/sources';
import { spatialSourceCitations } from '@cssearth/bake/sources';
import { sourceResolver, parseSourceBinding } from '@cssearth/objects/sources';
import { compileSourceUsage } from '@cssearth/objects/provenance';
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
import { validateObjectProvenance } from '@cssearth/objects/provenance';
import { prepareObjectProvenance } from '@cssearth/bake/objects/provenance';
import type { ProvenanceDocument } from '@cssearth/objects/provenance';
import { writePreparedSet } from '@cssearth/bake/delivery';
import { restoreFactsheetEvidence } from '@cssearth/bake/objects/acquisition';
import type { FactsheetSourceTransport } from '@cssearth/bake/objects/acquisition';
import { prepareVolumeProvenance, readPreparedVolumeProvenance, volumeProvenanceCompilerClosure } from './prepare-volume-provenance.mts';
import { readPreparedObjects } from '@cssearth/objects/node';
import { CONTEXT_ROUTE, DATASET_ROUTES } from '../../../src/platform/dataset-destination.mts';

const SCENE_OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../../..')).sceneObjects;

export const explorationCompilerClosure = [
  'site/build/prepare/prepare-facilities.mts', 'packages/bake/src/sources/spatial-source-citations.ts', 'packages/catalog/src/spatial.ts', 'packages/catalog/src/spatial-relations.ts', 'packages/catalog/src/clusters.ts', 'packages/objects/src/provenance/exploration-catalog.ts', 'packages/objects/src/provenance/exploration-contributions.ts',
  'packages/objects/src/provenance/prepared-exploration.ts', 'packages/objects/src/provenance/object-provenance.ts', 'packages/objects/src/provenance/preparation-evidence.ts', 'packages/bake/src/sources/preparation-evidence.ts', 'packages/objects/src/provenance/product-input-evidence.ts', 'packages/objects/src/node/prepared-registry.ts', 'packages/objects/src/registry/object-schema.ts',
  'packages/objects/src/registry/object-catalog.ts', 'site/prepared-object-discovery.json', 'site/build/prepare/prepare-catalog.mts', 'packages/objects/src/node/catalog-directory.ts',
  'packages/objects/src/registry/prepared-focus-object.ts', 'packages/objects/src/registry/navigation-distance.ts', 'packages/bake/src/navigation/navigation-destinations.ts',
  'site/prepared-object-distances.json', 'site/prepared-focus-objects.json',
  'site/source/facilities/catalog.json', 'site/source/facilities/render-library.json', 'site/source/facilities/emblem-library.json',
  'site/source/agency-logos.json', 'packages/bake/src/sources/read-source-catalogue.ts',
  'packages/objects/src/sources/catalog.ts', 'packages/objects/src/provenance/source-usage.ts', 'packages/objects/src/node/source-manifest.ts',
  'packages/objects/src/provenance/prepared-sources.ts', 'packages/bake/src/sources/source-catalogue-inputs.ts',
  'src/platform/dataset-destination.mts', 'packages/objects/src/provenance/dataset-routes.ts', ...volumeProvenanceCompilerClosure, ...contextProvenanceCompilerClosure,
  'packages/bake/src/sources/factsheet-sources.ts', 'packages/objects/src/registry/fact-order.ts', 'packages/bake/src/objects/acquisition/restore-factsheet-evidence.ts',
  'packages/core/src/validate.ts', 'packages/bake/src/objects/acquisition/object-operations.ts', 'packages/bake/src/objects/acquisition/operations-acquisition.ts',
  'src/objects/milky-way/source/sky/provenance.json', 'src/objects/milky-way/source/provenance.json',
  'src/objects/stellar-neighbourhood/source/provenance.json', 'src/objects/heliosphere/source/provenance.json',
  'packages/bake/src/objects/provenance/object-provenance.ts', 'packages/bake/src/objects/provenance/provenance-records.ts', 'packages/bake/src/objects/provenance/provenance-recipes.ts', 'packages/bake/src/objects/provenance/recover-provenance.ts',
] as const;

interface Options { root?: string; publish?: boolean | 'catalogues'; provenance?: ReadonlyMap<string, ProvenanceDocument>; sourceTransport?: FactsheetSourceTransport;
  /** Catalogue consumers validate published package records; authoring explicitly reproduces them. */
  packageMode?: 'author' | 'published';
  /** Skip bodies whose derived `prepared/page.json` this checkout has not restored. */
  restoredOnly?: boolean;
  /** Opt-in (default null/off) content-addressed mirror for volume previews; a production caller names
   * RUNTIME_ASSET_ORIGIN explicitly. Left off by default so a test never makes a surprise real request. */
  mirrorOrigin?: string | null; }
/** Compile evidenced links and reuse approved artwork, restoring only missing cited evidence. */
export async function prepareFacilities({ root = resolve(import.meta.dirname, '../../..'), publish = true, provenance = new Map(), sourceTransport, mirrorOrigin = null,
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
      lensIds:[],limitations:[explorationText(display.description)],credit:explorationText(display.credit)});
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
        consumerLabel:`${id} ${emblem ? 'emblem' : 'artwork'}`,ownerPath:file,locator:`/entries/${index}/sourceBinding`,evidence:ref.evidence,lensIds:[],limitations:[],credit:explorationText(source.credit)});
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
  for (const object of SCENE_OBJECTS) {
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
    metadata.push(...factsheetCitations(panel, `${base}/${contentPath}`, object));
    factsheets.facts += panel.facts.length + panel.moreFacts.length;
    for (const source of explorationArray(manifest.inputs, explorationRecord)) if (source.capture !== undefined) validateCapture(parseCapture(source.capture), catalog);
    // `prepared/page.json` is derived from the restored runtime, so a checkout that deliberately
    // restores no body banks (the typecheck job) does not have one. Skipping there yields a partial
    // catalogue, which is all a compiler program needs; every publishing path leaves this off and
    // still fails loudly on a missing page.
    const pagePath = `${base}/prepared/page.json`;
    if (restoredOnly && !existsSync(resolve(root, pagePath))) continue;
    const page = explorationRecord(await json(pagePath));
    if (page.schema !== 'cssearth-object-page@1' || page.id !== object.id) throw new Error(`Stale prepared controls for ${object.id}.`);
    const controls = explorationRecord(page.controls);
    const lenses = controls.lenses === null ? [] : explorationArray(explorationRecord(controls.lenses).controls, raw => {
      const control = explorationRecord(raw); return { id: explorationText(control.id), label: explorationText(control.label) };
    });
    // The record is a view of this package's manifest and recipes, so it is built here rather than read back and compared.
    const document = provenance.get(object.id) ?? validateObjectProvenance(await prepareObjectProvenance({ objectDirectory,
      publicDirectory: resolve(root, 'public/scenes', object.id), basis: 'recovered', verify: false, write: false }), object.id);
    inventory.push(...sourceInventory(manifest, `${base}/source/manifest.json`, sources, new Set(document.sources.map(source => source.path))));
    objects.push({ id: object.id, name: object.name, route: object.route, base, controls: lenses, provenance: document });
  }
  // Deploys consume the exact prepared package restored from R2. Authoring preparation still rebuilds provenance
  // and previews from their sources, but catalog-only publication must never invent a second package identity.
  const volumes = packageMode === 'published'
    ? [...await readPreparedVolumeProvenance({ root, input }),
      ...await readPreparedContextProvenance({ route: CONTEXT_ROUTE, root, input })]
    : [...await prepareVolumeProvenance({ root, input, mirrorOrigin }), ...await prepareContextProvenance({ route: CONTEXT_ROUTE, root, input })];
  for (const volume of volumes) {
    const document = validateObjectProvenance(volume.provenance, volume.id);
    const manifestPath = `${sourcePath(volume.base)}/${sourcePath(document.manifest.path)}`;
    const manifest = explorationRecord(await json(manifestPath));
    for (const source of explorationArray(manifest.inputs, explorationRecord)) if (source.capture !== undefined) validateCapture(parseCapture(source.capture), catalog);
    inventory.push(...sourceInventory(manifest, manifestPath, sources, new Set(document.sources.map(source => source.path))));
    objects.push(volume);
    for (const output of volume.outputs) {
      // Generated lineage and presentation join the same atomic set as both graphs.
      const path = sourcePath(output.path.slice(resolve(root).length + 1));
      if (resolve(root, path) !== output.path) throw new TypeError('Volume output escapes its package.');
      if (path.startsWith(`${volume.base}/prepared/`) || path === `${volume.base}/inventory.json`) closure.add(path);
      else if (!new RegExp(`^public/scenes/${volume.id}/datasets/[a-f0-9]{64}\\.webp$`).test(path)) throw new TypeError('Volume output escapes its package.');
    }
  }
  metadata.push(...await spatialSourceCitations(root, sources, input));
  const sourcePayload = {schema:'cssearth-prepared-sources@1',catalog:sourceCatalog,
    usage:compileSourceUsage(objects,sources,DATASET_ROUTES,metadata),inventory,closure:[...closure].sort()};
  const preparedSources = parsePreparedSources(sourcePayload,DATASET_ROUTES);
  const payload = { schema: 'cssearth-prepared-exploration@3', catalog, agencies, images, emblems,
    graph: compileContributions(objects, catalog, DATASET_ROUTES) };
  const prepared = parsePreparedExploration(payload,sources,DATASET_ROUTES);
  const output = { path: resolve(root, 'site/prepared-facilities.json'), text: JSON.stringify(payload, null, 2) + '\n' };
  const sourcesOutput = {path:resolve(root,'site/prepared-sources.json'),text:JSON.stringify(sourcePayload,null,2)+'\n'};
  const catalogueOutputs = [sourcesOutput,output];
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
