import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
// Entry script: node packages/bake/authoring/earth/refresh-earth-enso.mts. Moves Earth's ENSO sequence to the newest NASA MUR
// anomaly analysis GIBS has published and the same weekday one and two weeks before it: it acquires each date it does not
// hold yet, drops the
// dates that left it, re-reads the NOAA advisory and rewrites every declaration the datasets are made from. Preparation then
// bakes the declared dates offline (pnpm prepare:objects --object=earth), and the new tile archives go to the source mirror
// (packages/bake/cli/publish-source-cache.mts --object=earth).
import { readJsonSource } from '@cssearth/bake/objects/sources';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { parseEnsoAdvisory, parseMurReceipt } from '@cssearth/bake/objects/layers/paged-ellipsoid';
import { readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { acquireMurDate, acquireMurShared, restoreMurDate, murCapabilitiesUrl, murDatasetId, murDateDirectory, murEnsoContent, murEnsoText,
  murTileUrl, murWindow, parseMurCapabilities } from './mur-imagery.mts';

/** The newest analysis and the same weekday one and two weeks before it. */
export const ENSO_WINDOW = { count: 3, spacingDays: 7 };
const advisoryUrl = 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml';
const credit = 'NASA JPL MUR project, NASA MEaSUREs, and NASA EOSDIS GIBS';
const license = 'NASA open Earth science imagery with attribution';
const licenseEvidence = ['https://www.earthdata.nasa.gov/engage/open-data-services-and-software/api/gibs'];
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const isEnso = (id: unknown) => typeof id === 'string' && /^enso(-\d{4}-\d{2}-\d{2})?$/.test(id);
const exists = (path: string) => stat(path).then(() => true, () => false);

async function readRecord(path: string) { return requireRecord(await readJsonSource(path), path); }
/** Replace the ENSO members of a list in place, at the position the first one held. */
function spliceEnso<T>(list: T[], isMember: (entry: T) => boolean, members: readonly T[], where: string) {
  const at = list.findIndex(isMember);
  if (at < 0) throw new Error(`${where}: no ENSO entry to replace.`);
  const kept = list.filter(entry => !isMember(entry));
  kept.splice(at, 0, ...members);
  list.splice(0, list.length, ...kept);
}

export async function refreshEarthEnso(root = checkoutProjectRoot(import.meta.url), { window: shape = ENSO_WINDOW, now = new Date() } = {}) {
  const object = resolve(root, 'src/objects/earth'), source = join(object, 'source'), science = join(source, 'science');
  const response = await fetch(murCapabilitiesUrl, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`GIBS capabilities HTTP ${response.status}`);
  const capabilities = Buffer.from(await response.arrayBuffer());
  const window = murWindow(parseMurCapabilities(capabilities.toString(), now.toISOString().slice(0, 10)).dates, shape);
  const advisoryResponse = await fetch(advisoryUrl, { signal: AbortSignal.timeout(30000) });
  if (!advisoryResponse.ok) throw new Error(`NOAA advisory HTTP ${advisoryResponse.status}`);
  const advisory = parseEnsoAdvisory(await advisoryResponse.text());
  await acquireMurShared(science, capabilities);
  // A held date keeps its receipt: its analysis does not change once published. A date the source mirror holds (an earlier
  // build published it) comes from there; only a date nobody has fetched is downloaded from GIBS. Three run at once.
  const missing: string[] = [], acquired: string[] = [], mirrored: string[] = [];
  for (const date of window) if (!await exists(join(source, murDateDirectory(date), 'receipt.json'))) missing.push(date);
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let date = missing.shift(); date; date = missing.shift()) {
      const directory = join(source, murDateDirectory(date));
      if (await restoreMurDate(directory, date, { receipt: true })) mirrored.push(date);
      else { await rm(directory, { recursive: true, force: true }); await acquireMurDate(directory, date); acquired.push(date); }
    }
  }));
  const receipts = await Promise.all(window.map(async date => parseMurReceipt(await readJsonSource(join(source, murDateDirectory(date), 'receipt.json')))));
  const dropped = (await readdir(join(science, 'mur')).catch(() => [])).filter(name => !window.includes(name));
  for (const name of dropped) await rm(join(science, 'mur', name), { recursive: true, force: true });
  const recipes = receipts.map(receipt => ({ date: receipt.date, baseline: receipt.baseline, checked: receipt.checked, advisory }));

  // The surface maps the paged globe bakes, one per date, in the place the ENSO map held.
  const pagedPath = join(source, 'preparation/paged-ellipsoid.json'), paged = await readRecord(pagedPath);
  const maps = requireArray(requireRecord(paged.surface, 'paged surface').maps, 'paged maps').map(map => requireRecord(map, 'paged map'));
  const template = maps.find(map => typeof map.name === 'string' && map.name.startsWith('earth-enso'));
  if (!template) throw new Error('Earth ENSO surface map is missing.');
  spliceEnso(maps, map => typeof map.name === 'string' && map.name.startsWith('earth-enso'), recipes.map(recipe => ({
    path: `${murDateDirectory(recipe.date)}/mosaic.png`, name: `earth-enso-${recipe.date}`, thumbnail: `earth-dataset-enso-${recipe.date}.webp`,
    scientific: { kind: 'gibs-mur-imagery', ...recipe, advisory: { ...recipe.advisory, url: advisoryUrl } },
    ...(template.webp === undefined ? {} : { webp: template.webp }) })), 'paged-ellipsoid.json');
  requireRecord(paged.surface).maps = maps;

  // The dataset bindings: each date pages its own surface, framed like the others.
  const bindingsPath = join(source, 'content/dataset-bindings.json'), bindings = await readRecord(bindingsPath);
  const bindingControls = requireArray(bindings.controls, 'dataset bindings').map(control => requireRecord(control, 'dataset binding'));
  const bindingTemplate = bindingControls.find(control => isEnso(control.id));
  if (!bindingTemplate) throw new Error('ENSO presentation binding is missing.');
  const contents = recipes.map(murEnsoContent);
  spliceEnso(bindingControls, control => isEnso(control.id), contents.map((content, index) => {
    const date = recipes[index]!.date;
    return { ...bindingTemplate, id: content.id, thumbnailUrl: content.thumbnail, surfaceUrl: `/scenes/earth/earth-enso-${date}.webp`,
      polesUrl: `/scenes/earth/earth-enso-${date}-poles.webp`, surfacePagePrefix: `earth-enso-${date}`, qualification: content.notes };
  }), 'dataset-bindings.json');
  bindings.controls = bindingControls;

  const contentPath = join(source, 'content/object.json'), content = await readRecord(contentPath);
  const datasets = requireRecord(content.datasets, 'content datasets');
  const controls = requireArray(datasets.controls, 'content dataset controls').map(control => requireRecord(control, 'content dataset'));
  spliceEnso(controls, control => isEnso(control.id), contents, 'content/object.json');
  datasets.controls = controls;
  const resources = requireArray(content.resources, 'content resources');
  if (!resources.some(resource => requireRecord(resource).href === advisoryUrl)) resources.push({ label: 'NOAA', role: 'climate', description: 'ENSO advisory', href: advisoryUrl });

  const descriptorPath = join(object, 'object.json'), descriptor = await readRecord(descriptorPath);
  const surfaces = requireArray(requireRecord(requireRecord(descriptor.properties).recipe).surfaces, 'descriptor surfaces');
  for (const surface of surfaces.map(entry => requireRecord(entry))) {
    const listed = requireArray(surface.datasets, 'descriptor datasets').map(entry => requireRecord(entry));
    const first = listed.find(entry => isEnso(entry.id));
    if (!first) continue;
    spliceEnso(listed, entry => isEnso(entry.id), contents.map(content => ({ ...first, id: content.id })), 'object.json');
    surface.datasets = listed;
  }

  const featuresPath = join(source, 'preparation/features.json'), features = await readRecord(featuresPath);
  const featureIds = requireArray(features.datasetIds, 'feature dataset ids').map(id => requireString(id));
  spliceEnso(featureIds, isEnso, contents.map(content => content.id), 'features.json');
  features.datasetIds = featureIds;

  const textPath = join(object, 'text.json'), text = await readRecord(textPath);
  const textDatasets = requireRecord(text.datasets, 'text datasets');
  text.datasets = Object.fromEntries([...Object.entries(textDatasets).filter(([id]) => !isEnso(id)),
    ...recipes.map(recipe => [murDatasetId(recipe.date), murEnsoText(recipe)] as const)]);

  // Each date's receipt is the record of its download. Its tile archive is assembled here from 3,200 GIBS downloads, so
  // it is a generated intermediate the source mirror holds, and its mosaic is rebuilt from that archive.
  const manifestPath = join(source, 'manifest.json'), manifest = await readRecord(manifestPath);
  const dated = (id: unknown) => typeof id === 'string' && /^nasa-mur-gibs-(tiles|receipt|mosaic)(-\d{4}-\d{2}-\d{2})?$/.test(id);
  const inputs = requireArray(manifest.inputs, 'manifest inputs').map(entry => requireRecord(entry));
  const acquisition = (checked: string, date: string) => `Anonymous imagery acquisition ${checked}; every tile with observations attested ${date} and the v4.1 analysis.`;
  const catalogued = (date: string) => ({ kind: 'catalogued', references: [{ catalogueId: 'gibs-mur-sst-anomalies', role: 'material',
    evidence: `GIBS imagery for ${date}; ${murDateDirectory(date)}/receipt.json records the layer, grid and each tile's bytes.` }] });
  const generator = 'packages/bake/authoring/earth/refresh-earth-enso.mts';
  const receiptsDeclared = receipts.map(receipt => ({ id: `nasa-mur-gibs-receipt-${receipt.date}`, path: `${murDateDirectory(receipt.date)}/receipt.json`,
    origin: murCapabilitiesUrl, credit, license, licenseEvidence, acquisition: acquisition(receipt.checked, receipt.date), redistribution: 'Project acquisition record',
    consumers: [murDatasetId(receipt.date)], sourceBinding: { kind: 'local', reason: 'Project acquisition record: the GIBS layer, requested date, grid and each tile\'s bytes.' } }));
  const shared = inputs.filter(entry => typeof entry.id === 'string' && /^nasa-mur-gibs-(layer|colormap|description)$/.test(entry.id));
  for (const entry of shared) Object.assign(entry, { acquisition: `Checked ${now.toISOString()} with the dated tiles it describes.`,
    consumers: contents.map(content => content.id) });
  spliceEnso(inputs, entry => dated(entry.id), receiptsDeclared, 'manifest inputs');
  manifest.inputs = inputs;
  const intermediates = requireArray(manifest.generatedIntermediates, 'manifest intermediates').map(entry => requireRecord(entry));
  spliceEnso(intermediates, entry => dated(entry.id), receipts.flatMap(receipt => [
    { id: `nasa-mur-gibs-tiles-${receipt.date}`, path: `${murDateDirectory(receipt.date)}/tiles.tar.gz`,
      origin: murTileUrl(receipt.date, 0, 0).replace('/6/0/0.png', '/6/{row}/{col}.png'), generator,
      description: `The 3,200 original NASA PNG tiles of ${receipt.date}, archived as downloaded; the source mirror holds it.`,
      consumers: [murDatasetId(receipt.date)], credit, sourceBinding: catalogued(receipt.date) },
    { id: `nasa-mur-gibs-mosaic-${receipt.date}`, path: `${murDateDirectory(receipt.date)}/mosaic.png`, origin: 'packages/bake/authoring/earth/mur-imagery.mts',
      generator: 'packages/bake/authoring/earth/mur-imagery.mts restore src/objects/earth/source/science',
      description: 'Prepared 16K pixel-center nearest mosaic from all 3,200 native NASA tiles; transparent pixels use the neutral gap color.',
      consumers: [murDatasetId(receipt.date)], credit: `${credit}; mosaic preparation by cssEarth contributors`, sourceBinding: catalogued(receipt.date) }]),
  'manifest intermediates');
  manifest.generatedIntermediates = intermediates;

  for (const [path, value] of [[pagedPath, paged], [bindingsPath, bindings], [contentPath, content], [descriptorPath, descriptor],
    [featuresPath, features], [textPath, text], [manifestPath, manifest]] as const) await writeFile(path, json(value));
  return { window: [window[0], window.at(-1)], acquired: acquired.sort(), mirrored: mirrored.sort(), dropped, advisory };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(json(await refreshEarthEnso(checkoutProjectRoot(import.meta.url))));
