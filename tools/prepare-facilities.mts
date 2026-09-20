import { sha256 } from '../src/platform/sha256.mts';
import { prepareContextProvenance, contextProvenanceCompilerClosure } from './prepare-context-provenance.mts';
import { readPreparedContextProvenance } from './read-prepared-context-provenance.mts';
import { spatialSourceCitations } from './spatial-source-citations.mts';
import { sourceResolver, parseSourceBinding } from '../src/platform/source-catalog.mts';
import { compileSourceUsage } from '../src/platform/source-usage.mts';
import type { SourceUse, SourceUsageObject } from '../src/platform/source-usage.mts';
import { parsePreparedSources, sourceCatalogDigest } from '../src/platform/prepared-sources.mts';
import { readSourceCatalog } from './read-source-catalogue.mts';
import { sourceInventory, metadataCitations, factsheetCitations } from './source-catalogue-inputs.mts';
import { parseFactsheet, verifyFactsheetSources } from './factsheet-sources.mts';
import { sourcePath, sourceDigest } from '../src/platform/source-catalog.mts';
import type { SourceInventoryEntry } from './source-catalogue-inputs.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { SCENE_OBJECTS } from '../site/objects.mts';
import { explorationRecord, explorationArray, explorationText, parseAgencies, parseCapture, validateCapture, parseExplorationCatalog } from '../src/platform/exploration-catalog.mts';
import { compileContributions } from '../src/platform/exploration-contributions.mts';
import { parsePreparedExploration, parseExplorationImage } from '../src/platform/prepared-exploration.mts';
import type { ExplorationImage } from '../src/platform/prepared-exploration.mts';
import { validateObjectProvenance } from '../src/platform/object-provenance.mts';
import type { ProvenanceDocument } from '../src/platform/object-provenance.mts';
import { writePreparedSet } from './write-prepared-set.mts';
import { restoreFactsheetEvidence } from './restore-factsheet-evidence.mts';
import type { FactsheetSourceTransport } from './restore-factsheet-evidence.mts';
import { prepareVolumeProvenance, readPreparedVolumeProvenance, volumeProvenanceCompilerClosure } from './prepare-volume-provenance.mts';
import { RUNTIME_ASSET_ORIGIN } from './source-mirror.mts';
export const explorationCompilerClosure = [
  'tools/prepare-facilities.mts', 'tools/spatial-source-citations.mts', 'packages/catalog/src/spatial.ts', 'packages/catalog/src/spatial-relations.ts', 'packages/catalog/src/clusters.ts', 'src/platform/exploration-catalog.mts', 'src/platform/exploration-contributions.mts',
  'src/platform/prepared-exploration.mts', 'src/platform/object-provenance.mts', 'src/platform/preparation-evidence.mts', 'tools/preparation-evidence.mts', 'src/platform/product-input-evidence.mts', 'site/objects.mts', 'site/object-schema.mts',
  'site/object-catalog.mts', 'site/prepared-object-catalog.mts', 'tools/prepare-catalog.mts',
  'site/prepared-focus-object.mts', 'site/navigation-distance.mts', 'tools/prepare-navigation-destinations.mts',
  'site/prepared-object-distances.json', 'site/prepared-focus-objects.json',
  'site/source/facilities/catalog.json', 'site/source/facilities/render-library.json', 'site/source/facilities/emblem-library.json',
  'site/source/agency-logos.json', 'tools/read-source-catalogue.mts',
  'src/platform/source-catalog.mts', 'src/platform/source-usage.mts', 'src/platform/source-manifest.mts',
  'src/platform/prepared-sources.mts', 'tools/source-catalogue-inputs.mts',
  'src/platform/dataset-destination.mts', ...volumeProvenanceCompilerClosure, ...contextProvenanceCompilerClosure,
  'tools/factsheet-sources.mts', 'site/fact-order.mts', 'tools/restore-factsheet-evidence.mts',
  'tools/source-values.mts', 'tools/objects/operations.ts', 'tools/objects/operations-acquisition.ts',
  'src/objects/milky-way/source/sky/provenance.json', 'src/objects/milky-way/source/provenance.json',
  'src/objects/stellar-neighbourhood/source/provenance.json', 'src/objects/heliosphere/source/provenance.json',
  'tools/objects/provenance.mts', 'tools/objects/provenance-records.mts', 'tools/objects/provenance-recipes.mts', 'tools/prepare-provenance.mts',
] as const;

interface Options { root?: string; publish?: boolean | 'catalogues'; provenance?: ReadonlyMap<string, ProvenanceDocument>; sourceTransport?: FactsheetSourceTransport;
  /** Opt-in (default null/off) content-addressed mirror for volume previews; a production caller names
   * RUNTIME_ASSET_ORIGIN explicitly. Left off by default so a test never makes a surprise real request. */
  mirrorOrigin?: string | null; }
/** Compile evidenced links and reuse approved artwork, restoring only missing cited evidence. */
export async function prepareFacilities({ root = resolve(import.meta.dirname, '..'), publish = true, provenance = new Map(), sourceTransport, mirrorOrigin = null }: Options = {}) {
  const closure: Record<string, string> = {};
  const input = async (path: string) => {
    const bytes = await readFile(resolve(root, path)); closure[path] = sha256(bytes); return bytes;
  };
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
        width: image.width, height: image.height, bytes: image.bytes, sha256: image.sha256,
        kind: emblem ? 'emblem' : source.kind, sourceUrl: emblem ? source.sourceUrl : source.sourcePage, credit: source.credit,
        ...(image.subject === undefined ? {} : { subject: image.subject }) });
    });
    for (const image of entries) {
      const bytes = await input(`public${image.src}`);
      if (bytes.length !== image.bytes || sha256(bytes) !== image.sha256) throw new Error(`Approved artwork identity changed: ${image.id}.`);
      const metadata = await sharp(bytes).metadata();
      if (metadata.format !== (emblem ? 'png' : 'webp') || metadata.width !== image.width || metadata.height !== image.height || (emblem && !metadata.hasAlpha)) throw new Error(`Approved artwork format/dimensions changed: ${image.id}.`);
    }
    return entries;
  }
  const images: readonly ExplorationImage[] = await artwork('site/source/facilities/render-library.json', false);
  const emblems: readonly ExplorationImage[] = await artwork('site/source/facilities/emblem-library.json', true);
  for (const agency of Object.values(agencies)) if (agency.src) {
    const bytes = await input(`public${agency.src}`);
    if (sha256(bytes) !== agency.sha256 || bytes.length !== agency.bytes) throw new Error(`Agency logo identity changed: ${agency.name}.`);
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
    if (contentPin.length !== 1 || contentPin[0]!.expectedBytes !== contentBytes.length || contentPin[0]!.expectedSha256 !== sha256(contentBytes)) throw new Error(`Changed content source for ${object.id}.`);
    const content = explorationRecord(JSON.parse(contentBytes.toString('utf8')));
    const objectDirectory = resolve(root, base);
    const panel = await verifyFactsheetSources(content.panel, { objectDirectory, manifest, sources,
      read: path => input(`${base}/${path}`),
      restoreMissing: path => restoreFactsheetEvidence({ objectDirectory, path, manifest, transport: sourceTransport }),
    });
    const published = explorationRecord(await json(`${base}/prepared/content.json`));
    if (published.objectId !== object.id || JSON.stringify(parseFactsheet(published)) !== JSON.stringify(panel)) throw new Error(`Stale factsheet for ${object.id}; run pnpm prepare:factsheets -- ${object.id}.`);
    metadata.push(...factsheetCitations(panel, `${base}/${contentPath}`, object));
    factsheets.facts += panel.facts.length + panel.moreFacts.length;
    for (const source of explorationArray(manifest.inputs, explorationRecord)) if (source.capture !== undefined) validateCapture(parseCapture(source.capture), catalog);
    const page = explorationRecord(await json(`${base}/prepared/page.json`));
    if (page.schema !== 'cssearth-object-page@1' || page.id !== object.id || page.sceneSha256 !== explorationRecord(descriptor.prepared).sha256) throw new Error(`Stale prepared controls for ${object.id}.`);
    const controls = explorationRecord(page.controls);
    const lenses = controls.lenses === null ? [] : explorationArray(explorationRecord(controls.lenses).controls, raw => {
      const control = explorationRecord(raw); return { id: explorationText(control.id), label: explorationText(control.label) };
    });
    const path = `${base}/prepared/provenance.json`;
    let document = provenance.get(object.id);
    if (document) closure[path] = sha256(JSON.stringify(document, null, 2) + '\n');
    else document = validateObjectProvenance(await json(path), object.id);
    if (document.manifest.sha256 !== closure[`${base}/source/manifest.json`]) throw new Error(`Provenance for ${object.id} does not match its source manifest; run node tools/prepare-provenance.mts ${object.id}, or prepare the body where its sources are.`);
    inventory.push(...sourceInventory(manifest, `${base}/source/manifest.json`, sources, new Set(document.sources.map(source => source.path))));
    objects.push({ id: object.id, name: object.name, route: object.route, base, controls: lenses, provenance: document });
  }
  // Deploys consume the exact prepared package restored from R2. Authoring preparation still rebuilds provenance
  // and previews from their sources, but catalog-only publication must never invent a second package identity.
  const volumes = publish === 'catalogues'
    ? [...await readPreparedVolumeProvenance({ root, input }),
      ...await readPreparedContextProvenance({ root, input })]
    : [...await prepareVolumeProvenance({ root, input, mirrorOrigin }), ...await prepareContextProvenance({ root, input })];
  for (const volume of volumes) {
    const document = validateObjectProvenance(volume.provenance, volume.id);
    const manifestPath = `${sourcePath(volume.base)}/${sourcePath(document.manifest.path)}`;
    const manifest = explorationRecord(await json(manifestPath));
    if (document.manifest.sha256 !== closure[manifestPath]) throw new Error(`Provenance for ${volume.id} does not match its source manifest; run pnpm prepare:provenance.`);
    for (const source of explorationArray(manifest.inputs, explorationRecord)) if (source.capture !== undefined) validateCapture(parseCapture(source.capture), catalog);
    inventory.push(...sourceInventory(manifest, manifestPath, sources, new Set(document.sources.map(source => source.path))));
    objects.push(volume);
    for (const output of volume.outputs) {
      // Generated lineage and presentation join the same atomic set as both graphs.
      const path = sourcePath(output.path.slice(resolve(root).length + 1));
      if (resolve(root, path) !== output.path) throw new TypeError('Volume output escapes its package.');
      if (path.startsWith(`${volume.base}/prepared/`)) closure[path] = sha256(output.text);
      else if (path === `${volume.base}/runtime-assets.json`) closure[path] = sha256(output.text);
      else if (!new RegExp(`^public/scenes/${volume.id}/datasets/[a-f0-9]{64}\\.webp$`).test(path)) throw new TypeError('Volume output escapes its package.');
    }
  }
  metadata.push(...await spatialSourceCitations(root, sources, input));
  const sourcePayload = {schema:'cssearth-prepared-sources@1',catalog:sourceCatalog,catalogSha256:sourceCatalogDigest(sourceCatalog),
    usage:compileSourceUsage(objects,sources,metadata),inventory,closure};
  const preparedSources = parsePreparedSources(sourcePayload);
  const payload = { schema: 'cssearth-prepared-exploration@3', catalog, agencies, images, emblems,
    sourceCatalogSha256:preparedSources.catalogSha256,graph: compileContributions(objects, catalog) };
  const prepared = parsePreparedExploration(payload,sources);
  const output = { path: resolve(root, 'site/prepared-facilities.json'), text: JSON.stringify(payload, null, 2) + '\n' };
  const sourcesOutput = {path:resolve(root,'site/prepared-sources.json'),text:JSON.stringify(sourcePayload,null,2)+'\n'};
  const catalogueOutputs = [sourcesOutput,output];
  const outputs = [...volumes.flatMap(volume => volume.outputs),...catalogueOutputs];
  if (publish) await writePreparedSet(publish === 'catalogues' ? catalogueOutputs : outputs);
  return { prepared, preparedSources, output, outputs, catalogueOutputs, factsheets };

}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--catalog-only')) throw new TypeError('Usage: node tools/prepare-facilities.mts [--catalog-only]');
  // The real CLI entry point: opts into the mirror explicitly (library code above defaults it off).
  const { prepared, factsheets } = await prepareFacilities({ mirrorOrigin: RUNTIME_ASSET_ORIGIN,
    publish: args.includes('--catalog-only') ? 'catalogues' : true });
  console.log(`Prepared ${prepared.catalog.missions.length} missions, ${prepared.catalog.facilities.length} facilities and ${prepared.graph.datasets.length} dataset destinations.`);
  console.log(`Factsheets: ${factsheets.facts} facts, each with its own citation.`);
}
