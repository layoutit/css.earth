/** Download one OPUS observation's native PDS image with its label and support files. */
import { readFile } from 'node:fs/promises';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { OPUS_SERVICE, fetchOpus, type OpusFetch } from './opus.mts';
import { deliverSource, type SavedSource, type SourceFile } from './archive-source.mts';
import { EXPLORATION_SCHEMA } from './exploration.mts';
import { parseLimits } from './vo/contracts.mts';

const OPUS_ID = /^[a-z0-9][a-z0-9_-]{2,100}$/u;
const FILE_ROOT = 'https://opus.pds-rings.seti.org/holdings/';
/** OPUS product types are archive-defined; prefer its raw group without assuming a particular mission prefix. */
export function opusNativeFiles(value: unknown, opusId: string, maximumMembers: number): { productType: string; files: SourceFile[] } {
  const answer = requireRecord(value, 'OPUS file list'), data = requireRecord(answer.data, 'OPUS current file versions');
  const groups = requireRecord(data[opusId], `OPUS ${opusId} files`);
  const candidates = Object.entries(groups).sort(([a], [b]) => Number(/_raw$/iu.test(b)) - Number(/_raw$/iu.test(a)) || a.localeCompare(b));
  for (const [productType, raw] of candidates) {
    const urls = requireArray(raw, `OPUS ${productType} files`).map(value => requireString(value, 'OPUS source URL'));
    const files = urls.map(url => {
      const parsed = new URL(url);
      if (!url.startsWith(FILE_ROOT) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new TypeError(`Unsafe OPUS file URL ${url}.`);
      const path = decodeURIComponent(parsed.pathname.slice(1));
      const parts = path.split('/'), name = parts.at(-1) ?? '';
      if (!parts.every(part => /^[A-Za-z0-9._-]+$/u.test(part) && part !== '.' && part !== '..'))
        throw new TypeError(`Unsafe OPUS file path ${path}.`);
      return { url, name, path };
    });
    if (files.length > maximumMembers || new Set(files.map(file => file.path)).size !== files.length) continue;
    const names = files.map(file => file.name);
    const science = names.some(name => /\.(?:img|fits?)$/iu.test(name));
    const label = names.some(name => /\.(?:lbl|xml)$/iu.test(name));
    if (science && label) return { productType, files };
  }
  throw new Error(`OPUS lists no bounded native image-and-label product for ${opusId}.`);
}

export async function fetchOpusSource(explorationPath: string, pick: number, outputDirectory: string,
  query: OpusFetch = fetchOpus, fetcher: typeof fetch = fetch, resume = false) {
  if (!Number.isSafeInteger(pick) || pick < 1) throw new TypeError('--pick must be a positive OPUS source number.');
  const bytes = await readFile(explorationPath), session = requireRecord(JSON.parse(bytes.toString('utf8')), 'saved exploration');
  if (session.schema !== EXPLORATION_SCHEMA) throw new TypeError('Expected a saved Telescope exploration.');
  const answer = requireRecord(session.answer, 'saved answer'), request = requireRecord(answer.request, 'saved request');
  const target = requireString(session.target, 'saved target');
  if (answer.target !== target || request.target !== target) throw new TypeError('Saved exploration target identity disagrees.');
  const services = requireArray(answer.services, 'saved services').map(value => requireRecord(value, 'saved service'));
  const opus = services.filter(value => value.service === OPUS_SERVICE);
  if (opus.length !== 1 || opus[0]!.state !== 'sampled') throw new TypeError('Saved exploration has no sampled OPUS source.');
  const sharpest = requireArray(opus[0]!.sharpest, 'OPUS source list');
  if (pick > sharpest.length) throw new TypeError(`--pick must be between 1 and ${sharpest.length}.`);
  const selected = requireRecord(sharpest[pick - 1], 'OPUS source'), opusId = requireString(selected.opusId, 'OPUS ID');
  if (!OPUS_ID.test(opusId)) throw new TypeError('Saved OPUS ID is invalid.');
  const limits = parseLimits(request.transferLimits), listing = await query(`files/${opusId}.json`, {});
  const native = opusNativeFiles(listing, opusId, limits.packageMembers);
  const saved: SavedSource = { bytes, target, selected, evidence: Buffer.from(`${JSON.stringify(opus[0], null, 2)}\n`), maximum: limits.scienceBytes };
  const fits = native.files.filter(file => /\.fits?$/iu.test(file.name));
  return deliverSource(explorationPath, outputDirectory, saved, {
    archive: OPUS_SERVICE, telescope: requireString(selected.instrument, 'OPUS instrument'), identity: opusId, target,
    discovery: { opusTarget: opus[0]!.opusTarget, image: selected, productType: native.productType }, current: { productType: native.productType, listing }, files: native.files,
    ...(fits.length===1?{primaryFits:fits[0]!.path}:{}),
    limitations: ['OPUS geometry and target tags identify a candidate, not confirmed target detection.',
      'Native PDS bytes and labels are preserved; no calibration, units or fitness is inferred from the OPUS listing.'],
  }, fetcher, resume);
}
