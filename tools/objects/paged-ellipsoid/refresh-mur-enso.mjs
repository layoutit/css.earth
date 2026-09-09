import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { acquireMurImagery, murEnsoContent, murCapabilitiesUrl, murColormapUrl, murDescriptionUrl, murLayer, sha256 } from './mur-imagery.mjs';
import { parseEnsoAdvisory } from './enso-advisory.mjs';

const json = value => JSON.stringify(value, null, 2) + '\n';
// A completed anonymous acquisition is installed only after every source tile
// and the reproducible mosaic have been verified. No partial face publication.
export async function installMurEnso(root, acquiredDirectory) {
  const object = resolve(root, 'src/planets/earth'), source = join(object, 'source');
  const read = async path => JSON.parse(await readFile(path, 'utf8'));
  const config = await read(join(source, 'preparation/paged-ellipsoid.json'));
  const map = config.surface.maps.find(map => map.name === 'earth-enso');
  const receipt = await read(join(acquiredDirectory, 'mur-gibs-receipt.json'));
  if (!receipt.complete || receipt.tiles.length !== 3200 || receipt.date < map.scientific.date)
    throw new Error('MUR publication is incomplete or older than the accepted source.');
  const files = ['mur-gibs-tiles.tar.gz', 'mur-gibs-receipt.json', 'mur-gibs-layer.xml', 'mur-gibs-colormap.xml', 'mur-gibs-description.md', 'mur-gibs.png'];
  const updates = new Map();
  for (const name of files) updates.set(`science/${name}`, await readFile(join(acquiredDirectory, name)));
  if (sha256(updates.get('science/mur-gibs-tiles.tar.gz')) !== receipt.archiveSha256 ||
      sha256(updates.get('science/mur-gibs.png')) !== receipt.mosaic.sha256) throw new Error('MUR acquisition hashes differ.');
  let advisoryBytes;
  try { advisoryBytes = await readFile(join(acquiredDirectory, 'enso-advisory.html')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; advisoryBytes = await readFile(join(source, 'science/enso-advisory.html')); }
  updates.set('science/enso-advisory.html', advisoryBytes);
  const advisory = parseEnsoAdvisory(advisoryBytes.toString());
  map.path = 'science/mur-gibs.png';
  map.scientific = { kind: 'gibs-mur-imagery', date: receipt.date, baseline: receipt.baseline, checked: receipt.checked, advisory };
  const content = await read(join(source, 'content/object.json'));
  const lens = murEnsoContent(map.scientific);
  content.lenses.controls[content.lenses.controls.findIndex(lens => lens.id === 'enso')] = lens;
  const bindings = await read(join(source, 'content/lens-bindings.json'));
  bindings.controls.find(lens => lens.id === 'enso').qualification = lens.description;
  updates.set('preparation/paged-ellipsoid.json', Buffer.from(json(config)));
  updates.set('content/object.json', Buffer.from(json(content)));
  updates.set('content/lens-bindings.json', Buffer.from(json(bindings)));
  const manifest = await read(join(source, 'manifest.json'));
  const origins = {
    'mur-gibs-tiles.tar.gz': `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${murLayer}/default/${receipt.date}/1km/6/{row}/{col}.png`,
    'mur-gibs-receipt.json': murCapabilitiesUrl, 'mur-gibs-layer.xml': murCapabilitiesUrl,
    'mur-gibs-colormap.xml': murColormapUrl, 'mur-gibs-description.md': murDescriptionUrl,
  };
  for (const [name, origin] of Object.entries(origins)) {
    const path = `science/${name}`, id = name === 'mur-gibs-tiles.tar.gz' ? 'nasa-mur-gibs-tiles' : `nasa-${name.replace(/\.[^.]+$/, '')}`;
    const record = { id, path, origin, expectedSha256: sha256(updates.get(path)), expectedBytes: updates.get(path).length,
      credit: 'NASA JPL MUR project, NASA MEaSUREs, and NASA EOSDIS GIBS', license: 'NASA open Earth science imagery with attribution',
      licenseEvidence: ['https://www.earthdata.nasa.gov/engage/open-data-services-and-software/api/gibs'],
      acquisition: `Anonymous imagery acquisition ${receipt.checked}; all populated tiles attest ${receipt.date}. See per-tile dates and hashes in mur-gibs-receipt.json.`,
      redistribution: 'Original NASA PNG tiles retained in a local archive with attribution', consumers: ['enso'] };
    const at = manifest.inputs.findIndex(e => e.id === id); if (at < 0) manifest.inputs.push(record); else manifest.inputs[at] = record;
  }
  const mosaic = { id: 'nasa-mur-gibs-mosaic', path: 'science/mur-gibs.png', origin: 'tools/objects/paged-ellipsoid/mur-imagery.mjs',
    generator: 'tools/objects/paged-ellipsoid/mur-imagery.mjs restore src/planets/earth/source/science',
    expectedSha256: receipt.mosaic.sha256, expectedBytes: updates.get('science/mur-gibs.png').length,
    description: 'Prepared 16K pixel-center nearest mosaic from all 3,200 native NASA tiles; transparent pixels use the neutral gap color.',
    consumers: ['enso'] };
  const mi = manifest.generatedIntermediates.findIndex(e => e.id === mosaic.id);
  if (mi < 0) manifest.generatedIntermediates.push(mosaic); else manifest.generatedIntermediates[mi] = mosaic;
  for (const collection of ['inputs', 'documents', 'generatedIntermediates']) for (const entry of manifest[collection]) {
    const bytes = updates.get(entry.path); if (bytes) Object.assign(entry, { expectedSha256: sha256(bytes), expectedBytes: bytes.length });
  }
  const descriptor = await read(join(object, 'object.json'));
  for (const reference of descriptor.properties.recipe.sources) {
    const bytes = updates.get(reference.path.replace(/^source\//, '')); if (bytes) reference.sha256 = sha256(bytes);
  }
  for (const [path, bytes] of updates) await writeFile(join(source, path), bytes);
  await writeFile(join(source, 'manifest.json'), json(manifest));
  await writeFile(join(object, 'object.json'), json(descriptor));
  return { date: receipt.date, sourceBytes: receipt.sourceBytes, tileCount: receipt.tiles.length, mosaic: receipt.mosaic };
}

export async function refreshMurEnso(root) {
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
