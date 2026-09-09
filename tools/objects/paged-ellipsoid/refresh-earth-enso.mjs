import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnsoAdvisory } from './enso-advisory.mjs';
import { readCoraltempAnomaly, ensoContent, coraltempProductUrl } from './sst-anomaly.mjs';

const base = 'https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1-clim19912020-v1/nc/v1.0/daily/ssta/';
const advisoryUrl = 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export function newestCoraltemp(listings, throughDate) {
  // Match actual netCDF links: a checksum-only placeholder can precede the
  // next day's data and must never be mistaken for a published analysis.
  const candidates = [...listings.join('\n').matchAll(/href=["'](ct5km_ssta_v3\.1-clim19912020-v1_(\d{8})\.nc)["']/g)]
    .filter(match => match[2] <= throughDate.replaceAll('-', ''))
    .map(match => ({ filename: match[1], date: match[2] }));
  candidates.sort((a, b) => b.date.localeCompare(a.date));
  if (!candidates.length) throw new Error('No published NOAA CoralTemp anomaly files in the current or previous year.');
  return candidates[0];
}

export { parseEnsoAdvisory } from './enso-advisory.mjs';

// Explicit acquisition step; ordinary preparation remains offline and pinned.
export async function refreshEarthEnso(root = process.cwd(), now = new Date()) {
  const object = resolve(root, 'src/planets/earth'), source = resolve(object, 'source');
  const getJson = async path => JSON.parse(await readFile(path, 'utf8'));
  const config = await getJson(resolve(source, 'preparation/paged-ellipsoid.json'));
  if (config.surface.maps.some(map => map.scientific?.kind === 'gibs-mur-imagery')) {
    const { refreshMurEnso } = await import('./refresh-mur-enso.mjs');
    return refreshMurEnso(root);
  }
  const map = config.surface.maps.find(map => map.scientific?.kind === 'coraltemp-anomaly');
  if (!map || map.path !== 'science/coraltemp-latest.nc') throw new Error('Earth CoralTemp recipe is missing.');
  const fetchBytes = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`NOAA acquisition HTTP ${response.status}: ${url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) throw new Error('Unexpected NOAA input size.');
    return bytes;
  };
  const today = now.toISOString().slice(0, 10);
  const years = [now.getUTCFullYear(), now.getUTCFullYear() - 1];
  const listings = await Promise.all(years.map(year => fetchBytes(`${base}${year}/`).then(bytes => bytes.toString())));
  const latest = newestCoraltemp(listings, today);
  const date = `${latest.date.slice(0, 4)}-${latest.date.slice(4, 6)}-${latest.date.slice(6)}`;
  if (date < map.scientific.date) throw new Error('Latest NOAA file is older than the pinned source.');
  const url = `${base}${latest.date.slice(0, 4)}/${latest.filename}`;
  const [bytes, checksum, advisoryBytes, productBytes] = await Promise.all([
    fetchBytes(url), fetchBytes(`${url}.md5`), fetchBytes(advisoryUrl), fetchBytes(coraltempProductUrl) ]);
  const [publisherMd5, publisherFilename] = checksum.toString().trim().split(/\s+/);
  if (publisherFilename !== latest.filename || publisherMd5 !== createHash('md5').update(bytes).digest('hex'))
    throw new Error('NOAA publisher checksum differs.');
  Object.assign(map.scientific, { filename: latest.filename, date, checked: now.toISOString(), advisory: parseEnsoAdvisory(advisoryBytes.toString()) });
  const temp = await mkdtemp(resolve(tmpdir(), 'earth-enso-'));
  try {
    const path = resolve(temp, 'source.nc'); await writeFile(path, bytes);
    const decoded = await readCoraltempAnomaly(path, map.scientific);
    const content = await getJson(resolve(source, 'content/object.json'));
    const lens = ensoContent(map.scientific), index = content.lenses.controls.findIndex(lens => lens.id === 'enso');
    if (index < 0) content.lenses.controls.splice(3, 0, lens); else content.lenses.controls[index] = lens;
    if (!content.resources.some(resource => resource.href === advisoryUrl)) content.resources.push({ label: 'NOAA', role: 'climate', description: 'ENSO advisory', href: advisoryUrl });
    const bindings = await getJson(resolve(source, 'content/lens-bindings.json'));
    bindings.controls.find(lens => lens.id === 'enso').qualification = lens.description;
    const updates = new Map([
      ['science/coraltemp-latest.nc', bytes], ['science/coraltemp-latest.nc.md5', checksum],
      ['science/coraltemp-product.html', productBytes], ['science/enso-advisory.html', advisoryBytes],
      ['preparation/paged-ellipsoid.json', json(config)], ['content/object.json', json(content)],
      ['content/lens-bindings.json', json(bindings)] ]);
    const manifest = await getJson(resolve(source, 'manifest.json'));
    manifest.inputs = manifest.inputs.filter(entry => entry.id !== 'noaa-oisst');
    const newInputs = [ { id: 'noaa-coraltemp-anomaly', path: map.path, origin: url },
      { id: 'noaa-coraltemp-checksum', path: 'science/coraltemp-latest.nc.md5', origin: `${url}.md5` },
      { id: 'noaa-coraltemp-product', path: 'science/coraltemp-product.html', origin: coraltempProductUrl },
      { id: 'noaa-enso-advisory', path: 'science/enso-advisory.html', origin: advisoryUrl } ];
    for (const input of newInputs) {
      const record = { ...input, expectedSha256: digest(updates.get(input.path)), expectedBytes: updates.get(input.path).length,
        credit: 'NOAA Coral Reef Watch and NOAA Climate Prediction Center', license: 'US government public domain',
        licenseEvidence: ['https://www.ncei.noaa.gov/archive'], acquisition: `Snapshot checked ${today}; raw analysis, publisher checksum, product description and advisory retained for reproducible preparation.`,
        redistribution: 'Retained NOAA data with attribution', consumers: ['enso'] };
      const at = manifest.inputs.findIndex(entry => entry.id === input.id);
      if (at < 0) manifest.inputs.push(record); else manifest.inputs[at] = record;
    }
    for (const collection of ['inputs', 'documents', 'generatedIntermediates']) for (const entry of manifest[collection]) {
      const changed = updates.get(entry.path);
      if (changed) Object.assign(entry, { expectedSha256: digest(changed), expectedBytes: changed.length });
    }
    const descriptor = await getJson(resolve(object, 'object.json'));
    for (const reference of descriptor.properties.recipe.sources) {
      const changed = updates.get(reference.path.replace(/^source\//, ''));
      if (changed) reference.sha256 = digest(changed);
    }
    // Parse and verify the complete scientific input before changing any pins.
    await mkdir(resolve(source, 'science'), { recursive: true });
    for (const [path, value] of updates) {
      const destination = resolve(source, path), staging = `${destination}.enso-update`;
      await writeFile(staging, value); await rename(staging, destination);
    }
    await writeFile(resolve(source, 'manifest.json'), json(manifest));
    await writeFile(resolve(object, 'object.json'), json(descriptor));
    return { ...decoded.receipt, sourceSha256: digest(bytes), publisherMd5, checked: map.scientific.checked, advisory: map.scientific.advisory };
  } finally { await rm(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(await refreshEarthEnso(), null, 2));
