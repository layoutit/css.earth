#!/usr/bin/env node
/** Before wiring or re-registering a photograph lens, find whether a public archive holds finer frames than the body ships.
 *
 *   node tools/objects/imagery-candidates.mts [<object-id> ...] [--minimum-pixels 50] [--json]
 *
 * One public service, read only: the PDS Rings Node's OPUS, which computes surface geometry for the bodies imaged by Voyager,
 * Galileo, Cassini, New Horizons and the other missions it indexes. For every catalogued body OPUS covers, its finest body-centre
 * resolution among images is set against the finest imagery the body already ships: a photograph lens's finest cast frame, or a
 * natural-colour or monochrome map lens's native scale (their prepared reports).
 * The verdict is advisory: finer frames still need a camera, registration and reuse terms before they can ship. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord } from '../source-values.mts';

const OPUS = 'https://opus.pds-rings.seti.org/api';
const ROOT = resolve(import.meta.dirname, '../..');
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

export interface ShippedImagery { readonly lens: string; readonly kind: 'photograph' | 'map'; readonly source: string; readonly meters: number | null }

/** The finest imagery each lens ships, finest first, from the body's prepared surfaces report: a photograph lens's finest cast frame, or a
 * map lens's native scale (its georeference, else its source width at the equator; null when the report states neither). False-colour,
 * scientific and shape lenses are not imagery. */
export function shippedImagery(surfaces: unknown, radiusKm: number): ShippedImagery[] {
  const result: ShippedImagery[] = [];
  for (const lens of requireArray(requireRecord(surfaces).surfaces).map(value => requireRecord(value))) {
    if (lens.falseColor === true || lens.scientific !== undefined || lens.appearance !== undefined) continue;
    const id = String(lens.id);
    if (lens.observation !== undefined) {
      let finest: ShippedImagery | undefined;
      for (const frame of requireArray(requireRecord(lens.observation).frames).map(value => requireRecord(value))) {
        const meters = Number(requireRecord(frame.footprint ?? {}).nadirMedianMeters);
        if (meters > 0 && (!finest || meters < (finest.meters ?? Infinity))) finest = { lens: id, kind: 'photograph', source: String(frame.id), meters };
      }
      if (finest) result.push(finest);
      continue;
    }
    if (lens.source === undefined || lens.projection === undefined) continue;
    const source = requireRecord(lens.source), resolution = lens.sourceGeoreference === undefined ? undefined : requireRecord(lens.sourceGeoreference).resolution;
    const meters = Array.isArray(resolution) ? Math.abs(Number(resolution[0])) : 2 * Math.PI * radiusKm * 1000 / Number(source.width);
    result.push({ lens: id, kind: 'map', source: String(source.id), meters: meters > 0 && Number.isFinite(meters) ? meters : null });
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), minimumIndex = args.indexOf('--minimum-pixels');
  const ids = args.filter((argument, index) => !argument.startsWith('--') && (minimumIndex < 0 || index !== minimumIndex + 1));
  const { results, skipped } = await imageryCandidates(ids, { minimumPixels: minimumIndex >= 0 ? Number(args[minimumIndex + 1]) : 50 });
  if (args.includes('--json')) { console.log(JSON.stringify({ results, skipped }, null, 2)); process.exit(0); }
  const km = (value: number | null | undefined) => value === null || value === undefined ? '—' : value < 1 ? `${(value * 1000).toFixed(0)} m` : `${value.toFixed(2)} km`;
  for (const result of results) {
    const shipped = result.verdict === 'shipped-unknown' ? 'unknown (no surfaces report, or imagery without a stated scale)'
      : result.shipped?.meters ? `${km(result.shipped.meters / 1000)} (${result.shipped.kind} ${result.shipped.lens})` : 'no imagery lens';
    const best = result.opusBest ? `${km(result.opusBest.centerKmPerPixel)} ${result.opusBest.instrument} ${result.opusBest.opusId}${result.opusBest.phaseDegrees === null ? '' : ` at ${result.opusBest.phaseDegrees.toFixed(0)}°`}` : '—';
    console.log(`${result.verdict.padEnd(12)} ${result.id.padEnd(12)} shipped ${shipped}; OPUS best ${best}; ${result.pixelsAcross === null ? '' : `diameter ${result.pixelsAcross.toFixed(0)} px; `}${result.factor === null ? '' : `${result.factor.toFixed(1)}× finer; `}${result.opusImages} images`);
  }
  if (skipped.length) console.log(`skipped (no mean radius in packages/astronomy/data/bodies): ${skipped.join(', ')}`);
}
