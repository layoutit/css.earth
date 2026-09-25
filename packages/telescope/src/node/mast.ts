/** Shared MAST boundary. Astroquery owns the service protocol and downloads; cssEarth validates returned identities and bytes. */
import { access, mkdir, rm, stat, symlink, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WORKSPACE } from './paths.js';
import { sha256, sha256File } from '@cssearth/core/node';
import { requireArray, requireFiniteNumber, requireRecord, requireString, hasErrorCode } from '@cssearth/core';
import { astroquery } from './astroquery.js';

export const MAST_CACHE = resolve(WORKSPACE, 'output/archive-cache/mast');
export const mastDownloadUrl = (uri: string) => `https://mast.stsci.edu/api/v0.1/Download/file?uri=${uri}`;
export interface MastFile { readonly name: string; readonly uri: string; readonly bytes: number; readonly sha256?: string }

const sizeOf = (path: string) => stat(path).then(info => info.size, () => -1);
export const exists = (path: string) => access(path).then(() => true, () => false);

/** Download one MAST URI through Astroquery, then enforce cssEarth's byte pin. */
export async function mastFile(file: MastFile, directory: string, sources: readonly string[] = []): Promise<string> {
  if (!/^[A-Za-z0-9._-]+$/u.test(file.name)) throw new TypeError(`Invalid MAST file name: ${file.name}`);
  await mkdir(directory, { recursive: true });
  const target = resolve(directory, file.name);
  if (await sizeOf(target) !== file.bytes) for (const source of sources) {
    const candidate = resolve(source, file.name);
    if (await sizeOf(candidate) === file.bytes) { await rm(target, { force: true }); await symlink(candidate, target); break; }
  }
  if (await sizeOf(target) !== file.bytes) {
    await rm(target, { force: true });
    await astroquery({ operation: 'mast-download', uri: file.uri, destination: target });
  }
  if (await sizeOf(target) !== file.bytes) throw new Error(`${file.name} did not download to its pinned ${file.bytes} bytes.`);
  if (file.sha256 !== undefined && (await sha256File(target)).sha256 !== file.sha256) throw new Error(`${file.name} differs from its pinned sha256.`);
  return target;
}

export interface MastServiceRequest { readonly service: string; readonly params: Readonly<Record<string, unknown>>; readonly pagesize?: number; readonly page?: number }
export interface MastResponsePin { readonly path: string; readonly sha256: string }
export interface MastServiceResult { readonly astroquery: string; readonly queriedAt: string; readonly rows: readonly Record<string, unknown>[]; readonly responseRecord?: MastResponsePin }

export async function preserveMastResponse(request: MastServiceRequest, result: MastServiceResult, directory = resolve(MAST_CACHE, 'responses')): Promise<MastServiceResult> {
  const text = `${JSON.stringify({ schema: 'cssearth-mast-response@1', request, response: result }, null, 2)}\n`, digest = sha256(text), path = resolve(directory, `${digest}.json`);
  await mkdir(directory, { recursive: true });
  await writeFile(path, text, { flag: 'wx' }).catch(async (error: unknown) => { if (!hasErrorCode(error, 'EEXIST') || sha256(await readFile(path)) !== digest) throw error; });
  return { ...result, responseRecord: { path, sha256: digest } };
}
/** Explicit replay only. A live failure never silently switches to an older response. */
export async function replayMastResponse(pin: MastResponsePin, request: MastServiceRequest): Promise<MastServiceResult> {
  const text = await readFile(pin.path, 'utf8'); if (sha256(text) !== pin.sha256) throw new Error('MAST response digest mismatch.');
  const record = requireRecord(JSON.parse(text), 'MAST response record');
  if (record.schema !== 'cssearth-mast-response@1' || JSON.stringify(record.request) !== JSON.stringify(request)) throw new Error('MAST response belongs to a different request.');
  const response = requireRecord(record.response);
  return { astroquery: requireString(response.astroquery), queriedAt: requireString(response.queriedAt), rows: requireArray(response.rows).map(row => requireRecord(row)), responseRecord: pin };
}

/** One typed MAST service request through the pinned Astroquery process. */
export async function mastService(request: MastServiceRequest, now = () => new Date()): Promise<MastServiceResult> {
  const service = requireString(request.service, 'MAST service'), parameters = requireRecord(request.params, 'MAST parameters');
  const pagesize = request.pagesize, page = request.page;
  if (pagesize !== undefined && (!Number.isSafeInteger(pagesize) || pagesize <= 0)) throw new TypeError('MAST pagesize must be a positive integer.');
  if (page !== undefined && (!Number.isSafeInteger(page) || page <= 0)) throw new TypeError('MAST page must be a positive integer.');
  const answer = await astroquery({ operation: 'mast-service', service, parameters, ...(pagesize === undefined ? {} : { pagesize }), ...(page === undefined ? {} : { page }) });
  return preserveMastResponse(request, { astroquery: answer.astroquery, queriedAt: now().toISOString(), rows: answer.rows! });
}

/** Compatibility view for callers that only need rows. */
export async function mastRequest(request: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const row = requireRecord(request, 'MAST request');
  return [...(await mastService({ service: requireString(row.service, 'MAST service'), params: requireRecord(row.params, 'MAST parameters'),
    ...(row.pagesize === undefined ? {} : { pagesize: requireFiniteNumber(row.pagesize, 'MAST pagesize') }),
    ...(row.page === undefined ? {} : { page: requireFiniteNumber(row.page, 'MAST page') }) })).rows];
}

export interface MastObservation {
  readonly id: string; readonly collection: string; readonly archiveTarget: string; readonly programme: string; readonly mode: string;
  readonly startIso: string; readonly endIso: string; readonly filter?: string;
}
export interface MastObservationResult { readonly astroquery: string; readonly queriedAt: string; readonly observations: readonly MastObservation[]; readonly responseRecord?: MastResponsePin }
const MJD_UNIX_EPOCH = 40_587;
const mjdIso = (value: unknown, label: string) => new Date((requireFiniteNumber(value, label) - MJD_UNIX_EPOCH) * 86_400_000).toISOString();
const text = (value: unknown, label: string) => typeof value === 'number' ? String(value) : requireString(value, label);

/** Turn an exact MAST response into observations. Missing, duplicate and extra rows are errors, never empty scientific results. */
export function parseMastObservations(collection: string, ids: readonly string[], result: MastServiceResult): MastObservationResult {
  if (!ids.length || new Set(ids).size !== ids.length) throw new TypeError('A MAST observation request names unique ids.');
  const expected = new Set(ids), seen = new Set<string>();
  const observations = result.rows.map(row => {
    const id = requireString(row.obs_id, 'MAST observation id');
    if (!expected.has(id)) throw new TypeError(`MAST returned unrequested observation ${id}.`);
    if (seen.has(id)) throw new TypeError(`MAST returned observation ${id} twice.`);
    seen.add(id);
    const actualCollection = requireString(row.obs_collection, `${id} collection`);
    if (actualCollection !== collection) throw new TypeError(`${id}: MAST collection is ${actualCollection}, requested ${collection}.`);
    const filter = row.filters === null || row.filters === undefined || row.filters === '' ? undefined : requireString(row.filters, `${id} filter`);
    return { id, collection, archiveTarget: requireString(row.target_name, `${id} target`), programme: text(row.proposal_id, `${id} programme`),
      mode: requireString(row.instrument_name, `${id} mode`), startIso: mjdIso(row.t_min, `${id} start`), endIso: mjdIso(row.t_max, `${id} end`), ...(filter ? { filter } : {}) };
  });
  for (const id of ids) if (!seen.has(id)) throw new Error(`MAST did not return requested observation ${id}.`);
  return { astroquery: result.astroquery, queriedAt: result.queriedAt, observations, ...(result.responseRecord ? { responseRecord: result.responseRecord } : {}) };
}

/** Fetch exact public observation identities through Astroquery's MAST client. */
export async function mastObservations(collection: string, ids: readonly string[]): Promise<MastObservationResult> {
  if (!ids.length || new Set(ids).size !== ids.length) throw new TypeError('A MAST observation request names unique ids.');
  const result = await mastService({ service: 'Mast.Caom.Filtered', pagesize: ids.length + 1, page: 1, params: {
    columns: 'obs_collection,obs_id,target_name,proposal_id,instrument_name,filters,t_min,t_max',
    filters: [{ paramName: 'obs_collection', values: [collection] }, { paramName: 'dataRights', values: ['PUBLIC'] }, { paramName: 'obs_id', values: ids }],
  } });
  return parseMastObservations(collection, ids, result);
}
