/** `telescope new-object` for coronae: draft a spec from the magnetic maps a star's page already shows, write each entry's
 * volume bank and the star's dataset steps, and bake them (corona-bank.mts holds the records; the derivation is
 * `@cssearth/bake/objects/stellar`, corona/). The spec may be run again: the records follow it, and the bank's README is
 * kept once written. */
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { bodyFixedToIcrf, directionFromRaDec, skyBasis } from '@cssearth/astronomy';
import { loadScienceSurface } from '@cssearth/bake/objects/raster';
import { readAuthoredRotation } from '@cssearth/bake/objects/scene';
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { fetchPublication, VIZIER_ASU, type Archive } from '../archives/archives.mts';
import { blendingCompanion, WDS_CREDIT } from '../companion-blend.mts';
import { publicationRecord } from '../publication-record.mts';
import { GM_SUN, SOLAR_RADIUS_KM } from '../hosted.mts';
import { coronaFiles, coronaPhysics, parseCoronae, type CoronaEntry, type CoronaMapInput, type CoronaSource, type CoronaStar } from './corona-bank.mts';

interface Context { readonly root: string; readonly archive: Archive; readonly progress: (line: string) => void }
export interface CoronaResult { readonly id: string; readonly host: string; readonly maps: number; readonly files: number; readonly report?: string; readonly failed?: string }
type Json = Record<string, unknown>;

const exists = (path: string) => stat(path).then(() => true, () => false);
const reason = (error: unknown) => (error as Error).message.split('\n')[0]!;
const readJson = async (root: string, path: string, what: string): Promise<Json> => { let text: string; try { text = await readFile(resolve(root, path), 'utf8'); } catch { throw new Error(`${what}: ${path} does not exist.`); } return requireRecord(JSON.parse(text), path); };
/** The ROSAT all-sky survey's stars with their Gaia matches: Freund et al. (2022), A&A 664, A105. Its flux column is in
 * mW m⁻², which is erg s⁻¹ cm⁻². */
export const ROSAT_STARS = Object.freeze({ source: 'J/A+A/664/A105', catalogueId: 'vizier-j-a-a-664-a105', url: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/664/A105', label: 'Freund et al. (2022), A&A 664, A105', band: '0.1 to 2.4 keV (ROSAT)', radiusArcsec: 60 });

/** A dataset of the star's page that draws the radial component of a magnetic map in gauss. */
const isRadialField = (science: Json) => science.units === 'G' && typeof science.variable === 'string' && /radial|^B\s*(?:<sub>)?\s*R\b/iu.test(science.variable);
const surfacesOf = (raster: Json, host: string) => requireArray(raster.surfaces, `${host} raster surfaces`).map(surface => requireRecord(surface, `${host} raster surface`));

/** The star as its own package records it: mass and radius from its astronomy record, its place from its prepared scene,
 * and the body frame its surface maps are drawn in from its rotation record. */
export async function readStar(root: string, host: string) {
  const at = `src/objects/${host}`, content = await readJson(root, `${at}/source/content/object.json`, `${host}: no such page`), text = await readJson(root, `${at}/text.json`, host);
  const descriptor = await readJson(root, `${at}/object.json`, host), manifest = await readJson(root, `${at}/source/manifest.json`, host), raster = await readJson(root, `${at}/source/preparation/raster.json`, `${host}: the page draws no surface map`);
  const physical = requireRecord((await readJson(root, `packages/astronomy/data/bodies/${host}.json`, `${host}: no astronomy record`)).physical, `${host} physical record`);
  const scene = await readJson(root, `${at}/prepared/scene.json`, `${host}: its prepared scene is not restored (pnpm setup:prepared)`), frame = requireRecord(scene.worldFrame, `${host} world frame`);
  const origin = requireArray(frame.originM, `${host} scene origin`).map(value => requireFiniteNumber(value, `${host} scene origin`)) as [number, number, number], distance = Math.hypot(...origin), away = origin.map(value => value / distance);
  const rotationRecord = `${at}/source/preparation/rotation.json`;
  if (!await exists(resolve(root, rotationRecord))) throw new Error(`${host}: no ${rotationRecord}; a corona needs the frame the star's maps are drawn in.`);
  const elements = await readAuthoredRotation(resolve(root, at), { path: 'source/preparation/rotation.json' }, requireFiniteNumber(frame.epochJdTt, `${host} scene epoch`)), body = bodyFixedToIcrf(elements);
  const raDeg = (Math.atan2(away[1]!, away[0]!) * 180 / Math.PI + 360) % 360, decDeg = Math.asin(away[2]!) * 180 / Math.PI, { east, north } = skyBasis(raDeg, decDeg), toStar = directionFromRaDec(raDeg, decDeg);
  // The grid's axes are west, north and away from Earth; the body's axes are the columns of the body-fixed matrix.
  const axes = [east.map(value => -value), north, toStar], turn = [0, 1, 2].map(row => axes.map(axis => body[row]! * axis[0]! + body[3 + row]! * axis[1]! + body[6 + row]! * axis[2]!));
  const bodyFromGrid = (x: number, y: number, z: number) => { const bx = turn[0]![0]! * x + turn[0]![1]! * y + turn[0]![2]! * z, by = turn[1]![0]! * x + turn[1]![1]! * y + turn[1]![2]! * z, bz = turn[2]![0]! * x + turn[2]![1]! * y + turn[2]![2]! * z;
    return [Math.acos(Math.max(-1, Math.min(1, bz / Math.hypot(bx, by, bz)))), (Math.atan2(by, bx) + 2 * Math.PI) % (2 * Math.PI)] as const; };
  const star: CoronaStar = { id: host, name: requireString(content.displayName, `${host} display name`), colorHex: requireString(requireRecord(requireRecord(descriptor.properties, `${host} properties`).catalog, `${host} catalogue entry`).color, `${host} catalogue color`),
    massSolar: requireFiniteNumber(physical.gravitationalParameterKm3PerS2, `${host} gravitational parameter`) / GM_SUN, radiusSolar: requireFiniteNumber(physical.meanRadiusKm, `${host} radius`) / SOLAR_RADIUS_KM, radiusM: requireFiniteNumber(frame.bodyRadiusM, `${host} scene radius`),
    originM: origin, bodyFromGrid, inclinationDegrees: Math.acos(Math.max(-1, Math.min(1, -turn[2]![2]!))) * 180 / Math.PI, rotationRecord };
  if (!/^#[0-9a-f]{6}$/iu.test(star.colorHex)) throw new Error(`${host}: catalogue color ${star.colorHex} is not a six-digit hex color.`);
  return { star, content, text, manifest, raster };
}

/** `--from-magnetic HOST...`: one entry a star, with every radial-field map its page shows, its ROSAT flux, and the two
 * relations for the temperature and the mass loss nobody has measured. A person replaces a relation by a cited measurement
 * where one exists. */
export async function draftsFromMagneticMaps(names: readonly string[], context: Context): Promise<{ readonly stars: readonly unknown[]; readonly coronae: readonly unknown[]; readonly report: readonly string[] }> {
  const coronae: unknown[] = [], report: string[] = [];
  for (const host of names) {
    try {
      const { star, raster } = await readStar(context.root, host), radial = surfacesOf(raster, host).filter(surface => isRecord(surface.science) && isRadialField(surface.science));
      if (!radial.length) throw new Error(`${host}: its page draws no radial magnetic field in gauss.`);
      const slug = (words: string) => words.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, ''), labels = radial.map(surface => requireString(requireRecord(surface.science, 'science').label, `${host} map label`));
      const drafted = radial.map((surface, index) => ({ surface: requireString(surface.id, `${host} surface id`), id: labels.filter(label => label === labels[index]).length > 1 ? slug(requireString(surface.id, 'id')) : slug(labels[index]!), label: labels[index]! }));
      // Maps labelled by month and year are stepped through in order of time, whatever order the page lists them in.
      const when = (label: string) => { const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/u.exec(label); return match ? Number(match[2]) * 12 + 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(match[1]!) / 3 : NaN; };
      const maps = drafted.every(map => Number.isFinite(when(map.label))) ? [...drafted].sort((a, b) => when(a.label) - when(b.label)) : drafted;
      const distance = Math.hypot(...star.originM), raDeg = (Math.atan2(star.originM[1], star.originM[0]) * 180 / Math.PI + 360) % 360, decDeg = Math.asin(star.originM[2] / distance) * 180 / Math.PI;
      // ROSAT's survey does not separate two stars this close: a companion that gives a share of the light gives a share of the X-rays.
      const pair = await blendingCompanion(context.archive, { ra: raDeg, dec: decDeg });
      if (pair) throw new Error(`${host}: its ROSAT source is two stars'. ${WDS_CREDIT} lists WDS ${pair.wds} ${pair.discoverer}: ${pair.separationArcsec < 0 ? 'separation not measured' : `${pair.separationArcsec} arcsec apart`}, the companion ${(pair.share * 100).toFixed(1)}% of the light. Cite this star's own X-ray flux by hand.`);
      const tsv = await context.archive.text(VIZIER_ASU, { '-source': ROSAT_STARS.source, '-c': `${raDeg.toFixed(5)} ${decDeg >= 0 ? '+' : ''}${decDeg.toFixed(5)}`, '-c.rs': String(ROSAT_STARS.radiusArcsec), '-out': '2RXS,Sep,pstellar,FX', '-out.max': '3', '-sort': '_r' });
      const rows = tsv.split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('\t')), header = rows.findIndex(row => row.includes('FX')), row = header < 0 ? undefined : rows.slice(header + 3).find(cells => cells.length >= rows[header]!.length);
      if (!row) throw new Error(`${host}: no star within ${ROSAT_STARS.radiusArcsec} arcsec in ${ROSAT_STARS.label}; cite its X-ray flux by hand.`);
      const cell = (name: string) => row[rows[header]!.indexOf(name)]!.trim(), flux = Number(cell('FX'));
      if (!(flux > 0)) throw new Error(`${host}: ${ROSAT_STARS.label} lists ${cell('2RXS')} with no flux.`);
      const entry = { host, bank: `${host}-corona`, maps, xray: { fluxErgCm2S: flux, band: ROSAT_STARS.band, catalogueId: ROSAT_STARS.catalogueId, url: ROSAT_STARS.url, label: ROSAT_STARS.label, locator: `${cell('2RXS')}, ${cell('Sep')} arcsec from the star's Gaia position, stellar probability ${cell('pstellar')}` },
        temperature: { relation: 'johnstone-guedel-2015' }, massLoss: { relation: 'wood-2021' }, ledger: [] };
      const physics = coronaPhysics(parseCoronae({ coronae: [entry] })[0]!, star);
      coronae.push(entry);
      report.push(`${host}: ${maps.length} map(s) (${maps.map(map => map.label).join(', ')}); ${cell('2RXS')} ${flux.toExponential(2)} erg/s/cm2, L_X ${physics.xrayLuminosityErgS.toExponential(2)} erg/s, F_X ${physics.surfaceFlux.toExponential(2)}; by the relations ${(physics.kelvin / 1e6).toFixed(1)} MK and ${physics.massLossSolar.toFixed(0)} solar mass-loss rates; sonic point ${physics.wind.criticalRadii.toFixed(2)} R.`
        + (physics.refused ? ` REFUSED as drafted: ${physics.refused}` : ''));
    } catch (error) { report.push(`${host}: not drafted: ${reason(error)}`); }
  }
  return { stars: [], coronae, report };
}

/** A record in src/sources for every source an entry cites: the one there, a VizieR catalogue by its address, or a paper read
 * from arXiv or Crossref by its link. */
async function sourceRecords(entry: CoronaEntry, checked: string, { root, archive }: Context) {
  const records = new Map<string, string>(), cited: CoronaSource[] = [entry.xray, ...'kelvin' in entry.temperature ? [entry.temperature] : [{ catalogueId: 'arxiv-1505-00643', url: 'https://arxiv.org/abs/1505.00643', label: '', locator: '' }],
    ...'solar' in entry.massLoss ? [entry.massLoss] : [{ catalogueId: 'arxiv-2105-00019', url: 'https://arxiv.org/abs/2105.00019', label: '', locator: '' }]];
  for (const source of cited) {
    const path = `src/sources/${source.catalogueId}.json`;
    if (records.has(path) || await exists(resolve(root, path))) continue;
    const vizier = source.url.match(/\/viz-bin\/cat\/(.+)$/u)?.[1];
    if (vizier) { records.set(path, `${JSON.stringify({ id: source.catalogueId, kind: 'data-product', identityLevel: 'work', title: `${source.label}, VizieR ${vizier}`, identifiers: [{ type: 'VizieR catalogue', value: vizier }],
      links: [{ role: 'landing', url: source.url, label: `VizieR ${vizier}` }], evidence: [{ url: source.url, checkedOn: source.checked ?? checked, locator: `The catalogue as VizieR serves it; each package that cites it names its own row.` }], relations: [],
      statements: [{ kind: 'credit', text: `${source.label}; VizieR (CDS)`, scope: 'citation', evidence: source.url }], publisher: 'CDS, Strasbourg' }, null, 2)}\n`); continue; }
    const publication = /arxiv\.org\/abs\/|doi\.org\//u.test(source.url) ? await fetchPublication(archive, source.url) : undefined;
    if (!publication) throw new Error(`${entry.bank}: ${path} does not exist, and ${source.url} is not a VizieR, arXiv or DOI link to write it from.`);
    records.set(path, `${JSON.stringify(publicationRecord({ ...publication, id: source.catalogueId }), null, 2)}\n`);
  }
  return records;
}

/** Write one entry: its bank's records and grids, and its star's dataset steps. */
async function writeCorona(entry: CoronaEntry, context: Context): Promise<CoronaResult> {
  const { root } = context, at = `src/objects/${entry.bank}`, inTree = (path: string) => resolve(root, path), checked = new Date().toISOString().slice(0, 10);
  if (await exists(inTree(at))) { const made = await readJson(root, `${at}/object.json`, entry.bank);
    if (requireRecord(made.properties, `${entry.bank} properties`).host !== entry.host || !await exists(inTree(`${at}/source/corona-parameters.json`))) throw new Error(`${at} already exists and is not the corona of ${entry.host}; the generator rewrites only what it made.`); }
  const { star, content, text, manifest, raster } = await readStar(root, entry.host), surfaces = surfacesOf(raster, entry.host), declared = requireArray(manifest.inputs, `${entry.host} manifest inputs`).map(input => requireRecord(input, `${entry.host} manifest input`));
  const maps: CoronaMapInput[] = [];
  for (const map of entry.maps) {
    const surface = surfaces.find(one => one.id === map.surface), science = surface && isRecord(surface.science) ? surface.science : undefined;
    if (!science || !isRadialField(science)) throw new Error(`${entry.host}: its dataset ${map.surface} is not a radial magnetic field in gauss.`);
    const path = requireString(science.path, `${entry.host} ${map.surface} path`), manifestInput = declared.find(input => input.path === path);
    if (!manifestInput) throw new Error(`${entry.host}: its manifest does not list ${path}.`);
    if (!await exists(inTree(`src/objects/${entry.host}/source/${path}`))) throw new Error(`${entry.host}: ${path} is not restored (node packages/bake/cli/restore-source-inputs.mts --object=${entry.host}).`);
    maps.push({ entry: map, sample: (await loadScienceSurface(inTree(`src/objects/${entry.host}/source`), science)).sample, science, manifestInput });
  }
  const records = await sourceRecords(entry, checked, context), { files, readme, previews, report } = coronaFiles(entry, { star, maps, host: { content, text }, checked });
  let written = 0;
  const put = async (path: string, value: string | Buffer) => { await mkdir(dirname(inTree(path)), { recursive: true }); await writeFile(inTree(path), value); written++; };
  for (const [path, value] of [...files, ...records]) await put(path, value);
  for (const preview of previews) await put(preview.path, await sharp(preview.rgba, { raw: { width: preview.pixels, height: preview.pixels, channels: 4 } }).png().toBuffer());
  if (!await exists(inTree(`${at}/README.md`))) await put(`${at}/README.md`, readme);
  return { id: entry.bank, host: entry.host, maps: maps.length, files: written, report };
}

/** Every corona of a spec file, written. One that fails is reported with its reason and the rest go on. */
export async function runCoronae(specPath: string, context: Context): Promise<CoronaResult[]> {
  const entries = parseCoronae(JSON.parse(await readFile(resolve(specPath), 'utf8'))), results: CoronaResult[] = [];
  for (const entry of entries) {
    try { const result = await writeCorona(entry, context); results.push(result); context.progress(`  ${entry.bank}: written; ${result.report}`); }
    catch (error) { results.push({ id: entry.bank, host: entry.host, maps: entry.maps.length, files: 0, failed: reason(error) }); context.progress(`  ${entry.bank}: FAILED, not written: ${reason(error)}`); }
  }
  return results;
}

/** Bake the banks and their stars: each bank's source records, slabs and presentation, then the stars' page data and reader
 * text in one run, the dataset billboards and the banks' sidebar thumbnails. Stops at the first step that fails. */
export async function bakeCoronae(results: readonly CoronaResult[], { root, progress }: Pick<Context, 'root' | 'progress'>): Promise<boolean> {
  const banks = results.map(result => result.id), hosts = [...new Set(results.map(result => result.host))], node = (...args: string[]) => ['node', ...args];
  const steps = [node('packages/bake/cli/check-stale-builds.mts', '--run'), ...banks.flatMap(bank => [node('site/build/prepare/catalog/author-source-records.mts', bank), node('packages/bake/cli/prepare-nebulae.mts', `--object=${bank}`), node('site/build/prepare/catalog/prepare-volume-presentation.mts', `--object=${bank}`)]),
    // The stars' images do not change, so their bake stops after the page data (--reuse-images); the reader text is its own step.
    node('packages/bake/cli/prepare-object.mts', ...hosts, '--reuse-images', '--from', 'catalogue'), node('site/build/prepare/authored/prepare-text.mts', ...hosts), node('packages/bake/cli/prepare-dataset-billboards.mts')];
  for (const [command, ...args] of steps as [string, ...string[]][]) {
    progress(`== ${args.join(' ')}`);
    const code = await new Promise<number | null>(done => { spawn(command, args, { cwd: root, stdio: ['ignore', 2, 2] }).on('error', () => done(null)).on('close', done); });
    if (code !== 0) { progress(`FAILED: ${command} ${args.join(' ')}`); return false; }
  }
  return true;
}

export const formatCoronae = (results: readonly CoronaResult[], spec: string, baked: boolean) => `${results.map(result => result.failed ? `${result.id} (corona): FAILED, not written: ${result.failed}`
  : `${result.id} (corona of ${result.host}, ${result.maps} map${result.maps === 1 ? '' : 's'}): ${result.files} files. ${result.report}`).join('\n')}\n${baked ? `${results.filter(result => !result.failed).length} corona bank(s) baked.` : `Then bake: telescope new-object ${spec} --bake`}\n`;
