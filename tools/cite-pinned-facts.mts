import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENE_OBJECTS } from '../site/objects.mts';
import { sha256 } from '../src/platform/sha256.mts';
import { hasErrorCode, requireArray, requireRecord, requireString } from './source-values.mts';

/**
 * A published fact names its source. This tool cites an uncited factsheet value from a record the body pins (JPL
 * Horizons queries, the JPL Small-Body Database, the DAMIT model record) or from a JPL satellite table row copied into
 * the body's source review, and only when the displayed value equals the record at the displayed precision. A value
 * that differs, even in the last digit, came from somewhere else; with `--prune` it is removed from the factsheet.
 */
const AU_KM = 149597870.7, DAYS_PER_YEAR = 365.25, CHECKED = '2026-09-16', REVIEW = 'editorial/factsheet-review.json';
const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const SATELLITE_TABLES = {
  elements: { url: 'https://ssd.jpl.nasa.gov/sats/elem/', catalogueId: 'jpl-satellite-mean-elements', label: 'JPL Planetary Satellite Mean Orbital Parameters' },
  physical: { url: 'https://ssd.jpl.nasa.gov/sats/phys_par/', catalogueId: 'jpl-satellite-physical-parameters', label: 'JPL Planetary Satellite Physical Parameters' },
  discovery: { url: 'https://ssd.jpl.nasa.gov/sats/discovery.html', catalogueId: 'jpl-satellite-discovery', label: 'JPL Planetary Satellite Discovery Circumstances' },
} as const;

export interface Citation { url: string; label: string; checked: string; path: string; catalogueId: string; locator: string }
interface Candidate { value: number | string; citation: Citation; text?: (shown: string) => boolean }
interface Displayed { value: number; decimals: number; unit: 'au' | 'year' | 'day' | 'hour' | 'km' }
interface Records {
  elements?: ReturnType<typeof parseHorizonsElements> | null; physical?: ReturnType<typeof parseHorizonsPhysical> | null;
  damit?: { modelId: string; url: string; periodHours: number | null } | null;
  sbdb?: ReturnType<typeof parseSmallBodyRecord> | null;
  satellite?: { index: number; table: keyof typeof SATELLITE_TABLES; columns: string[]; row: string[] }[];
}

/** The first number in a fact value and the unit word beside it; `About 129,000 km` reads as 129000 km with 0 decimals. */
export function displayedValue(text: string): Displayed | null {
  const number = /-?\d[\d,]*(?:\.\d+)?/.exec(text), unit = /\b(AU|years?|days?|hours?|km|h)\b/i.exec(text);
  if (!number || !unit) return null;
  const digits = number[0].replaceAll(',', ''), fraction = digits.split('.')[1] ?? '';
  const word = unit[1].toLowerCase().replace(/s$/, '');
  return { value: Number(digits), decimals: fraction.length, unit: word === 'au' ? 'au' : word === 'h' ? 'hour' : word as Displayed['unit'] };
}

export const equalAtDisplayedPrecision = (shown: Displayed, exact: number) => Math.abs(shown.value - exact) <= 0.5 * 10 ** -shown.decimals + 1e-9;

/** Every name in a discovery fact (`Karl Reinmuth · 1942`) appears in the record's discoverer text, and the years agree. */
export function discoveryMatches(shown: string, discoverers: string, year: string): boolean {
  const [names = '', when = ''] = shown.split('·').map(part => part.trim());
  if (!/^\d{4}$/.test(when) || when !== year) return false;
  const haystack = discoverers.toLowerCase(), noise = new Set(['and', 'the', 'team', 'science', 'et', 'al']);
  // One surname per discoverer: the last word of each name that is not a generic word; a team keeps its distinctive word.
  const surnames = names.split(/\s+and\s+|,\s*|\s+&\s+/).map(group => group.split(/\s+/).map(token => token.replace(/[.()]/g, '').toLowerCase()).filter(token => token.length > 2 && !noise.has(token)).at(-1)).filter((token): token is string => token !== undefined);
  return surnames.length > 0 && surnames.every(token => haystack.includes(token));
}

/** The first `$$SOE` row of a pinned Horizons ELEMENTS query, by its CSV header, with the query URL and epoch. */
export function parseHorizonsElements(text: string) {
  const lines = text.split('\n'), url = lines[0]?.startsWith('# ') ? lines[0].slice(2).trim() : null;
  const header = lines.find(line => line.includes('JDTDB') && line.includes('Calendar')), start = lines.findIndex(line => line.trim() === '$$SOE');
  const epoch = /Start time\s*:\s*A\.D\. (\d{4})-([A-Z][a-z]{2})-(\d{2})/.exec(text);
  if (!url || !header || start < 0 || !epoch) return null;
  const columns = header.split(',').map(column => column.trim()), row = (lines[start + 1] ?? '').split(',').map(cell => Number(cell.trim()));
  const column = (name: string) => { const index = columns.indexOf(name); assert.ok(index >= 0 && Number.isFinite(row[index]), `Horizons elements lack ${name}`); return row[index]!; };
  return { url, epoch: `${epoch[1]}-${MONTHS[epoch[2]!] ?? '00'}-${epoch[3]}`, semimajorAxisAu: column('A') / AU_KM, perihelionAu: column('QR') / AU_KM, periodDays: column('PR') };
}

/** `RAD=` and `ROTPER=` from a pinned Horizons small-body physical record. */
export function parseHorizonsPhysical(text: string) {
  const radius = /RAD=\s*([\d.]+)/.exec(text), rotation = /ROTPER=\s*([\d.]+)/.exec(text);
  return { radiusKm: radius ? Number(radius[1]) : null, rotationHours: rotation ? Number(rotation[1]) : null };
}

/** The fields of a pinned JPL Small-Body Database API response that factsheets display. */
export function parseSmallBodyRecord(raw: unknown) {
  const record = requireRecord(raw, 'SBDB record'), physical = new Map<string, string>();
  for (const entry of requireArray(record.phys_par ?? [], 'SBDB phys_par').map(value => requireRecord(value, 'SBDB parameter'))) {
    if (typeof entry.name === 'string' && typeof entry.value === 'string') physical.set(entry.name, entry.value);
  }
  const orbit = record.orbit === undefined ? {} : requireRecord(record.orbit, 'SBDB orbit'), elements = new Map<string, number>();
  for (const entry of requireArray(orbit.elements ?? [], 'SBDB elements').map(value => requireRecord(value, 'SBDB element'))) {
    if (typeof entry.name === 'string' && typeof entry.value === 'string') elements.set(entry.name, Number(entry.value));
  }
  const object = requireRecord(record.object, 'SBDB object'), discovery = record.discovery === undefined ? null : requireRecord(record.discovery, 'SBDB discovery');
  const orbitClass = object.orbit_class === undefined ? null : requireRecord(object.orbit_class, 'SBDB orbit class');
  const number = (name: string) => physical.has(name) ? Number(physical.get(name)) : null;
  return {
    designation: requireString(object.des ?? object.fullname, 'SBDB designation'),
    diameterKm: number('diameter'), rotationHours: number('rot_per'), extentKm: physical.get('extent') ?? null,
    semimajorAxisAu: elements.get('a') ?? null, periodDays: elements.get('per') ?? null, perihelionAu: elements.get('q') ?? null,
    orbitClass: orbitClass && typeof orbitClass.name === 'string' ? orbitClass.name : null,
    discoverers: discovery && typeof discovery.who === 'string' ? discovery.who : null,
    discoveryYear: discovery && typeof discovery.date === 'string' ? discovery.date.slice(0, 4) : null,
  };
}

/** Rows of a JPL satellite HTML table as text cells; header cells are returned first. */
export function parseSatelliteTable(html: string): string[][] {
  const rows: string[][] = [];
  for (const match of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...match[1]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(cell => cell[1]!.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
    if (cells.length) rows.push(cells);
  }
  return rows;
}

const optional = (path: string) => readFile(path, 'utf8').catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
const stripAbout = (value: string) => value.replace(/^About\s+/i, '');
const plain = (value: string) => value.toLowerCase().replace(/[\s-]+/g, '');

/** Candidate citations for one uncited fact, each with the exact value the record gives. */
export function candidates(factId: string, value: string, records: Records): Candidate[] {
  const shown = displayedValue(value), out: Candidate[] = [];
  const elements = records.elements;
  if (elements && shown) {
    const cite = (locator: string): Citation => ({ url: elements.url, label: `JPL Horizons, ${elements.epoch} epoch`, checked: CHECKED, path: 'source/reference/horizons-elements.txt', catalogueId: 'jpl-horizons', locator: `$$SOE first epoch; ${locator}` });
    if (factId === 'distance-from-sun' && shown.unit === 'au') out.push({ value: elements.semimajorAxisAu, citation: cite('A (km) / 149597870.7') });
    if (factId === 'perihelion' && shown.unit === 'au') out.push({ value: elements.perihelionAu, citation: cite('QR (km) / 149597870.7') });
    if (factId === 'orbital-period' && shown.unit === 'year') out.push({ value: elements.periodDays / DAYS_PER_YEAR, citation: cite('PR (days) / 365.25') });
    if (factId === 'orbital-period' && shown.unit === 'day') out.push({ value: elements.periodDays, citation: cite('PR (days)') });
  }
  const physical = records.physical;
  if (physical && shown) {
    const cite = (locator: string): Citation => ({ url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html', label: 'JPL Horizons pinned physical record', checked: CHECKED, path: 'source/reference/horizons-physical.txt', catalogueId: 'jpl-small-body-database', locator: `Target physical data: ${locator}` });
    if (factId === 'radius' && shown.unit === 'km' && physical.radiusKm !== null) out.push({ value: physical.radiusKm, citation: cite('RAD (km)') });
    if (factId === 'rotation-period' && shown.unit === 'hour' && physical.rotationHours !== null) out.push({ value: physical.rotationHours, citation: cite('ROTPER (h)') });
  }
  const damit = records.damit;
  if (damit && shown && damit.periodHours !== null && ['rotation-period', 'rotation'].includes(factId) && shown.unit === 'hour') {
    out.push({ value: damit.periodHours, citation: { url: damit.url, label: `DAMIT model ${damit.modelId}`, checked: CHECKED, path: 'source/reference/damit-model.json', catalogueId: 'damit-models', locator: 'fields.Period (h)' } });
  }
  const sbdb = records.sbdb;
  if (sbdb) {
    const cite = (locator: string): Citation => ({ url: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(sbdb.designation)}`, label: 'JPL Small-Body Database', checked: CHECKED, path: 'source/reference/sbdb.json', catalogueId: 'jpl-small-body-database', locator });
    if (shown) {
      if (factId === 'radius' && shown.unit === 'km' && sbdb.diameterKm !== null) out.push({ value: sbdb.diameterKm / 2, citation: cite('phys_par.diameter (km) / 2') });
      if (factId === 'diameter' && shown.unit === 'km' && sbdb.diameterKm !== null) out.push({ value: sbdb.diameterKm, citation: cite('phys_par.diameter (km)') });
      if (['rotation-period', 'rotation'].includes(factId) && shown.unit === 'hour' && sbdb.rotationHours !== null) out.push({ value: sbdb.rotationHours, citation: cite('phys_par.rot_per (h)') });
      if (factId === 'distance-from-sun' && shown.unit === 'au' && sbdb.semimajorAxisAu !== null) out.push({ value: sbdb.semimajorAxisAu, citation: cite('orbit.elements.a (au)') });
      if (factId === 'perihelion' && shown.unit === 'au' && sbdb.perihelionAu !== null) out.push({ value: sbdb.perihelionAu, citation: cite('orbit.elements.q (au)') });
      if (factId === 'orbital-period' && shown.unit === 'year' && sbdb.periodDays !== null) out.push({ value: sbdb.periodDays / DAYS_PER_YEAR, citation: cite('orbit.elements.per (d) / 365.25') });
      if (factId === 'orbital-period' && shown.unit === 'day' && sbdb.periodDays !== null) out.push({ value: sbdb.periodDays, citation: cite('orbit.elements.per (d)') });
    }
    if (factId === 'dimensions' && sbdb.extentKm !== null) {
      const extent = sbdb.extentKm.split(/\s*x\s*/).map(Number);
      out.push({ value: sbdb.extentKm, citation: cite('phys_par.extent (km)'), text: displayed => { const axes = stripAbout(displayed).replace(/\s*km.*$/, '').split(/\s*[×x]\s*/).map(Number); return axes.length === extent.length && axes.every((axis, index) => axis === extent[index]); } });
    }
    if (factId === 'class' && sbdb.orbitClass !== null) out.push({ value: sbdb.orbitClass, citation: cite('object.orbit_class.name'), text: displayed => plain(displayed) === plain(sbdb.orbitClass!) });
    if (factId === 'discovery' && sbdb.discoverers !== null && sbdb.discoveryYear !== null) out.push({ value: sbdb.discoverers, citation: cite('discovery.who; discovery.date'), text: displayed => discoveryMatches(displayed, sbdb.discoverers!, sbdb.discoveryYear!) });
  }
  for (const reference of records.satellite ?? []) {
    const table = SATELLITE_TABLES[reference.table], cell = (name: string) => reference.row[reference.columns.indexOf(name)];
    const cite = (locator: string): Citation => ({ url: table.url, label: table.label, checked: CHECKED, path: `source/${REVIEW}`, catalogueId: table.catalogueId, locator: `/references/${reference.index}; ${locator}` });
    if (reference.table === 'elements' && factId === 'parent') { const planet = cell('Planet') ?? ''; out.push({ value: planet, citation: cite('Planet'), text: displayed => displayed === planet }); }
    if (reference.table === 'elements' && shown) {
      const a = Number(cell('a (km)')), period = Number(cell('P (days)'));
      if (factId === 'distance-from-parent' && shown.unit === 'km' && Number.isFinite(a)) out.push({ value: a, citation: cite('a (km)') });
      if (factId === 'orbital-period' && shown.unit === 'hour' && Number.isFinite(period)) out.push({ value: period * 24, citation: cite('P (days) × 24') });
      if (factId === 'orbital-period' && shown.unit === 'day' && Number.isFinite(period)) out.push({ value: period, citation: cite('P (days)') });
    }
    if (reference.table === 'physical' && shown && factId === 'radius' && shown.unit === 'km') {
      const radius = Number(cell('Mean Radius (km)')?.split(' ')[0]);
      if (Number.isFinite(radius)) out.push({ value: radius, citation: cite('Mean Radius (km) value') });
    }
    if (reference.table === 'discovery' && factId === 'discovery') {
      const who = cell('discoverer(s)/spacecraft mission') ?? '', year = cell('year discovered') ?? '';
      out.push({ value: who, citation: cite('discoverer(s); year discovered'), text: displayed => discoveryMatches(displayed, who, year) });
    }
  }
  return out;
}

const matches = (candidate: Candidate, value: string) => candidate.text ? candidate.text(value) : equalAtDisplayedPrecision(displayedValue(value)!, candidate.value as number);

/** Copy the body's rows of the three JPL satellite tables into its source review, once each. Returns the references. */
async function reviewSatelliteRows(objectDirectory: string, name: string, tables: Map<keyof typeof SATELLITE_TABLES, string[][]>, write: boolean) {
  const reviewPath = resolve(objectDirectory, 'source', REVIEW), text = await optional(reviewPath);
  const review = text ? requireRecord(JSON.parse(text), 'factsheet review') : { schema: 'cssearth-factsheet-source-review@1', objectId: objectDirectory.split('/').at(-1), checked: CHECKED, references: [] };
  const references = requireArray(review.references ?? [], 'review references').map(value => requireRecord(value, 'review reference'));
  let changed = false;
  for (const [table, rows] of tables) {
    const { url } = SATELLITE_TABLES[table], header = rows.find(row => row.includes(table === 'elements' ? 'a (km)' : table === 'physical' ? 'Mean Radius (km)' : 'year discovered'));
    const nameColumn = table === 'discovery' ? 'IAU name' : 'Satellite';
    const row = header && rows.find(candidate => candidate.length === header.length && candidate[header.indexOf(nameColumn)] === name);
    if (!header || !row || references.some(reference => reference.url === url)) continue;
    references.push({ url, columns: header, row }); changed = true;
  }
  if (changed && write) {
    await mkdir(resolve(objectDirectory, 'source/editorial'), { recursive: true });
    await writeFile(reviewPath, `${JSON.stringify({ ...review, references }, null, 2)}\n`);
    await pinDocument(objectDirectory, REVIEW, 'Project-recorded source review rows for factsheet citations.');
  }
  return references.flatMap((reference, index) => {
    const table = (Object.keys(SATELLITE_TABLES) as (keyof typeof SATELLITE_TABLES)[]).find(key => SATELLITE_TABLES[key].url === reference.url);
    return table && Array.isArray(reference.columns) && Array.isArray(reference.row) ? [{ index, table, columns: reference.columns as string[], row: reference.row as string[] }] : [];
  });
}

/** Declare a project-written document in the manifest when it is new; pins are recomputed by pin:documents afterwards. */
async function pinDocument(objectDirectory: string, path: string, reason: string, binding?: Record<string, unknown>) {
  const manifestPath = resolve(objectDirectory, 'source/manifest.json'), manifest = requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')), 'source manifest');
  const documents = requireArray(manifest.documents ?? [], 'manifest documents').map(value => requireRecord(value, 'manifest document'));
  if (documents.some(entry => entry.path === path)) return;
  const bytes = await readFile(resolve(objectDirectory, 'source', path));
  documents.push({ path, expectedBytes: bytes.length, expectedSha256: sha256(bytes), sourceBinding: binding ?? { kind: 'local', reason } });
  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, documents }, null, 2)}\n`);
}

/** The SBDB query string for a body: `2002 TC302`, `17P`, `C/2020 F3` or the catalogue name. */
export function smallBodyQuery(id: string, name: string): string {
  const asteroid = /^asteroid-(\d{4})-([a-z]+)(\d*)$/.exec(id);
  if (asteroid) return `${asteroid[1]} ${asteroid[2]!.toUpperCase()}${asteroid[3]}`;
  const periodic = /^comet-(\d+p)$/.exec(id);
  if (periodic) return periodic[1]!.toUpperCase();
  const comet = /^comet-([cp])(\d{4})-([a-z]+)(\d*)$/.exec(id);
  if (comet) return `${comet[1]!.toUpperCase()}/${comet[2]} ${comet[3]!.toUpperCase()}${comet[4]}`;
  return name;
}

/** Fetch and pin the JPL Small-Body Database record for one body when it has none; an ambiguous or failed lookup pins nothing. */
async function fetchSmallBodyRecord(objectDirectory: string, query: string, write: boolean): Promise<string | null> {
  const url = `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(query)}&phys-par=1&discovery=1`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) return null;
  const text = await response.text(), record = requireRecord(JSON.parse(text), 'SBDB response');
  if (record.object === undefined) return null;
  if (!write) return text;
  await mkdir(resolve(objectDirectory, 'source/reference'), { recursive: true });
  await writeFile(resolve(objectDirectory, 'source/reference/sbdb.json'), text.endsWith('\n') ? text : `${text}\n`);
  await pinDocument(objectDirectory, 'reference/sbdb.json', '', {
    kind: 'catalogued', references: [{ catalogueId: 'jpl-small-body-database', role: 'reference', evidence: `JPL SBDB API response for ${query}: physical parameters, orbit elements and discovery circumstances.` }],
  });
  return text;
}

export interface CitationRun { cited: string[]; pruned: string[]; fetched: string[] }

/** Cite one body's uncited facts from its records; with `prune`, drop what stays uncited. Nothing is written in check mode. */
export async function citePinnedFacts(objectDirectory: string, { write = true, prune = false, fetchRecords = false, satelliteTables = new Map<keyof typeof SATELLITE_TABLES, string[][]>(), classification = 'asteroid', name = '' } = {}): Promise<CitationRun> {
  const run: CitationRun = { cited: [], pruned: [], fetched: [] };
  const contentPath = resolve(objectDirectory, 'source/content/object.json'), text = await optional(contentPath);
  if (!text) return run;
  const content = requireRecord(JSON.parse(text), 'object content'), panel = content.panel;
  if (panel === undefined) return run;
  const manifest = requireRecord(JSON.parse(await readFile(resolve(objectDirectory, 'source/manifest.json'), 'utf8')), 'source manifest');
  const pinned = new Set(['inputs', 'documents'].flatMap(key => requireArray(manifest[key] ?? [], `manifest ${key}`).map(entry => `source/${requireString(requireRecord(entry, 'manifest entry').path, 'manifest path')}`)));
  const read = async (path: string) => pinned.has(path) ? optional(resolve(objectDirectory, path)) : null;
  const facts = ['facts', 'moreFacts'].flatMap(group => requireArray(requireRecord(panel, 'factsheet panel')[group] ?? [], `panel ${group}`).map(raw => requireRecord(raw, 'fact')));
  const uncited = facts.filter(fact => fact.source === undefined);
  if (!uncited.length) return run;
  const records: Records = {};
  const elementsText = await read('source/reference/horizons-elements.txt'), physicalText = await read('source/reference/horizons-physical.txt');
  records.elements = elementsText ? parseHorizonsElements(elementsText) : null;
  records.physical = physicalText ? parseHorizonsPhysical(physicalText) : null;
  const damitText = await read('source/reference/damit-model.json');
  if (damitText) {
    const damit = requireRecord(JSON.parse(damitText), 'DAMIT model'), fields = requireRecord(damit.fields, 'DAMIT fields');
    records.damit = { modelId: String(damit.modelId), url: requireString(damit.url, 'DAMIT url'), periodHours: typeof fields.Period === 'string' && fields.Period ? Number(fields.Period) : null };
  }
  const smallBody = ['asteroid', 'comet', 'dwarf-planet', 'trans-neptunian'].includes(classification);
  let sbdbText = await read('source/reference/sbdb.json');
  if (!sbdbText && smallBody && fetchRecords) {
    sbdbText = await fetchSmallBodyRecord(objectDirectory, smallBodyQuery(objectDirectory.split('/').at(-1)!, name), write);
    if (sbdbText) run.fetched.push('reference/sbdb.json');
  }
  records.sbdb = sbdbText ? parseSmallBodyRecord(JSON.parse(sbdbText)) : null;
  if (classification === 'satellite' && satelliteTables.size) records.satellite = await reviewSatelliteRows(objectDirectory, name, satelliteTables, write);
  else if (classification === 'satellite') records.satellite = await reviewSatelliteRows(objectDirectory, name, new Map(), false);
  for (const fact of uncited) {
    const id = requireString(fact.id, 'fact id'), value = requireString(fact.value, 'fact value');
    const match = candidates(id, value, records).find(candidate => (candidate.text || displayedValue(value)) && matches(candidate, value));
    if (match) { fact.source = match.citation; run.cited.push(id); }
    else if (prune) run.pruned.push(id);
  }
  if (prune) for (const group of ['facts', 'moreFacts']) {
    const list = requireRecord(panel, 'factsheet panel')[group];
    if (Array.isArray(list)) requireRecord(panel, 'factsheet panel')[group] = list.filter(raw => requireRecord(raw, 'fact').source !== undefined);
  }
  if ((run.cited.length || run.pruned.length) && write) await writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`);
  return run;
}

/** The three JPL satellite tables, fetched once per run. */
export async function fetchSatelliteTables() {
  const tables = new Map<keyof typeof SATELLITE_TABLES, string[][]>();
  for (const [key, table] of Object.entries(SATELLITE_TABLES) as [keyof typeof SATELLITE_TABLES, { url: string }][]) {
    const response = await fetch(table.url, { signal: AbortSignal.timeout(60_000) });
    assert.ok(response.ok, `${table.url}: ${response.status}`);
    tables.set(key, parseSatelliteTable(await response.text()));
  }
  return tables;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const flags = new Set(process.argv.slice(2).filter(argument => argument.startsWith('--'))), check = flags.has('--check'), prune = flags.has('--prune'), fetchRecords = flags.has('--fetch');
  const ids = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
  assert.ok(ids.every(id => SCENE_OBJECTS.some(object => object.id === id)), 'Unregistered factsheet target');
  const satelliteTables = fetchRecords ? await fetchSatelliteTables() : new Map<keyof typeof SATELLITE_TABLES, string[][]>();
  const results: Record<string, CitationRun> = {};
  for (const object of SCENE_OBJECTS) if (!ids.length || ids.includes(object.id)) {
    const run = await citePinnedFacts(resolve(import.meta.dirname, '../src/objects', object.id), { write: !check, prune, fetchRecords, satelliteTables, classification: object.classification, name: object.name });
    if (run.cited.length || run.pruned.length || run.fetched.length) results[object.id] = run;
  }
  const total = (key: keyof CitationRun) => Object.values(results).reduce((sum, run) => sum + run[key].length, 0);
  console.log(JSON.stringify({ check, prune, objects: Object.keys(results).length, cited: total('cited'), pruned: total('pruned'), fetched: total('fetched'), results }));
  if (check && (total('cited') || total('pruned'))) process.exitCode = 1;
}
