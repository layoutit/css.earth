import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { sha256 } from '@cssearth/core/node';
import { hasErrorCode, requireArray, requireRecord, requireString } from '@cssearth/core';

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


/** Numbers a fact states, without their uncertainties: `2,326 ± 12 km` states 2326; `764 (+116/-62)` states 764. */
export function statedNumbers(text: string): { value: number; decimals: number }[] {
  const plain = text.replace(/±\s*[\d.,]+/g, ' ').replace(/\+\/-\s*[\d.,]+/g, ' ').replace(/\([+−-][^)]*\)/g, ' ');
  // A number glued to letters or a hyphen (`S/2000 S10`, `MTP019`, `2000-01-01.5`) is part of a name or date, not a measurement.
  return [...plain.matchAll(/(?<![\p{L}\d/.,-])-?\d[\d,]*(?:\.\d+)?(?![\p{L}\d-])/gu)].map(match => {
    const digits = match[0].replaceAll(',', '');
    return { value: Number(digits), decimals: (digits.split('.')[1] ?? '').length };
  });
}

const significantDigits = (value: number, decimals: number) => value.toFixed(decimals).replace(/^-?0*\.?0*/, '').replace('.', '').length;
// A record value supports a stated number directly, as a diameter or radius, or across units of the fact's own kind.
export function conversionsFor(text: string): readonly number[] {
  if (/\bsolar radii\b/i.test(text)) return [1, 2, 0.5, 1 / 695700];
  if (/\bkm\/h\b/i.test(text)) return [1];
  if (/\b(km|m)\b/i.test(text)) return [1, 2, 0.5, 1000, 1 / 1000];
  if (/\b(hours?|h|days?|d|years?|yr)\b/i.test(text)) return [1, 24, 1 / 24, 365.25, 1 / 365.25, 24 * 365.25, 1 / (24 * 365.25)];
  return [1];
}

/** The record field must measure the fact's kind of quantity: a size for a length, a period for a time, the label's own word otherwise. */
export function fieldMeasures(pointer: string, value: string, label: string): boolean {
  // `/projectedRadiusKm/value` and `/diameterUncertaintyKm/plus` are measured by their named parent.
  const field = pointer.split('/').filter(part => !/^(\d+|value|plus|minus|sigma|uncertainty|lower|upper)$/i.test(part)).at(-1) ?? '';
  if (/\bsolar radii\b/i.test(value)) return /radius|radii/i.test(field);
  if (/\bkm\/h\b/i.test(value)) return /wind|speed|velocity/i.test(field);
  if (/\bAU\b/.test(value)) return /au$|distance|semimajor|perihelion|aphelion/i.test(field);
  if (/\b(km|m)\b/i.test(value)) return /km|radius|radii|diameter|axes|axis|extent|size|dimension|width|length|thickness|span|distance|semi|orbit/i.test(field) && !/deg|angle|anomaly|node|point|outline|pixel|lat|lon/i.test(field);
  if (/\b(hours?|h|days?|d|years?|yr)\b/i.test(value)) return /hour|day|year|period|rotation|spin|lightcurve/i.test(field);
  const words = label.toLowerCase().match(/[a-z]{5,}/g) ?? [];
  return words.some(word => field.toLowerCase().includes(word.slice(0, 6)));
}

interface SourcedRecord { path: string; leaves: { pointer: string; numbers: number[]; text: string | null; url: string | null }[] }

/** Every leaf of a pinned project record, each with the nearest source URL its enclosing objects name. */
export function recordLeaves(raw: unknown) {
  const leaves: SourcedRecord['leaves'] = [];
  const urlOf = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null;
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value);
    const preferred = entries.find(([key, item]) => typeof item === 'string' && /^https:\/\//.test(item) && /source|url|doi|citation|reference|origin|landing/i.test(key));
    const any = entries.find(([, item]) => typeof item === 'string' && /^https:\/\//.test(item));
    return (preferred ?? any)?.[1] as string ?? null;
  };
  const walk = (value: unknown, pointer: string, urls: (string | null)[]) => {
    if (typeof value === 'number' && Number.isFinite(value)) { leaves.push({ pointer, numbers: [value], text: null, url: urls.findLast(url => url !== null) ?? null }); return; }
    if (typeof value === 'string') { leaves.push({ pointer, numbers: statedNumbers(value).map(number => number.value), text: value, url: urls.findLast(url => url !== null) ?? null }); return; }
    if (!value || typeof value !== 'object') return;
    const next = [...urls, urlOf(value)];
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${pointer}/${index}`, next));
    else for (const [key, item] of Object.entries(value)) walk(item, `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`, next);
  };
  walk(raw, '', []);
  const top = leaves.find(leaf => leaf.url)?.url ?? null;
  return leaves.map(leaf => ({ ...leaf, url: leaf.url ?? top }));
}

let catalogueByUrl: Map<string, { id: string; title: string }> | null = null;
const normalUrl = (url: string) => url.trim().toLowerCase().replace(/^http:/, 'https:').replace(/\/+$/, '').replace('arxiv.org/pdf/', 'arxiv.org/abs/').replace(/(arxiv\.org\/abs\/[\d.]+)v\d+$/, '$1').replace('dx.doi.org', 'doi.org');
/** Source catalogue entries by every landing URL, DOI and arXiv identifier they declare. */
async function sourceCatalogue(root: string) {
  if (catalogueByUrl) return catalogueByUrl;
  catalogueByUrl = new Map();
  const directory = resolve(root, 'src/sources');
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.json')).sort()) {
    const entry = requireRecord(JSON.parse(await readFile(resolve(directory, file), 'utf8')), 'source entry');
    const identity = { id: requireString(entry.id, 'source id'), title: typeof entry.title === 'string' ? entry.title : requireString(entry.id, 'source id') };
    const urls = [...requireArray(entry.links ?? [], 'links').map(link => requireRecord(link, 'link').url),
      ...requireArray(entry.identifiers ?? [], 'identifiers').map(raw => { const identifier = requireRecord(raw, 'identifier'); return identifier.type === 'DOI' ? `https://doi.org/${identifier.value}` : identifier.type === 'arXiv' ? `https://arxiv.org/abs/${identifier.value}` : identifier.value; })];
    for (const url of urls) if (typeof url === 'string' && /^https?:\/\//.test(url) && !catalogueByUrl.has(normalUrl(url))) catalogueByUrl.set(normalUrl(url), identity);
  }
  return catalogueByUrl;
}

/** Cite a fact from a pinned project record when every number it states is a numeric field of one record that names a catalogued source. */
export function recordCitation(value: string, records: { path: string; leaves: ReturnType<typeof recordLeaves> }[], catalogue: Map<string, { id: string; title: string }>, bindingOf: (path: string) => string | null, label = ''): Citation | null {
  const stated = statedNumbers(value);
  for (const record of records) {
    const identity = (url: string | null) => { const byUrl = url ? catalogue.get(normalUrl(url)) : undefined; if (byUrl) return { ...byUrl, url: url! }; const bound = bindingOf(record.path); return bound ? { id: bound, title: bound, url: url ?? '' } : null; };
    if (stated.length) {
      if (stated.some(number => significantDigits(number.value, number.decimals) < 2)) continue;
      const used: typeof record.leaves = [], factors = conversionsFor(value);
      // Only numeric fields are evidence: a number quoted in prose, a URL or a name was written by the same hand as the fact.
      const ordered = record.leaves.filter(leaf => leaf.text === null && fieldMeasures(leaf.pointer, value, label));
      const found = stated.every(number => {
        const leaf = ordered.find(candidate => candidate.numbers.some(exact => factors.some(factor => Math.abs(number.value - exact * factor) <= 0.5 * 10 ** -number.decimals + 1e-9)));
        if (leaf) used.push(leaf);
        return leaf !== undefined;
      });
      const source = found ? identity(used.find(leaf => leaf.url)?.url ?? null) : null;
      if (found && source && source.url) return { url: source.url, label: source.title, checked: CHECKED, path: `source/${record.path}`, catalogueId: source.id, locator: [...new Set(used.map(leaf => leaf.pointer))].join('; ') };
    }
  }
  return null;
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

/** Declare a project-written document in the manifest when it is new. */
async function pinDocument(objectDirectory: string, path: string, reason: string, binding?: Record<string, unknown>) {
  const manifestPath = resolve(objectDirectory, 'source/manifest.json'), manifest = requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')), 'source manifest');
  const documents = requireArray(manifest.documents ?? [], 'manifest documents').map(value => requireRecord(value, 'manifest document'));
  if (documents.some(entry => entry.path === path)) return;
  documents.push({ path, sourceBinding: binding ?? { kind: 'local', reason } });
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
  // The body's own pinned project records: measurement, model and survey JSON that name their sources.
  const projectRecords: { path: string; leaves: ReturnType<typeof recordLeaves> }[] = [];
  const bindings = new Map<string, string>();
  for (const key of ['inputs', 'documents']) for (const raw of requireArray(manifest[key] ?? [], `manifest ${key}`)) {
    const entry = requireRecord(raw, 'manifest entry'), path = requireString(entry.path, 'manifest path'), binding = entry.sourceBinding;
    if (binding && typeof binding === 'object' && (binding as Record<string, unknown>).kind === 'catalogued') {
      const first = requireArray((binding as Record<string, unknown>).references, 'binding references')[0];
      if (first) bindings.set(path, requireString(requireRecord(first, 'binding reference').catalogueId, 'catalogue id'));
    }
    if (!path.endsWith('.json') || /^(preparation|presentation|content|editorial)\/|(^|\/)(sbdb|damit-model)\.json$/.test(path)) continue;
    const file = resolve(objectDirectory, 'source', path), size = await stat(file).then(info => info.size, () => null);
    if (size === null || size > 2_000_000) continue;
    projectRecords.push({ path, leaves: recordLeaves(JSON.parse(await readFile(file, 'utf8'))) });
  }
  const catalogue = projectRecords.length ? await sourceCatalogue(resolve(objectDirectory, '../../..')) : new Map();
  for (const fact of uncited) {
    const id = requireString(fact.id, 'fact id'), value = requireString(fact.value, 'fact value');
    const match = candidates(id, value, records).find(candidate => (candidate.text || displayedValue(value)) && matches(candidate, value));
    const citation = match?.citation ?? recordCitation(value, projectRecords, catalogue, path => bindings.get(path) ?? null, requireString(fact.label, 'fact label'));
    if (citation) { fact.source = citation; run.cited.push(id); }
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
    const run = await citePinnedFacts(resolve(import.meta.dirname, '../../src/objects', object.id), { write: !check, prune, fetchRecords, satelliteTables, classification: object.classification, name: object.name });
    if (run.cited.length || run.pruned.length || run.fetched.length) results[object.id] = run;
  }
  const total = (key: keyof CitationRun) => Object.values(results).reduce((sum, run) => sum + run[key].length, 0);
  console.log(JSON.stringify({ check, prune, objects: Object.keys(results).length, cited: total('cited'), pruned: total('pruned'), fetched: total('fetched'), results }));
  if (check && (total('cited') || total('pruned'))) process.exitCode = 1;
}
