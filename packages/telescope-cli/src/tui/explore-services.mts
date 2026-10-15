import { readdir, stat, statfs } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { hasErrorCode, requireArray, requireRecord } from '@cssearth/core';
import { withDownloadProgress, withTransferConsent } from '@cssearth/telescope-core/node';
import type { CliServices } from '../cli-services.mts';
import type { CliIo } from '../cli-io.mts';
import { consentHandler, type ConsentState } from '../cli-consent.mts';
import { parseCli } from '../cli-arguments.mts';
import type { ExplorationChoice } from '../exploration.mts';
import { skyTargetRequest } from '../exploration.mts';
import { loadTargetCatalogue } from '../observation-query/query.mts';
import { fetchPreview, previewSource } from '../previews/index.mts';
import { previewVotable } from '../previews/votable.mts';
import { almaCubeUrl, matchesAlmaCube } from '../vo/alma-cube.mts';
import { voUrl } from '../vo/network-policy.mts';
import { exportHtml } from '../delivery/html-outputs.mts';
import { delivery } from '../delivery/outputs.mts';
import { localOutput, verifiedProduct } from '../products/verified-product.mts';
import { openExternal } from './open.mts';
import { cubeBand, cubePeakAperture } from './cube-output.mts';
import type { PickStatus } from './explore-render.mts';
import type { ExploreOutput, ExploreServices, SavedExploration } from './explore.mts';

/** The delivery record and its pinned files, not a UI receipt, establish completion. */
export async function explorationPickStatuses(session: SavedExploration): Promise<ReadonlyMap<number, PickStatus>> {
  const statuses = new Map<number, PickStatus>();
  for (const choice of session.choices) {
    const resultPath = resolve(session.directory, `pick-${choice.pick}`, 'result.json');
    const exists = await stat(resultPath).then(() => true).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return false; throw error; });
    if (exists) {
      const result = await delivery(resultPath);
      statuses.set(choice.pick, { state: 'done', resultPath, bytes: result.product.bytes }); continue;
    }
    const bytes = await partialDownloadBytes(resolve(session.directory, '.work', `pick-${choice.pick}`)) + await partialDownloadBytes(resolve(session.directory, `pick-${choice.pick}`));
    if (bytes > 0) statuses.set(choice.pick, { state: 'partial', bytes });
  }
  return statuses;
}
async function partialDownloadBytes(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: unknown) => {
    if (hasErrorCode(error, 'ENOENT')) return []; throw error;
  });
  let bytes = 0;
  const packagePresent = entries.some(entry => entry.isFile() && /^archive\.(?:tar|zip)(?:\.download\.partial)?$/u.test(entry.name));
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) bytes += await partialDownloadBytes(path);
    else if (!(packagePresent && entry.name.startsWith('science.fits')) && entry.isFile() && (entry.name.endsWith('.download.partial') || /^(?:science\.fits|archive\.(?:tar|zip))$/u.test(entry.name))) bytes += (await stat(path)).size;
  }
  return bytes;
}
export async function explorationFreeBytes(directory: string): Promise<number> {
  for (let path = resolve(directory); ;) {
    try { const { bavail, bsize } = await statfs(path); return bavail * bsize; }
    catch (error) { if (!hasErrorCode(error, 'ENOENT') || dirname(path) === path) throw error; path = dirname(path); }
  }
}

/** Size and scope of the full file selected by access planning, never a preview cutout. */
export async function explorationDownloadSize(choice: Pick<ExplorationChoice, 'display' | 'observation' | 'reference'>, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<number | null | { readonly bytes: number | null; readonly singleCube: true }> {
  const cube = choice.reference.kind === 'vo-acquisition' && choice.display.productKind === 'cube';
  if (!cube && choice.display.advertisedKilobytes !== null) return choice.display.advertisedKilobytes * 1000;
  let identity: string = choice.observation;
  if (identity.startsWith('{')) {
    const record = requireRecord(JSON.parse(identity)), columns = requireArray(record.identityColumns), values = requireArray(record.identity);
    const index = columns.indexOf('obs_id'); identity = typeof values[index] === 'string' ? values[index] : '';
  }
  const member = /^(uid:\/\/[^/]+\/[^/]+\/[^.]+)(?:\.source\.|$)/u.exec(identity)?.[1];
  if (!member) return choice.display.advertisedKilobytes === null ? null : choice.display.advertisedKilobytes * 1000;
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  let metadataBytes = 0;
  const load = async (url: string) => {
    const response = await fetcher(voUrl(url, url), { signal: deadline, redirect: 'error' });
    if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('ALMA metadata unavailable.'); }
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        metadataBytes += chunk.value.length; if (metadataBytes > 2 * 1024 * 1024) throw new Error('ALMA size metadata exceeds its byte limit.');
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    return previewVotable(Buffer.concat(chunks).toString('utf8'));
  };
  try {
    const root = await load(`https://almascience.org/datalink/sync?ID=${encodeURIComponent(member)}`);
    const ownCube = (links: ReturnType<typeof previewVotable>) => links.rows.find(row => {
      if (row.error_message || !['#this', '#cutout', '#proc'].some(semantics => row.semantics?.endsWith(semantics)) || !['image/fits', 'application/fits'].includes(row.content_type ?? '')) return false;
      const service = links.services.find(service => service.id === row.service_def && service.standard === 'ivo://ivoa.net/std/SODA#sync-1.0');
      const id = service ? almaCubeUrl(service.url) : row.access_url ? matchesAlmaCube(identity, row.ID ?? '') ? row.ID : decodeURIComponent(new URL(row.access_url).pathname.split('/').at(-1) ?? '') : undefined;
      return id && matchesAlmaCube(identity, id);
    });
    if (cube) {
      const documents = [root];
      const nested = [...new Set(root.rows.flatMap(row => {
        const service = root.services.find(service => service.id === row.service_def && service.standard.startsWith('ivo://ivoa.net/std/DataLink#links-'));
        return row.error_message || !row.semantics?.endsWith('#this') ? [] : service ? [service.url]
          : row.access_url && row.content_type?.includes('content=datalink') ? [row.access_url] : [];
      }))];
      if (nested.length > 16) throw new Error('ALMA size metadata request limit reached.');
      for (const url of nested) documents.push(await load(url));
      const selected = documents.map(ownCube).find(row => row !== undefined);
      if (selected) { const bytes = Number(selected.content_length); return { bytes: Number.isSafeInteger(bytes) && bytes > 0 ? bytes : null, singleCube: true }; }
    }
    const rows = root.rows.filter(row => !row.error_message && row.semantics?.endsWith('#this') && row.access_url && /\.tar(?:$|[?#])/u.test(row.access_url));
    if (!rows.length) return null;
    const sizes = rows.map(row => Number(row.content_length));
    return sizes.every(size => Number.isSafeInteger(size) && size > 0) ? sizes.reduce((sum, size) => sum + size, 0) : null;
  } catch { signal.throwIfAborted(); return null; }
}

/** A published product record, with its files verified, owns the reopened output. */
async function madeOutput(directory: string, name?: string): Promise<string | undefined> {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return []; throw error; });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.product.json')) continue;
    const product = await verifiedProduct(resolve(directory, entry.name));
    const output = name ? product.record.outputs.find(output => output.path === name) : product.record.outputs[0];
    if (output) return localOutput(product.root, output.path);
  }
  return undefined;
}

export function explorationServices(root: string, requestArgs: readonly string[], directory: string | undefined, api: CliServices, io: CliIo, consent: ConsentState): ExploreServices {
  const toolchainConsent = consentHandler(io, { json: false }, consent);
  return {
    catalogue: () => loadTargetCatalogue(root),
    resolve: (target, signal) => withDownloadProgress({ report: () => {}, signal, retainPartial: false },
      async () => !(await skyTargetRequest(root, { target })).simbadMiss),
    search: async (target, report, signal) => {
      const args = [...requestArgs];
      if (target !== undefined) {
        const existing = args.indexOf('--target');
        if (existing >= 0) args[existing + 1] = target;
        else for (let index = 0; index < args.length; index++) {
          if (!args[index]!.startsWith('-')) { args[index] = target; break; }
          if (args[index] !== '--any-time') index++;
        }
      }
      const session = await withDownloadProgress({ report: () => {}, signal, retainPartial: false }, () => api.saveExploration(root, args, directory, undefined, undefined, report));
      if (consent.cancelled) throw new Error('The astronomy packages are not installed.');
      return session;
    },
    statuses: explorationPickStatuses,
    size: (choice, _session, signal) => explorationDownloadSize(choice, signal),
    free: explorationFreeBytes,
    get: (choice, session, report, signal) => {
      let received = 0;
      return withDownloadProgress({ report: event => { received = event.received; report(event); }, signal, retainPartial: true }, () => withTransferConsent(async info => {
        if (info.kind === 'toolchain') return toolchainConsent(info);
        if (signal.aborted) signal.throwIfAborted();
        const have = (await explorationPickStatuses(session)).get(choice.pick)?.bytes ?? 0;
        if (info.bytes !== null && info.bytes - have > await explorationFreeBytes(session.directory)) throw new Error('Not enough space for this download.');
      }, async () => {
        const result = await api.getSession(root, session.directory, choice.pick, text => {
          if (/^Copying |^Verifying /u.test(text)) report({ received, checking: true });
        });
        if (consent.cancelled) throw new Error('The astronomy packages are not installed.');
        signal.throwIfAborted(); return result.resultPath;
      }));
    },
    outputs: async (resultPath, pick) => {
      const inspected = await api.listArtifactOutputs(resultPath), source = typeof inspected.source === 'string' ? inspected.source : resultPath;
      const retained = await delivery(resultPath);
      const options: ExploreOutput[] = [];
      for (const [index, output] of inspected.outputs.entries()) {
        const cube = output.shape !== undefined && output.shape.length >= 3 && (output.spectral?.axis !== undefined || output.shape.at(-3)! > 1);
        const moment = cube && output.kind === 'band-image', peak = cube && output.kind === 'aperture-spectrum';
        if (!output.available) {
          if (moment || peak) options.push({ name: moment ? 'Moment map' : 'Spectrum at peak', description: output.reason, available: false, run: async () => { throw new Error(output.reason); } });
          continue;
        }
        const name = moment ? 'Moment map' : peak ? 'Spectrum at peak' : output.kind === 'html' ? 'Viewer' : output.kind === 'image' ? 'Image' : output.kind === 'spectrum' ? 'Plot' : output.kind;
        const destination = resolve(dirname(resultPath), 'made', `${index + 1}-${moment ? 'moment-map' : peak ? 'spectrum-at-peak' : output.kind}`);
        const file = await madeOutput(destination, output.kind === 'html' ? 'viewer.html' : output.kind === 'sphere' ? 'sphere.html'
          : ['points', 'volume', 'volume-dataset-bank'].includes(output.kind) ? 'object.json' : 'figure.png');
        options.push({ name, file, description: moment ? 'PNG of the summed emission' : peak ? 'PNG and CSV through the brightest pixel' : output.kind === 'html' ? 'HTML page you can pan and zoom' : output.kind === 'image' ? 'PNG with a scale bar' : output.kind === 'spectrum' ? 'PNG of flux against wavelength' : output.reason,
          parameters: moment || peak ? [] : output.parameters, run: async parameters => {
            if (file) return file;
            const args = ['export', source, '--output', output.kind, '--out', destination];
            if (output.hdu !== undefined) args.push('--hdu', String(output.hdu));
            if (output.structure) args.push('--structure', output.structure);
            if (moment) args.push('--band', cubeBand(output).join(','), '--uncertainty', 'omit');
            if (peak) args.push('--aperture', (await cubePeakAperture(retained, output)).join(','), '--background', 'none', '--uncertainty', 'omit');
            for (const [key, value] of parameters) args.push(`--${key}`, value);
            const selected = parseCli(args);
            if (selected.command === 'html') return (await (api.exportHtml ?? exportHtml)(selected.result, selected.directory)).html;
            if (selected.command === 'sphere') return (await api.exportSphere(selected.result, selected.directory)).html;
            if (selected.command === 'spatial') return (await api.exportSpatialObject(selected.result, selected.kind, selected.directory)).object;
            if (selected.command === 'project') return (await api.projectOutput(selected.result, selected.geometry, selected.directory)).figure;
            if (selected.command !== 'export') throw new Error(`Pick ${pick}: unsupported output ${output.kind}.`);
            return (await api.exportOutput(selected.result, selected.selection, selected.directory)).figure;
          } });
      }
      for (const operation of inspected.familyOperations ?? []) {
        if (!operation.available || !['spectrum-export', 'spectrum-preview', 'table-export'].includes(operation.id)) continue;
        const plot = operation.id === 'spectrum-preview';
        const destination = resolve(dirname(resultPath), 'made', `${operation.componentId}-${operation.id}`), file = await madeOutput(destination);
        options.push({ name: plot ? 'Plot' : 'Table', file, description: plot ? 'PNG of flux against wavelength' : 'CSV of wavelength and flux', run: async () => {
          if (file) return file;
          const operationId = operation.id;
          if (operationId !== 'spectrum-export' && operationId !== 'spectrum-preview' && operationId !== 'table-export') throw new Error('Unsupported family output.');
          return (await api.executeFamilyOperation(source, { operationId, componentId: operation.componentId }, destination)).product;
        } });
      }
      // The native data is already exported by get; choosing it opens that exact retained file.
      options.push({ name: 'Data', description: 'the FITS file as retrieved', run: async () => retained.file });
      return options;
    },
    preview: async (choice, session, signal) => fetchPreview(await previewSource(choice, session), { runDir: session.directory, signal }),
    open: openExternal,
    screen: control => { consent.screen = control; },
  };
}
