import { open } from 'node:fs/promises';
import { hasErrorCode, requireArray, requireRecord } from '@cssearth/core';
import type { ExplorationChoice, ExplorationRequest } from '../exploration.mts';
import { METADATA_BYTES, ESO_BYTES, NO_PREVIEW, type PreviewSource } from './types.mts';
import { previewVotable } from './votable.mts';

export type PreviewChoice = Pick<ExplorationChoice, 'pick' | 'observation' | 'reference' | 'display' | 'telescope'>;
export interface PreviewSession { readonly answer: { readonly request: Pick<ExplorationRequest, 'skyTarget' | 'region' | 'footprint'> } }

/** A bounded local read is also used for cached data. No archive file is written by previews. */
export async function readPreviewFile(path: string, maximum: number): Promise<string> {
  const file = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(maximum + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = await file.read(bytes, length, bytes.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length > maximum) throw new Error('Preview record exceeds its byte limit.');
    return bytes.toString('utf8', 0, length);
  } finally { await file.close(); }
}

function observationIdentity(observation: string): Record<string, string> {
  if (!observation.startsWith('{')) return { obs_id: observation };
  const value = requireRecord(JSON.parse(observation), 'preview observation identity');
  const columns = requireArray(value.identityColumns), identity = requireArray(value.identity);
  if (columns.length !== identity.length || columns.some(column => typeof column !== 'string') || identity.some(cell => typeof cell !== 'string'))
    throw new Error('Invalid preview observation identity.');
  return Object.fromEntries(columns.map((column, i) => [String(column), String(identity[i])]));
}

async function snapshotRow(choice: PreviewChoice, identity: Record<string, string>): Promise<Record<string, unknown>> {
  if (choice.reference.kind !== 'vo-acquisition') return identity;
  let text: string;
  try { text = await readPreviewFile(choice.reference.snapshot, METADATA_BYTES); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) return identity; throw error; }
  const rows = text.trimStart().startsWith('{')
    ? requireArray(requireRecord(requireRecord(JSON.parse(text)).response).rows).map(row => requireRecord(row))
    : previewVotable(text).rows;
  const matches = rows.filter(row => Object.entries(identity).every(([key, value]) => String(row[key] ?? '') === value));
  if (matches.length !== 1) throw new Error('Preview snapshot does not uniquely identify the saved observation.');
  return { ...matches[0], ...identity };
}

/** Resolve only from saved evidence. Network discovery stays inside fetchPreview, after its offline cache check. */
export async function previewSource(choice: PreviewChoice, session: PreviewSession): Promise<PreviewSource> {
  if (!Number.isSafeInteger(choice.pick) || choice.pick < 1) throw new Error('Invalid preview pick.');
  const base = { pick: choice.pick, observation: choice.observation };
  const none = (reason = NO_PREVIEW): PreviewSource => ({ ...base, kind: 'none', reason });
  const identity = observationIdentity(choice.observation);
  const publisher = identity.obs_publisher_did ?? '';
  // Unsupported archives do not need their local discovery file to explain that no preview exists.
  if (!publisher.startsWith('ivo://eso.org/ID?ADP.') && !identity.obs_id?.startsWith('uid://') && choice.telescope.toUpperCase() !== 'HST') return none();
  const row = await snapshotRow(choice, identity);
  const obsId = typeof row.obs_id === 'string' ? row.obs_id : '';
  if (choice.telescope.toUpperCase() === 'HST') return obsId ? { ...base, kind: 'hst', obsId } : none();
  if (publisher.startsWith('ivo://eso.org/ID?ADP.')) {
    const size = choice.display.advertisedKilobytes, product = choice.display.productKind;
    if (size === null || !Number.isFinite(size) || size < 0) return none('the archive has not advertised a preview size');
    if (size * 1024 > ESO_BYTES) return none('the archive file is too large for a preview');
    if (product !== 'spectrum' && product !== 'image') return none();
    return { ...base, kind: 'eso', url: `https://dataportal.eso.org/dataPortal/file/${encodeURIComponent(publisher.slice('ivo://eso.org/ID?'.length))}`,
      product, instrument: choice.display.instrument };
  }
  const member = /^(uid:\/\/[^/]+\/[^/]+\/[^.]+)(?:\.source\.|$)/u.exec(obsId)?.[1];
  if (!member) return none();
  const sky = session.answer.request.skyTarget, region = session.answer.request.region ?? session.answer.request.footprint;
  const numeric = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  const ra = sky?.raDegrees ?? region?.raDegrees ?? numeric(row.s_ra), dec = sky?.decDegrees ?? region?.decDegrees ?? numeric(row.s_dec);
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || ra < 0 || ra >= 360 || Math.abs(dec) > 90) return none('the saved observation has no preview position');
  const target = /\.source\.(.+?)\.spw\.\d+$/u.exec(obsId)?.[1] ?? (typeof row.target_name === 'string' ? row.target_name : '');
  if (!target) return none('the saved observation has no preview target');
  const spw = /\.spw\.(\d+)$/u.exec(obsId)?.[1];
  return { ...base, kind: 'alma', member, target, ra, dec, ...(spw === undefined ? {} : { spw: Number(spw) }) };
}
