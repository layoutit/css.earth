import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENE_OBJECTS } from '../site/objects.mts';
import { hasErrorCode, requireArray, requireRecord, requireString } from './source-values.mts';

/**
 * Cite an uncited factsheet value from the body's pinned JPL Horizons record when the displayed value equals the
 * record at the displayed precision. A value that differs, even in the last digit, came from somewhere else and is
 * left for its author to cite.
 */
const AU_KM = 149597870.7, DAYS_PER_YEAR = 365.25, CHECKED = '2026-09-16';
const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

export interface Citation { url: string; label: string; checked: string; path: string; catalogueId: string; locator: string }
interface Candidate { value: number; citation: Citation }
interface Displayed { value: number; decimals: number; unit: 'au' | 'year' | 'day' | 'hour' | 'km' }

/** The first number in a fact value and the unit word beside it; `About 129,000 km` reads as 129000 km with 0 decimals. */
export function displayedValue(text: string): Displayed | null {
  const number = /-?\d[\d,]*(?:\.\d+)?/.exec(text), unit = /\b(AU|years?|days?|hours?|km)\b/i.exec(text);
  if (!number || !unit) return null;
  const digits = number[0].replaceAll(',', ''), fraction = digits.split('.')[1] ?? '';
  const word = unit[1].toLowerCase().replace(/s$/, '');
  return { value: Number(digits), decimals: fraction.length, unit: word === 'au' ? 'au' : word as Displayed['unit'] };
}

export const equalAtDisplayedPrecision = (shown: Displayed, exact: number) => Math.abs(shown.value - exact) <= 0.5 * 10 ** -shown.decimals + 1e-9;

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

const optional = (path: string) => readFile(path, 'utf8').catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });

/** Candidate citations for one uncited fact, each with the exact value the pinned record gives. */
export function candidates(factId: string, shown: Displayed, records: { elements?: ReturnType<typeof parseHorizonsElements>; physical?: ReturnType<typeof parseHorizonsPhysical> | null }): Candidate[] {
  const out: Candidate[] = [];
  const elements = records.elements;
  if (elements) {
    const cite = (locator: string): Citation => ({ url: elements.url, label: `JPL Horizons, ${elements.epoch} epoch`, checked: CHECKED, path: 'source/reference/horizons-elements.txt', catalogueId: 'jpl-horizons', locator: `$$SOE first epoch; ${locator}` });
    if (factId === 'distance-from-sun' && shown.unit === 'au') out.push({ value: elements.semimajorAxisAu, citation: cite('A (km) / 149597870.7') });
    if (factId === 'perihelion' && shown.unit === 'au') out.push({ value: elements.perihelionAu, citation: cite('QR (km) / 149597870.7') });
    if (factId === 'orbital-period' && shown.unit === 'year') out.push({ value: elements.periodDays / DAYS_PER_YEAR, citation: cite('PR (days) / 365.25') });
    if (factId === 'orbital-period' && shown.unit === 'day') out.push({ value: elements.periodDays, citation: cite('PR (days)') });
  }
  const physical = records.physical;
  if (physical) {
    const cite = (locator: string): Citation => ({ url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html', label: 'JPL Horizons pinned physical record', checked: CHECKED, path: 'source/reference/horizons-physical.txt', catalogueId: 'jpl-small-body-database', locator: `Target physical data: ${locator}` });
    if (factId === 'radius' && shown.unit === 'km' && physical.radiusKm !== null) out.push({ value: physical.radiusKm, citation: cite('RAD (km)') });
    if (factId === 'rotation-period' && shown.unit === 'hour' && physical.rotationHours !== null) out.push({ value: physical.rotationHours, citation: cite('ROTPER (h)') });
  }
  return out;
}

/** Add citations to one body's authored facts; returns the fact ids cited. Nothing is written in check mode. */
export async function citePinnedFacts(objectDirectory: string, { write = true } = {}): Promise<string[]> {
  const contentPath = resolve(objectDirectory, 'source/content/object.json'), text = await optional(contentPath);
  if (!text) return [];
  const content = requireRecord(JSON.parse(text), 'object content'), panel = content.panel;
  if (panel === undefined) return [];
  const manifest = requireRecord(JSON.parse(await readFile(resolve(objectDirectory, 'source/manifest.json'), 'utf8')), 'source manifest');
  const pinned = new Set(['inputs', 'documents'].flatMap(key => requireArray(manifest[key] ?? [], `manifest ${key}`).map(entry => `source/${requireString(requireRecord(entry, 'manifest entry').path, 'manifest path')}`)));
  const read = async (path: string) => pinned.has(path) ? optional(resolve(objectDirectory, path)) : null;
  const elementsText = await read('source/reference/horizons-elements.txt'), physicalText = await read('source/reference/horizons-physical.txt');
  const records = { elements: elementsText ? parseHorizonsElements(elementsText) : null, physical: physicalText ? parseHorizonsPhysical(physicalText) : null };
  if (!records.elements && !records.physical) return [];
  const cited: string[] = [];
  for (const group of ['facts', 'moreFacts']) {
    for (const raw of requireArray(requireRecord(panel, 'factsheet panel')[group] ?? [], `panel ${group}`)) {
      const fact = requireRecord(raw, 'fact');
      if (fact.source !== undefined) continue;
      const shown = displayedValue(requireString(fact.value, 'fact value'));
      if (!shown) continue;
      const match = candidates(requireString(fact.id, 'fact id'), shown, records).find(candidate => equalAtDisplayedPrecision(shown, candidate.value));
      if (!match) continue;
      fact.source = match.citation;
      cited.push(requireString(fact.id, 'fact id'));
    }
  }
  if (cited.length && write) await writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`);
  return cited;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const check = process.argv.includes('--check');
  const ids = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
  assert.ok(ids.every(id => SCENE_OBJECTS.some(object => object.id === id)), 'Unregistered factsheet target');
  const results: Record<string, string[]> = {};
  for (const object of SCENE_OBJECTS) if (!ids.length || ids.includes(object.id)) {
    const cited = await citePinnedFacts(resolve(import.meta.dirname, '../src/objects', object.id), { write: !check });
    if (cited.length) results[object.id] = cited;
  }
  const facts = Object.values(results).reduce((sum, ids) => sum + ids.length, 0);
  console.log(JSON.stringify({ check, objects: Object.keys(results).length, facts, results }));
  if (check && facts) process.exitCode = 1;
}
