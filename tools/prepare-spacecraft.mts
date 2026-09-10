import { sourceResolver, parseSourceBinding } from '../src/platform/source-catalog.mts';
import { compileSourceUsage } from '../src/platform/source-usage.mts';
import type { SourceUse } from '../src/platform/source-usage.mts';
import { parsePreparedSources, sourceCatalogDigest } from '../src/platform/prepared-sources.mts';
import { readSourceCatalog } from './read-source-catalogue.mts';
import { sourceInventory, metadataCitations, factsheetCitations } from './source-catalogue-inputs.mts';
import { parseFactsheet, verifyFactsheetSources } from './factsheet-sources.mts';
import { sourcePath, sourceDigest } from '../src/platform/source-catalog.mts';
import type { SourceInventoryEntry } from './source-catalogue-inputs.mts';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { OBJECTS } from '../site/objects.mts';
import { explorationRecord, explorationArray, explorationText, parseAgencies, parseCapture, validateCapture, parseExplorationCatalog } from '../src/platform/exploration-catalog.mts';
import { compileContributions } from '../src/platform/exploration-contributions.mts';
import type { ContributionObject } from '../src/platform/exploration-contributions.mts';
import { parsePreparedExploration, parseExplorationImage } from '../src/platform/prepared-exploration.mts';
import type { ExplorationImage } from '../src/platform/prepared-exploration.mts';
import { validateObjectProvenance } from '../src/platform/object-provenance.mts';
import type { ProvenanceDocument } from '../src/platform/object-provenance.mts';
import { writePreparedSet } from './write-prepared-set.mts';
export const explorationCompilerClosure = [
  'tools/prepare-spacecraft.mts', 'src/platform/exploration-catalog.mts', 'src/platform/exploration-contributions.mts',
  'src/platform/prepared-exploration.mts', 'src/platform/object-provenance.mts', 'site/objects.mts', 'site/object-schema.mts',
  'site/object-catalog.mts', 'site/prepared-object-catalog.mts', 'tools/prepare-catalog.mts',
  'site/source/spacecraft/catalog.json', 'site/source/spacecraft/render-library.json', 'site/source/spacecraft/emblem-library.json',
  'site/source/agency-logos.json', 'tools/read-source-catalogue.mts',
  'src/platform/source-catalog.mts', 'src/platform/source-usage.mts', 'src/platform/source-manifest.mts',
  'src/platform/prepared-sources.mts', 'tools/source-catalogue-inputs.mts',
  'tools/factsheet-sources.mts', 'site/fact-order.mts',
  'src/objects/milky-way/source/sky/provenance.json', 'src/objects/milky-way/source/provenance.json',
  'src/objects/stellar-neighbourhood/source/provenance.json', 'src/objects/heliosphere/source/provenance.json',
  'tools/objects/provenance.mts', 'tools/objects/provenance-records.mts', 'tools/objects/provenance-recipes.mts', 'tools/prepare-provenance.mts',
] as const;
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
interface Options { root?: string; publish?: boolean; provenance?: ReadonlyMap<string, ProvenanceDocument>; }
/** Compile evidenced catalogue links and reuse approved artwork; never acquire or render assets. */
export async function prepareSpacecraft({ root = resolve(import.meta.dirname, '..'), publish = true, provenance = new Map() }: Options = {}) {
  const closure: Record<string, string> = {};
  const input = async (path: string) => {
    const bytes = await readFile(resolve(root, path)); closure[path] = digest(bytes); return bytes;
  };
  const json = async (path: string): Promise<unknown> => JSON.parse((await input(path)).toString('utf8'));
  for (const path of explorationCompilerClosure) await input(path);
  const agencies = parseAgencies(await json('site/source/agency-logos.json'));
  const sourceCatalog = await readSourceCatalog(root, input), sources = sourceResolver(sourceCatalog);
  const catalog = parseExplorationCatalog(await json('site/source/spacecraft/catalog.json'), agencies, sources);
  const metadata: SourceUse[] = metadataCitations(catalog, 'site/source/spacecraft/catalog.json', sources);
  const inventory: SourceInventoryEntry[] = [];
  for (const path of explorationCompilerClosure.filter(path => path.startsWith('src/objects/'))) {
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
    if (library.schema !== (emblem ? 'cssearth-spacecraft-emblems@2' : 'cssearth-spacecraft-render-library@2')) throw new TypeError('Unsupported artwork library.');
    const entries = explorationArray(library.entries, explorationRecord).map((image, index) => {
      const source = explorationRecord(image.source);
      const binding = parseSourceBinding(image.sourceBinding, sources), id = explorationText(image.id);
      inventory.push({ownerPath:file,localId:id,binding,used:true});
      if (binding.kind !== 'catalogued') throw new TypeError('Artwork needs a canonical source.');
      for (const ref of binding.references) metadata.push({catalogueId:sources[ref.catalogueId].id,kind:'artwork',consumerKind:'artwork',consumerId:`${emblem ? 'emblem' : 'render'}/${id}`,
        consumerLabel:`${id} ${emblem ? 'emblem' : 'artwork'}`,ownerPath:file,locator:`/entries/${index}/sourceBinding`,evidence:ref.evidence,lensIds:[],limitations:[],credit:explorationText(source.credit)});
      return parseExplorationImage({ id: image.id, src: emblem ? image.src : image.url,
        width: image.width, height: image.height, bytes: image.bytes, sha256: image.sha256,
        kind: emblem ? 'emblem' : source.kind, sourceUrl: emblem ? source.sourceUrl : source.sourcePage, credit: source.credit });
    });
    for (const image of entries) {
      const bytes = await input(`public${image.src}`);
      if (bytes.length !== image.bytes || digest(bytes) !== image.sha256) throw new Error(`Approved artwork identity changed: ${image.id}.`);
      const metadata = await sharp(bytes).metadata();
      if (metadata.format !== (emblem ? 'png' : 'webp') || metadata.width !== image.width || metadata.height !== image.height || (emblem && !metadata.hasAlpha)) throw new Error(`Approved artwork format/dimensions changed: ${image.id}.`);
    }
    return entries;
  }
  const images: readonly ExplorationImage[] = await artwork('site/source/spacecraft/render-library.json', false);
  const emblems: readonly ExplorationImage[] = await artwork('site/source/spacecraft/emblem-library.json', true);
  for (const agency of Object.values(agencies)) if (agency.src) {
    const bytes = await input(`public${agency.src}`);
    if (digest(bytes) !== agency.sha256 || bytes.length !== agency.bytes) throw new Error(`Agency logo identity changed: ${agency.name}.`);
  }
  const objects: ContributionObject[] = [];
  const factsheets = { facts: 0, cited: 0, uncited: [] as { objectId: string; factId: string }[] };
  for (const object of OBJECTS) {
    const base = `src/planets/${object.id}`;
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
    if (contentPin.length !== 1 || contentPin[0]!.expectedBytes !== contentBytes.length || contentPin[0]!.expectedSha256 !== digest(contentBytes) ||
      sourceDigest(contentReference.sha256) !== digest(contentBytes)) throw new Error(`Changed content source for ${object.id}.`);
    const content = explorationRecord(JSON.parse(contentBytes.toString('utf8')));
    const panel = await verifyFactsheetSources(content.panel, { objectDirectory: resolve(root, base), manifest, sources, read: path => input(`${base}/${path}`) });
    const published = explorationRecord(await json(`${base}/prepared/content.json`));
    if (published.objectId !== object.id || JSON.stringify(parseFactsheet(published)) !== JSON.stringify(panel)) throw new Error(`Stale factsheet for ${object.id}; run pnpm prepare:factsheets -- ${object.id}.`);
    metadata.push(...factsheetCitations(panel, `${base}/${contentPath}`, object));
    for (const fact of [...panel.facts, ...panel.moreFacts]) {
      factsheets.facts++;
      if (fact.source) factsheets.cited++; else factsheets.uncited.push({ objectId: object.id, factId: fact.id });
    }
    for (const source of explorationArray(manifest.inputs, explorationRecord)) if (source.capture !== undefined) validateCapture(parseCapture(source.capture), catalog);
    const page = explorationRecord(await json(`${base}/prepared/page.json`));
    if (page.schema !== 'cssearth-object-page@1' || page.id !== object.id || page.sceneSha256 !== explorationRecord(descriptor.prepared).sha256) throw new Error(`Stale prepared controls for ${object.id}.`);
    const controls = explorationRecord(page.controls);
    const lenses = controls.lenses === null ? [] : explorationArray(explorationRecord(controls.lenses).controls, raw => {
      const control = explorationRecord(raw); return { id: explorationText(control.id), label: explorationText(control.label) };
    });
    const path = `${base}/prepared/provenance.json`;
    let document = provenance.get(object.id);
    if (document) closure[path] = digest(JSON.stringify(document, null, 2) + '\n');
    else document = validateObjectProvenance(await json(path), object.id);
    if (document.manifest.sha256 !== closure[`${base}/source/manifest.json`]) throw new Error(`Stale provenance for ${object.id}; run pnpm prepare:provenance.`);
    inventory.push(...sourceInventory(manifest, `${base}/source/manifest.json`, sources, new Set(document.sources.map(source => source.path))));
    objects.push({ id: object.id, name: object.name, route: object.route, controls: lenses, provenance: document });
  }
  const sourcePayload = {schema:'cssearth-prepared-sources@1',catalog:sourceCatalog,catalogSha256:sourceCatalogDigest(sourceCatalog),
    usage:compileSourceUsage(objects,sources,metadata),inventory,closure};
  const preparedSources = parsePreparedSources(sourcePayload);
  const payload = { schema: 'cssearth-prepared-exploration@2', catalog, agencies, images, emblems,
    sourceCatalogSha256:preparedSources.catalogSha256,graph: compileContributions(objects, catalog), closure };
  const prepared = parsePreparedExploration(payload,sources);
  const output = { path: resolve(root, 'site/prepared-spacecraft.json'), text: JSON.stringify(payload, null, 2) + '\n' };
  const sourcesOutput = {path:resolve(root,'site/prepared-sources.json'),text:JSON.stringify(sourcePayload,null,2)+'\n'};
  const outputs = [sourcesOutput,output];
  if (publish) await writePreparedSet(outputs);
  return { prepared, preparedSources, output, outputs, factsheets };

}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { prepared, factsheets } = await prepareSpacecraft();
  console.log(`Prepared ${prepared.catalog.missions.length} missions, ${prepared.catalog.spacecraft.length} spacecraft and ${prepared.graph.datasets.length} dataset destinations.`);
  console.log(`Factsheets: ${factsheets.cited}/${factsheets.facts} facts have individual citations; ${factsheets.uncited.length} do not.`);
}
