/** Spacecraft images from the PDS Ring-Moon Systems Node's OPUS search, reported per target without downloading them. */
import { BODIES, BODY_IDS } from '@cssearth/astronomy';
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import type { TargetCatalogueEntry } from './targets.mts';

export const OPUS_SERVICE = 'https://opus.pds-rings.seti.org/api/';
export interface OpusImage {
  readonly instrument: string; readonly instrumentImages: number; readonly opusId: string; readonly startTime: string;
  /** Body-centre resolution as OPUS returns it; null when OPUS has no value for this image. */
  readonly centreResolutionKmPerPixel: number | null;
  /** Mean diameter from @cssearth/astronomy divided by the centre resolution. */
  readonly pixelsAcross: number | null;
}
export interface OpusService {
  readonly service: typeof OPUS_SERVICE;
  readonly state: 'sampled' | 'empty-in-scope' | 'unavailable' | 'unknown-target';
  readonly scope: string; readonly reason: string;
  readonly opusTarget?: string; readonly images?: number; readonly meanRadiusKm?: number | null;
  /** The sharpest image from each instrument, sharpest first. */
  readonly sharpest?: readonly OpusImage[];
}
export type OpusFetch = (path: string, parameters: Readonly<Record<string, string>>) => Promise<unknown>;

/** OPUS answers an invalid request with an HTML 404 page; that is a failed request, never an empty result. */
export const fetchOpus: OpusFetch = async (path, parameters) => {
  const url = new URL(path, OPUS_SERVICE); for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) }), text = await response.text();
  if (!response.ok || !/json/iu.test(response.headers.get('content-type') ?? '')) throw new Error(`${url.pathname} answered HTTP ${response.status} ${response.headers.get('content-type') ?? 'without a content type'}${opusMessage(text)}`);
  return JSON.parse(text) as unknown;
};
const opusMessage = (text: string) => { const message = /<div id="info">\s*<p>([^<]*)<\/p>/u.exec(text)?.[1]?.trim(); return message ? `: ${message}` : '.'; };

/** OPUS builds per-target column names from the target name without spaces or punctuation. */
const columnSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/gu, '');
const nameKey = (name: string) => name.trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
function counts(value: unknown, label: string): Map<string, number> {
  const mults = requireRecord(requireRecord(value, label).mults, `${label} mults`);
  return new Map(Object.entries(mults).map(([name, count]) => [name, requireFiniteNumber(count, `${label} ${name}`)]));
}
function sharpestRow(value: unknown, instrument: string, images: number, radiusKm: number | null): OpusImage {
  const answer = requireRecord(value, 'OPUS data'), page = requireArray(answer.page, 'OPUS data page');
  const row = requireArray(page[0], `OPUS ${instrument} row`);
  if (row.length !== 4) throw new TypeError(`OPUS ${instrument} row has ${row.length} columns, not 4.`);
  const raw = row[3], resolution = raw === null || raw === '' || raw === 'N/A' ? null : requireFiniteNumber(Number(requireString(raw, 'OPUS centre resolution')), 'OPUS centre resolution');
  return { instrument: requireString(row[1], 'OPUS instrument'), instrumentImages: images, opusId: requireString(row[0], 'OPUS id'), startTime: requireString(row[2], 'OPUS start time'),
    centreResolutionKmPerPixel: resolution, pixelsAcross: resolution === null || resolution <= 0 || radiusKm === null ? null : Math.round(20 * radiusKm / resolution) / 10 };
}
export function bodyMeanRadiusKm(id: string): number | null {
  const body = BODY_IDS.find(bodyId => bodyId === id); return body === undefined ? null : BODIES[body].meanRadiusKm;
}

/** One target list request, one per-instrument count request, then one sharpest-image request per instrument. */
export async function searchOpus(target: TargetCatalogueEntry, radiusKm: number | null = bodyMeanRadiusKm(target.id), request: OpusFetch = fetchOpus): Promise<OpusService> {
  const names = [target.name, ...target.aliases];
  const base = 'OPUS surface-geometry search: only images from PDS Ring-Moon Systems Node holdings for which OPUS computed this body\'s geometry. Explore filters are not applied, and other archives are not covered.';
  try {
    const targets = counts(await request('meta/mults/surfacegeometrytargetname.json', {}), 'OPUS target list');
    const opusTarget = names.map(nameKey).flatMap(name => [...targets.keys()].filter(key => nameKey(key) === name))[0];
    if (opusTarget === undefined) return { service: OPUS_SERVICE, state: 'unknown-target', scope: base,
      reason: `OPUS has no surface-geometry target named ${names.join(' or ')} among its ${targets.size} targets, so this search says nothing about whether images exist.` };
    const images = targets.get(opusTarget)!, scope = `${base} Reports the sharpest image per instrument by body-centre resolution.`;
    if (!images) return { service: OPUS_SERVICE, state: 'empty-in-scope', scope, reason: `OPUS lists ${opusTarget} with 0 images.`, opusTarget, images, meanRadiusKm: radiusKm };
    const column = `SURFACEGEO${columnSlug(opusTarget)}_centerresolution1`;
    const instruments = counts(await request('meta/mults/instrument.json', { surfacegeometrytargetname: opusTarget }), 'OPUS instrument counts');
    if (![...instruments.values()].some(count => count > 0)) return { service: OPUS_SERVICE, state: 'empty-in-scope', scope, reason: `OPUS counts no images of ${opusTarget} by any instrument.`, opusTarget, images: 0, meanRadiusKm: radiusKm };
    const sharpest: OpusImage[] = [];
    for (const [instrument, count] of [...instruments].filter(([, count]) => count > 0).sort(([a], [b]) => a.localeCompare(b))) {
      const answer = await request('data.json', { surfacegeometrytargetname: opusTarget, instrument, order: column, limit: '1', cols: `opusid,instrument,time1,${column}` });
      if (!isRecord(answer) || !Array.isArray(answer.page) || !answer.page.length) throw new TypeError(`OPUS returned no row for ${instrument}, which its counts list with ${count} images.`);
      sharpest.push(sharpestRow(answer, instrument, count, radiusKm));
    }
    sharpest.sort((a, b) => (a.centreResolutionKmPerPixel ?? Infinity) - (b.centreResolutionKmPerPixel ?? Infinity) || a.instrument.localeCompare(b.instrument));
    return { service: OPUS_SERVICE, state: 'sampled', scope, opusTarget, images, meanRadiusKm: radiusKm, sharpest,
      reason: `${images} images from ${sharpest.map(image => image.instrument).join(', ')}.${radiusKm === null ? ' No mean radius in @cssearth/astronomy, so pixels across are not computed.' : ''}` };
  } catch (error) {
    return { service: OPUS_SERVICE, state: 'unavailable', scope: base, reason: error instanceof Error ? error.message : String(error) };
  }
}
