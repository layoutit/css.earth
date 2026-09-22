import { sha256 } from '../../../src/platform/sha256.mts';
import {readJsonSource, hasErrorCode, requireRecord, requireString} from '../../sources/source-values.mts';
import {parseMurReceipt} from './source-contract.mts';
import {readMapConfiguration, readRefreshContent, readRefreshBindings, readRefreshManifest, requireUpdateBytes} from './refresh-source.mts';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { acquireMurImagery, murEnsoContent, murEnsoText, murCapabilitiesUrl, murColormapUrl, murDescriptionUrl, murLayer } from './mur-imagery.mts';
import { parseEnsoAdvisory } from './enso-advisory.mts';

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
// A completed anonymous acquisition is installed only after every source tile
// and the reproducible mosaic have been verified. No partial face publication.
export async function installMurEnso(root: string, acquiredDirectory: string) {
  const object = resolve(root, 'src/objects/earth'), source = join(object, 'source');
  const config = await readMapConfiguration(join(source, 'preparation/paged-ellipsoid.json'));
  const map = config.surface.maps.find(map => map.name === 'earth-enso');
  const receipt = parseMurReceipt(await readJsonSource(join(acquiredDirectory, 'mur-gibs-receipt.json')));
  if (!map || typeof map.scientific?.date !== 'string') throw new Error('Earth ENSO source recipe is missing.');
  if (!receipt.complete || receipt.tiles.length !== 3200 || receipt.date < map.scientific.date)
    throw new Error('MUR publication is incomplete or older than the accepted source.');
  const files = ['mur-gibs-tiles.tar.gz', 'mur-gibs-receipt.json', 'mur-gibs-layer.xml', 'mur-gibs-colormap.xml', 'mur-gibs-description.md', 'mur-gibs.png'];
  const updates = new Map<string, Buffer>();
  for (const name of files) updates.set(`science/${name}`, await readFile(join(acquiredDirectory, name)));
  if (sha256(requireUpdateBytes(updates, 'science/mur-gibs-tiles.tar.gz')) !== receipt.archiveSha256 ||
      sha256(requireUpdateBytes(updates, 'science/mur-gibs.png')) !== receipt.mosaic.sha256) throw new Error('MUR acquisition hashes differ.');
  const savedAdvisory = requireRecord(map.scientific.advisory);
  let advisory = { date: requireString(savedAdvisory.date), status: requireString(savedAdvisory.status), url: requireString(savedAdvisory.url) };
  try { advisory = parseEnsoAdvisory(await readFile(join(acquiredDirectory, 'enso-advisory.html'), 'utf8')); }
  catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; }
  // Keep the extracted status, issue date and source URL in the existing recipe.
  // An offline imagery install preserves the separately dated advisory.
  map.path = 'science/mur-gibs.png';
  const recipe = { kind: 'gibs-mur-imagery', date: receipt.date, baseline: receipt.baseline, checked: receipt.checked, advisory };
  map.scientific = recipe;
  const content = await readRefreshContent(join(source, 'content/object.json'));
  const lens = murEnsoContent(recipe);
  const lensIndex = content.lenses.controls.findIndex(lens => lens.id === 'enso');
  if (lensIndex < 0) throw new Error('ENSO content is missing.');
  content.lenses.controls[lensIndex] = lens;
  const bindings = await readRefreshBindings(join(source, 'content/lens-bindings.json'));
  const binding = bindings.controls.find(lens => lens.id === 'enso');
  if (!binding) throw new Error('ENSO presentation binding is missing.');
  binding.qualification = lens.notes;
  updates.set('preparation/paged-ellipsoid.json', Buffer.from(json(config)));
  updates.set('content/object.json', Buffer.from(json(content)));
  updates.set('content/lens-bindings.json', Buffer.from(json(bindings)));
  const manifest = await readRefreshManifest(join(source, 'manifest.json'));
  const origins = {
    'mur-gibs-tiles.tar.gz': `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${murLayer}/default/${receipt.date}/1km/6/{row}/{col}.png`,
    'mur-gibs-receipt.json': murCapabilitiesUrl, 'mur-gibs-layer.xml': murCapabilitiesUrl,
    'mur-gibs-colormap.xml': murColormapUrl, 'mur-gibs-description.md': murDescriptionUrl,
  };
  for (const [name, origin] of Object.entries(origins)) {
    const path = `science/${name}`, id = name === 'mur-gibs-tiles.tar.gz' ? 'nasa-mur-gibs-tiles' : `nasa-${name.replace(/\.[^.]+$/, '')}`;
    const record = { id, path, origin, expectedSha256: sha256(requireUpdateBytes(updates, path)), expectedBytes: requireUpdateBytes(updates, path).length,
      credit: 'NASA JPL MUR project, NASA MEaSUREs, and NASA EOSDIS GIBS', license: 'NASA open Earth science imagery with attribution',
      licenseEvidence: ['https://www.earthdata.nasa.gov/engage/open-data-services-and-software/api/gibs'],
      acquisition: `Anonymous imagery acquisition ${receipt.checked}; all populated tiles attest ${receipt.date}. See per-tile dates and hashes in mur-gibs-receipt.json.`,
      redistribution: 'Original NASA PNG tiles retained in a local archive with attribution', consumers: ['enso'] };
    const at = manifest.inputs.findIndex(e => e.id === id); if (at < 0) manifest.inputs.push(record); else manifest.inputs[at] = record;
  }
  const mosaic = { id: 'nasa-mur-gibs-mosaic', path: 'science/mur-gibs.png', origin: 'tools/objects/paged-ellipsoid/mur-imagery.mts',
    generator: 'tools/objects/paged-ellipsoid/mur-imagery.mts restore src/objects/earth/source/science',
    expectedSha256: receipt.mosaic.sha256, expectedBytes: requireUpdateBytes(updates, 'science/mur-gibs.png').length,
    description: 'Prepared 16K pixel-center nearest mosaic from all 3,200 native NASA tiles; transparent pixels use the neutral gap color.',
    consumers: ['enso'] };
  const mi = manifest.generatedIntermediates.findIndex(e => e.id === mosaic.id);
  if (mi < 0) manifest.generatedIntermediates.push(mosaic); else manifest.generatedIntermediates[mi] = mosaic;
  for (const collection of ['inputs', 'documents', 'generatedIntermediates'] as const) for (const entry of manifest[collection]) {
    const bytes = updates.get(entry.path); if (bytes) Object.assign(entry, { expectedSha256: sha256(bytes), expectedBytes: bytes.length });
  }
  for (const [path, bytes] of updates) await writeFile(join(source, path), bytes);
  await writeFile(join(source, 'manifest.json'), json(manifest));
  // The dated reader text lives beside object.json; pnpm prepare:text publishes it.
  const text = JSON.parse(await readFile(join(object, 'text.json'), 'utf8'));
  text.datasets.enso = murEnsoText(recipe);
  await writeFile(join(object, 'text.json'), json(text));
  return { date: receipt.date, sourceBytes: receipt.sourceBytes, tileCount: receipt.tiles.length, mosaic: receipt.mosaic };
}

export async function refreshMurEnso(root: string) {
  const temp = await mkdtemp(join(tmpdir(), 'earth-mur-acquire-'));
  try {
    await acquireMurImagery(temp);
    const response = await fetch('https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml', { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`NOAA advisory HTTP ${response.status}`);
    const advisory = Buffer.from(await response.arrayBuffer());
    parseEnsoAdvisory(advisory.toString());
    await writeFile(join(temp, 'enso-advisory.html'), advisory);
    return await installMurEnso(root, temp);
  } finally { await rm(temp, { recursive: true, force: true }); }
}
