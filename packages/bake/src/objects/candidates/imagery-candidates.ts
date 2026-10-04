/** Before wiring or re-registering a photograph dataset, find whether a public archive holds finer frames than the body ships
 * (`packages/bake/cli/imagery-candidates.mts` prints what these find).
 *
 * `--archives` searches the observatory archives OPUS does not index, for bodies seen from the ground or from Earth orbit: ALMA,
 * ESO raw frames, MAST (Hubble, JWST) by the names the body is observed under (its catalogue name and, for a numbered small
 * body, its JPL SBDB number and designations), and DataCite for data deposits citing the papers its sources and ledger already
 * cite. Name matches are substrings, so a short name can match unrelated targets; the output names what matched.
 *
 * One public service, read only: the PDS Rings Node's OPUS, which computes surface geometry for the bodies imaged by Voyager,
 * Galileo, Cassini, New Horizons and the other missions it indexes. For every catalogued body OPUS covers, its finest body-centre
 * resolution among images is set against the finest imagery the body already ships: a photograph dataset's finest cast frame, or a
 * natural-color or monochrome map dataset's native scale (their prepared reports).
 * The verdict is advisory: finer frames still need a camera, registration and reuse terms before they can ship. */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { requireArray, requireRecord } from '@cssearth/core';
import { almaObservations, archiveLeads, depositsCiting, esoRawObservations, fetchRetrying, mastObservations } from './archive-search.ts';

const OPUS = 'https://opus.pds-rings.seti.org/api';
/** The real checkout, found by the shared workspace-marker resolver from source and `dist/`. */
const ROOT = checkoutProjectRoot(import.meta.url);
/** A frame must be at least twice as fine as the shipped one to count as an upgrade: finer by less is within footprint and mesh error. */
export const UPGRADE_FACTOR = 2;

/** OPUS names a body's geometry fields SURFACEGEO<name>_centerresolution1; those names are the bodies it covers. */
export function opusTargets(fields: unknown): Set<string> {
  const names = new Set<string>();
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const match = key.match(/^SURFACEGEO([a-z0-9]+)_centerresolution1$/u);
      if (match) names.add(match[1]);
      else walk(child);
    }
  };
  walk(requireRecord(fields).data);
  return names;
}

/** The finest image frames of a body, finest body-centre resolution first. */
export const opusImagesUrl = (target: string, limit: number) => `${OPUS}/data.json?${new URLSearchParams({
  surfacegeometrytargetname: target, observationtype: 'Image', limit: String(limit),
  cols: `opusid,instrument,time1,SURFACEGEO${target}_centerresolution1,SURFACEGEO${target}_centerphaseangle1`,
  order: `SURFACEGEO${target}_centerresolution1,opusid` })}`;

export interface OpusFrame { readonly opusId: string; readonly instrument: string; readonly time: string; readonly centerKmPerPixel: number; readonly phaseDegrees: number | null }

/** OPUS pages rows as strings in the requested column order; a frame without a finite centre resolution is left out. */
export function parseOpusFrames(page: unknown): { available: number; frames: OpusFrame[] } {
  const record = requireRecord(page), frames: OpusFrame[] = [];
  for (const row of requireArray(record.page).map(value => requireArray(value))) {
    const [opusId, instrument, time, resolution, phase] = row, centerKmPerPixel = Number(resolution), phaseDegrees = Number(phase);
    if (typeof opusId !== 'string' || !(centerKmPerPixel > 0)) continue;
    frames.push({ opusId, instrument: String(instrument), time: String(time), centerKmPerPixel, phaseDegrees: phase === null || phase === '' || !Number.isFinite(phaseDegrees) ? null : phaseDegrees });
  }
  return { available: Number(record.available ?? frames.length), frames };
}

export interface ShippedImagery { readonly dataset: string; readonly kind: 'photograph' | 'map'; readonly source: string; readonly meters: number | null }

/** The finest imagery each dataset ships, finest first, from the body's prepared surfaces report: a photograph dataset's finest cast frame, or a
 * map dataset's native scale (its georeference, else its source width at the equator; null when the report states neither). False-color,
 * scientific and shape datasets are not imagery. */
export function shippedImagery(surfaces: unknown, radiusKm: number): ShippedImagery[] {
  const result: ShippedImagery[] = [];
  for (const dataset of requireArray(requireRecord(surfaces).surfaces).map(value => requireRecord(value))) {
    if (dataset.falseColor === true || dataset.scientific !== undefined || dataset.appearance !== undefined) continue;
    const id = String(dataset.id);
    if (dataset.observation !== undefined) {
      let finest: ShippedImagery | undefined;
      for (const frame of requireArray(requireRecord(dataset.observation).frames).map(value => requireRecord(value))) {
        const meters = Number(requireRecord(frame.footprint ?? {}).nadirMedianMeters);
        if (meters > 0 && (!finest || meters < (finest.meters ?? Infinity))) finest = { dataset: id, kind: 'photograph', source: String(frame.id), meters };
      }
      if (finest) result.push(finest);
      continue;
    }
    if (dataset.source === undefined || dataset.projection === undefined) continue;
    const source = requireRecord(dataset.source), resolution = dataset.sourceGeoreference === undefined ? undefined : requireRecord(dataset.sourceGeoreference).resolution;
    const meters = Array.isArray(resolution) ? Math.abs(Number(resolution[0])) : 2 * Math.PI * radiusKm * 1000 / Number(source.width);
    result.push({ dataset: id, kind: 'map', source: String(source.id), meters: meters > 0 && Number.isFinite(meters) ? meters : null });
  }
  return result.sort((a, b) => (a.meters ?? Infinity) - (b.meters ?? Infinity));
}

export type ImageryVerdict = 'too-small' | 'candidate' | 'finer-frames' | 'no-upgrade' | 'no-images' | 'shipped-unknown';

/** Too few pixels across the body decides first; a body that ships no imagery is a candidate; otherwise an upgrade needs a frame at least
 * UPGRADE_FACTOR finer than the finest shipped imagery. Pixels across is the diameter over the best frame's body-centre resolution; a close-up
 * frame may show only part of the body, so a finer frame is local detail, not necessarily a better global surface. */
export function imageryVerdict({ shippedMeters, opusKmPerPixel, diameterKm, minimumPixels, reported = true }: { shippedMeters: number | null; opusKmPerPixel: number | null; diameterKm: number; minimumPixels: number; reported?: boolean }): { verdict: ImageryVerdict; pixelsAcross: number | null; factor: number | null } {
  if (opusKmPerPixel === null) return { verdict: 'no-images', pixelsAcross: null, factor: null };
  const pixelsAcross = diameterKm / opusKmPerPixel, factor = shippedMeters === null ? null : shippedMeters / (opusKmPerPixel * 1000);
  if (pixelsAcross < minimumPixels) return { verdict: 'too-small', pixelsAcross, factor };
  // A body prepared by a route without a surfaces report may ship imagery this tool cannot read; it is not a candidate by absence.
  if (!reported) return { verdict: 'shipped-unknown', pixelsAcross, factor };
  if (shippedMeters === null) return { verdict: 'candidate', pixelsAcross, factor };
  return { verdict: factor !== null && factor >= UPGRADE_FACTOR ? 'finer-frames' : 'no-upgrade', pixelsAcross, factor };
}

async function json(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OPUS answered ${response.status} for ${url}.`);
  return response.json();
}

/** Every catalogued body OPUS covers, or the named ones, with its mean radius from the astronomy record. */
function bodies(ids: readonly string[], covered: ReadonlySet<string>) {
  const objects = resolve(ROOT, 'src/objects'), chosen = ids.length ? ids : readdirSync(objects).filter(id => covered.has(id));
  return chosen.map(id => {
    if (!covered.has(id)) throw new Error(`OPUS computes no surface geometry for ${id}.`);
    const recordPath = resolve(ROOT, 'packages/astronomy/data/bodies', `${id}.json`), surfacesPath = resolve(objects, id, 'prepared/surfaces.json');
    const physical = existsSync(recordPath) ? requireRecord(JSON.parse(readFileSync(recordPath, 'utf8'))).physical : undefined;
    const radiusKm = physical === undefined ? NaN : Number(requireRecord(physical).meanRadiusKm), reported = existsSync(surfacesPath);
    return { id, radiusKm, reported, shipped: reported && radiusKm > 0 ? shippedImagery(JSON.parse(readFileSync(surfacesPath, 'utf8')), radiusKm) : [] };
  });
}

export async function imageryCandidates(ids: readonly string[], { minimumPixels = 50 } = {}) {
  const covered = opusTargets(await json(`${OPUS}/fields.json`)), results = [], all = bodies(ids, covered);
  // A body with no mean radius cannot be judged for pixels across; it is named, not dropped.
  const skipped = all.filter(body => !(body.radiusKm > 0)).map(body => body.id);
  for (const body of all.filter(body => body.radiusKm > 0)) {
    const { available, frames } = parseOpusFrames(await json(opusImagesUrl(body.id, 3)));
    // Imagery whose scale the report does not state makes the comparison unknown, never a candidate.
    const best = frames[0] ?? null, finest = body.shipped.find(item => item.meters !== null) ?? null, scaled = body.shipped.every(item => item.meters !== null);
    results.push({ id: body.id, radiusKm: body.radiusKm, shipped: finest, opusImages: available, opusBest: best,
      ...imageryVerdict({ shippedMeters: finest?.meters ?? null, opusKmPerPixel: best?.centerKmPerPixel ?? null, diameterKm: 2 * body.radiusKm, minimumPixels, reported: body.reported && scaled }) });
  }
  const order: ImageryVerdict[] = ['finer-frames', 'candidate', 'shipped-unknown', 'no-upgrade', 'too-small', 'no-images'];
  results.sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || (b.factor ?? b.pixelsAcross ?? 0) - (a.factor ?? a.pixelsAcross ?? 0));
  return { results, skipped };
}

/** The names an archive may file a body under: its catalogue name, and for a numbered small body its number (four digits or more;
 * a shorter one matches too much) and designations from the SBDB full name, "136108 Haumea (2003 EL61)", with and without the space. */
export function bodyArchiveNames(catalogName: string, sbdbFullName: string | null = null) {
  const names = [catalogName.normalize('NFKD').replace(/\p{Lm}|[^\p{L}\p{N} -]/gu, '').trim()];
  const match = sbdbFullName?.match(/^\s*(\d+)\s+([^(]*?)\s*(?:\(([^)]+)\))?\s*$/u);
  if (match) {
    if (match[1]!.length >= 4) names.push(match[1]!);
    if (match[3]) names.push(match[3], match[3].replaceAll(' ', ''));
  }
  return [...new Set(names.filter(name => name.length >= 3))];
}

/** DOIs a body already cites: the catalogue records its manifest binds, and doi.org links in its investigation ledger. */
export function citedDois(manifest: unknown, records: ReadonlyMap<string, unknown>, ledger: unknown) {
  const dois = new Set<string>(), entries = requireRecord(manifest);
  for (const entry of [...requireArray(entries.inputs ?? []), ...requireArray(entries.documents ?? [])].map(value => requireRecord(value))) {
    const binding = entry.sourceBinding === undefined ? {} : requireRecord(entry.sourceBinding);
    for (const reference of requireArray(binding.references ?? []).map(value => requireRecord(value))) {
      const record = records.get(String(reference.catalogueId));
      if (record === undefined) continue;
      for (const identifier of requireArray(requireRecord(record).identifiers ?? []).map(value => requireRecord(value))) if (identifier.type === 'DOI') dois.add(String(identifier.value).toLowerCase());
    }
  }
  for (const text of JSON.stringify(ledger ?? {}).matchAll(/https:\/\/doi\.org\/(10\.[^"\s]+)/gu)) dois.add(text[1]!.toLowerCase());
  return [...dois].sort();
}

/** Archive leads for named bodies; a deposit the body already cites (or a version of one) is not a lead. */
export async function archiveCandidates(ids: readonly string[]) {
  if (!ids.length) throw new TypeError('--archives needs object ids: every body would send hundreds of archive queries.');
  const objects = resolve(ROOT, 'src/objects'), results = [];
  for (const id of ids) {
    const descriptor = requireRecord(JSON.parse(readFileSync(resolve(objects, id, 'object.json'), 'utf8')));
    const catalogName = String(requireRecord(requireRecord(requireRecord(descriptor.properties).catalog)).name);
    const recordPath = resolve(ROOT, 'packages/astronomy/data/bodies', `${id}.json`);
    const acquisition = existsSync(recordPath) ? requireRecord(JSON.parse(readFileSync(recordPath, 'utf8'))).acquisition : undefined;
    const target = acquisition === undefined || acquisition === null ? undefined : requireRecord(requireRecord(acquisition).heliocentric ?? {}).target;
    const number = typeof target === 'string' ? target.match(/^(\d+);$/u)?.[1] : undefined;
    const sbdb = number ? requireRecord(requireRecord(await (await fetchRetrying(`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${number}`)).json()).object) : null;
    const names = bodyArchiveNames(catalogName, sbdb ? String(sbdb.fullname) : null);
    const manifestPath = resolve(objects, id, 'source/manifest.json'), ledgerPath = resolve(objects, id, 'investigations.json');
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
    const records = new Map(readdirSync(resolve(ROOT, 'src/sources')).filter(name => name.endsWith('.json'))
      .map(name => [name.slice(0, -5), JSON.parse(readFileSync(resolve(ROOT, 'src/sources', name), 'utf8')) as unknown] as const));
    const cited = citedDois(manifest, records, existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : null);
    const body = { names };
    const [alma, eso, mast, found] = await Promise.all([almaObservations(body), esoRawObservations(body), mastObservations(body), depositsCiting(cited)]);
    const known = new Set(cited), deposits = found.filter(deposit => !known.has(deposit.doi.toLowerCase()) && !deposit.versions.some(version => known.has(version)));
    const archives = { alma, eso, mast, deposits };
    results.push({ id, names, citedDois: cited, archives, leads: archiveLeads(archives) });
  }
  return results;
}
