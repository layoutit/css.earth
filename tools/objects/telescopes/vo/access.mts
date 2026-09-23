/** Select one exact product/operation. Never turn a failed cutout into a whole-product download. */
import { dirname, resolve } from 'node:path';
import { mkdir, readFile, writeFile, copyFile, rename, rm } from 'node:fs/promises';
import { sha256File } from '../../../../src/platform/sha256.mts';
import { randomUUID } from 'node:crypto';
import { fileSize, readProductRecord, sameRun, writeProductRecord, type ProductRun } from '../../product-record.mts';
import { astroquery } from '../../astronomy-packages/client.mts';
import { requireRecord } from '../../../sources/source-values.mts';
import { extractVoPackage } from './package.mts';
import { inspectVoFits, type VoContentProfile } from './content.mts';
import { acquisitionKey, canonical, digest, jsonValue, parseLimits, productKey, type DiscoverySnapshot, type Json, type MetadataResponse, type Pin, type Resource, type TransferLimits } from './contracts.mts';
import type { DiscoveredObservation, DiscoveryRequest } from './discovery.mts';
import { voUrl, type VoNetworkPolicy } from './network-policy.mts';

export interface AcquisitionSpec {
  readonly schema: 'cssearth-vo-acquisition@1'; readonly key: string; readonly productKey: string;
  readonly observation: DiscoveredObservation; readonly request: DiscoveryRequest;
  readonly operation: { readonly kind: 'direct' | 'soda-sync'; readonly url: string; readonly parameters: Readonly<Record<string, Json>> };
  readonly descriptor: Resource | null; readonly metadata: readonly Pin[];
  readonly serviceRow: number | null; readonly serviceMetadata: string | null;
  readonly format: 'fits' | 'zip' | 'tar'; readonly decoder: 'fits-raster' | 'family-pending';
  readonly kind: 'image' | 'cube' | 'spectrum' | 'table' | 'photometry' | 'events' | 'strips'; readonly limits: TransferLimits;
  readonly implementation: string;
}
export interface AccessPlan { readonly products: readonly AcquisitionSpec[]; readonly issues: readonly string[] }
/** The table route requires an exact direct FITS product and an archive-confirmed target. */
export function nativeQualificationRoute(spec: AcquisitionSpec): 'raster' | 'f08-table' | null {
  if (spec.decoder === 'fits-raster' && (spec.kind === 'image' || spec.kind === 'cube')) return 'raster';
  if (spec.decoder === 'family-pending' && spec.kind === 'table' && spec.format === 'fits' &&
    spec.operation.kind === 'direct' && spec.observation.target.status === 'confirmed') return 'f08-table';
  return null;
}
const PRODUCT_KINDS = ['image', 'cube', 'spectrum', 'table', 'photometry', 'events', 'strips'] as const;
function supportedKind(value: string | null): value is AcquisitionSpec['kind'] { return value !== null && (PRODUCT_KINDS as readonly string[]).includes(value); }
async function implementation(): Promise<string> {
  return digest(await Promise.all(['./access.mts', './content.mts', './package.mts', './contracts.mts', './discovery.mts', './network-policy.mts', '../../astronomy-packages/client.mts', '../../astronomy-packages/requirements.lock']
    .map(path => readFile(new URL(path, import.meta.url), 'utf8'))));
}
export function mediaType(value: string | null): { type: string; parameters: Readonly<Record<string, string>> } | null {
  if (value === null) return null;
  const [type, ...parts] = value.split(';').map(s => s.trim());
  if (!type || !/^[\w.+-]+\/[\w.+-]+$/u.test(type)) return null;
  const parameters: Record<string, string> = {};
  for (const part of parts) {
    const m = /^([\w-]+)=(?:"([^"]*)"|([^\s;]+))$/u.exec(part);
    if (!m || m[1]!.toLowerCase() in parameters) return null;
    parameters[m[1]!.toLowerCase()] = (m[2] ?? m[3])!.toLowerCase();
  }
  return { type: type.toLowerCase(), parameters };
}
const datalink = (mime: string | null) => { const m = mediaType(mime); return m?.type === 'application/x-votable+xml' && m.parameters.content === 'datalink'; };
const fits = (mime: string | null) => ['application/fits', 'image/fits'].includes(mediaType(mime)?.type ?? '');
const standardId = (resource: Resource) => resource.parameters.find(p => p.name === 'standardID')?.value;
const SODA_SYNC = 'ivo://ivoa.net/std/SODA#sync-1.0';
const DATALINK_LINKS = 'ivo://ivoa.net/std/DataLink#links-1.0';

/** Validate advertised parameter meaning before giving its values to PyVO. */
export function sodaParameters(descriptor: Resource, request: DiscoveryRequest, fixed: Readonly<Record<string, Json>>): Readonly<Record<string, Json>> {
  if (standardId(descriptor) !== SODA_SYNC) throw new TypeError('No advertised synchronous SODA operation.');
  const inputs = descriptor.groups.filter(g => g.name === 'inputParams');
  if (inputs.length !== 1) throw new TypeError('SODA input parameter declarations are missing or ambiguous.');
  const parameters = inputs[0]!.parameters;
  if (new Set(parameters.map(p => p.name)).size !== parameters.length) throw new TypeError('Duplicate SODA input parameter.');
  const id = parameters.find(p => p.name === 'ID');
  if (!id || fixed.ID === undefined || fixed.ID === null || fixed.ID === '') throw new TypeError('No exact SODA dataset ID binding.');
  const normativeId = id.datatype === 'char' && id.arraysize === '*' && id.unit === null && id.ucd === 'meta.ref.url;meta.curation';
  // ESO uses the older meta.id;meta.dataset UCD. Its actual declaration is retained, never rewritten.
  const esoCompatibility = id.datatype === 'char' && id.arraysize === '*' && id.unit === null && id.ucd === 'meta.id;meta.dataset' && !id.ref && typeof id.value === 'string' && id.value.startsWith('ivo://eso.org/') &&
    descriptor.parameters.some(p => p.name === 'accessURL' && p.value === 'https://dataportal.eso.org/dataPortal/soda/sync');
  if (!normativeId && !esoCompatibility) throw new TypeError('Unsupported SODA ID declaration.');
  const result: Record<string, Json> = { ...fixed };
  if (request.spectralFrame !== undefined) {
    if (request.spectralFrame !== 'barycentric') throw new TypeError('SODA BAND requires a barycentric spectral frame.');
    const p = parameters.find(p => p.name === 'BAND');
    if (!p || p.datatype !== 'double' || p.arraysize !== '2' || p.unit !== 'm' || p.ucd !== 'em.wl;stat.interval' || p.xtype !== 'interval') throw new TypeError('SODA does not advertise a supported BAND interval.');
    if (!request.wavelengthMicrometres) throw new TypeError('SODA BAND requires an explicit wavelength interval.');
    const interval = request.continuumMicrometres
      ? [request.continuumMicrometres[0][0], request.continuumMicrometres[1][1]] as const
      : request.wavelengthMicrometres;
    result.BAND = interval.map(n => n * 1e-6);
  }
  if (request.region) {
    const p = parameters.find(p => p.name === 'CIRCLE');
    if (!p || p.unit !== 'deg' || p.ucd !== 'pos.outline;obs' || p.xtype !== 'circle' || p.arraysize !== '3' || !['double','float'].includes(p.datatype)) throw new TypeError('SODA does not advertise a supported ICRS CIRCLE.');
    const r = request.region;
    result.CIRCLE = [r.raDegrees, r.decDegrees, r.radiusDegrees];
  }
  if (!request.region && request.spectralFrame === undefined) throw new TypeError('No explicit supported SODA subset was requested.');
  for (const p of parameters) {
    const changed = p.name === 'BAND' && request.spectralFrame || p.name === 'CIRCLE' && request.region;
    if (!changed && p.value !== null && p.value !== '' && !Array.isArray(p.value) && result[p.name] === undefined)
      throw new TypeError(`PyVO did not bind the advertised ${p.name} default.`);
    if (changed && p.constraints && typeof p.constraints === 'object' && !Array.isArray(p.constraints)) {
      const c = requireRecord(p.constraints), values = result[p.name];
      if (Array.isArray(values) && p.name === 'BAND') for (const value of values) {
        if (typeof value !== 'number' || typeof c.minimum === 'number' && value < c.minimum || typeof c.maximum === 'number' && value > c.maximum)
          throw new TypeError(`Requested ${p.name} is outside its advertised bounds.`);
      }
    }
  }
  return result;
}
/** `parameters` are PyVO's descriptor-bound DataLink request parameters, never URL text. */
export type MetadataLoader = (url: string, parameters?: Readonly<Record<string, Json>>) => Promise<MetadataResponse>;
export async function planAccess(root: string, observation: DiscoveredObservation, snapshot: DiscoverySnapshot, request: DiscoveryRequest,
  load?: MetadataLoader, policy: VoNetworkPolicy = {}): Promise<AccessPlan> {
  const limits = parseLimits(request.transferLimits), products: AcquisitionSpec[] = [], issues: string[] = [], visited = new Set<string>();
  const implementationDigest = await implementation();
  const evidenceDirectory = resolve(root, 'output/telescopes/vo/metadata');
  await mkdir(evidenceDirectory, { recursive: true });
  const snapshotFile = resolve(evidenceDirectory, `${digest(snapshot)}.snapshot.json`);
  await writeFile(snapshotFile, canonical(snapshot));
  const snapshotPin = { path: snapshotFile, ...await sha256File(snapshotFile) };
  if (observation.target.status !== 'confirmed' && observation.target.status !== 'in-field')
    return { products, issues: ['The archive record has no confirmed target association and is not in the requested field.'] };
  if (!supportedKind(observation.kind))
    return { products, issues: [`No native profile route for advertised product kind ${observation.kind}.`] };
  const kind = observation.kind;
  const loader = load ?? (async (address: string, parameters?: Readonly<Record<string, Json>>) => (await astroquery({ operation: 'vo-links', url: address,
    ...(parameters === undefined ? {} : { parameters }), directory: resolve(root, 'output/telescopes/vo/metadata'), byteLimit: limits.metadataBytes,
    allowedPrivateHosts: policy.allowedPrivateHosts })).vo!);
  let calls = 0;
  function add(operation: AcquisitionSpec['operation'], binding: Json, metadata: readonly Pin[], descriptor: Resource | null = null, serviceRow: number | null = null, serviceMetadata: string | null = null, format: AcquisitionSpec['format'] = 'fits') {
    const { snapshot: _snapshot, issues: _issues, ...observationFacts } = observation;
    const product = productKey(observation.key, jsonValue({ binding, observation: observationFacts }));
    const key = acquisitionKey(product, jsonValue({ operation, request }), jsonValue(descriptor), limits, implementationDigest);
    if (!products.some(p => p.key === key)) products.push({ schema: 'cssearth-vo-acquisition@1', key, productKey: product, observation, request, operation,
      descriptor, metadata, serviceRow, serviceMetadata, format, decoder: kind === 'image' || kind === 'cube' ? 'fits-raster' : 'family-pending', kind, limits, implementation: implementationDigest });
  }
  function direct(address: string, mime: string | null, size: Json | undefined, binding: Json, pins: readonly Pin[]) {
    if (request.region || request.spectralFrame !== undefined) { issues.push('Subset requested; whole-product access is not an alternative.'); return; }
    const type = mediaType(mime)?.type, format = fits(mime) ? 'fits' : type === 'application/zip' ? 'zip' : type === 'application/x-tar' ? 'tar' : null;
    if (!format) { issues.push(`No supported decoder for ${mime ?? 'unknown MIME'}.`); return; }
    if (typeof size === 'number' && size > limits.scienceBytes) { issues.push('Advertised direct product exceeds the transfer bound.'); return; }
    add({ kind: 'direct', url: address, parameters: {} }, binding, pins, null, null, null, format);
  }
  async function links(address: string, parameters: Readonly<Record<string, Json>>, depth: number, pins: readonly Pin[]): Promise<void> {
    if (depth > limits.nestedEdges) { issues.push('DataLink nesting bound reached.'); return; }
    const identity = digest({ url: address, parameters });
    if (visited.has(identity)) { issues.push('Repeated DataLink operation skipped.'); return; }
    if (++calls > limits.metadataRequests) { issues.push('DataLink request bound reached.'); return; }
    visited.add(identity);
    let response: MetadataResponse;
    try { voUrl(address, address, policy); response = await loader(address, parameters); } catch (error) { issues.push(`DataLink transport or parsing failed: ${String(error)}`); return; }
    const closure = [...pins, response.raw];
    if (response.queryStatus !== 'OK') { issues.push(`DataLink response is ${response.queryStatus}.`); return; }
    for (let i = 0; i < response.rows.length; i++) {
      const row = response.rows[i]!, semantics = typeof row.semantics === 'string' ? row.semantics : '';
      if (row.error_message) { issues.push(`DataLink error: ${String(row.error_message)}`); continue; }
      if (!['#this','#proc','#cutout','http://www.ivoa.net/rdf/datalink/core#this','http://www.ivoa.net/rdf/datalink/core#proc','http://www.ivoa.net/rdf/datalink/core#cutout'].includes(semantics)) continue;
      if (row.service_def) {
        const binding = response.bindings.find(b => b.row === i && b.serviceId === row.service_def), descriptor = response.resources.find(r => r.id === row.service_def);
        if (!binding || binding.error || !binding.url || !descriptor) { issues.push('DataLink service descriptor could not be resolved.'); continue; }
        try {
          const address = voUrl(binding.url, response.effectiveUrl, policy), standard = standardId(descriptor);
          if (standard === DATALINK_LINKS) {
            await links(address, binding.parameters, depth + 1, closure);
          } else if (standard === SODA_SYNC) {
            const parameters = sodaParameters(descriptor, request, binding.parameters);
            add({ kind: 'soda-sync', url: address, parameters }, jsonValue({ row, url: address, dataset: binding.parameters }), closure, descriptor, i, response.raw.path);
          } else if (typeof standard === 'string' && standard.startsWith('ivo://ivoa.net/std/SODA#')) throw new TypeError('No advertised synchronous SODA operation.');
          else throw new TypeError(`Unsupported DataLink service standard ${standard ?? 'missing'}.`);
        } catch (error) { issues.push(String(error)); }
        continue;
      }
      if (typeof row.access_url !== 'string' || !row.access_url) { issues.push('DataLink row has no access URL.'); continue; }
      try {
        const next = voUrl(row.access_url, response.effectiveUrl, policy), mime = typeof row.content_type === 'string' ? row.content_type : null;
        if (datalink(mime)) await links(next, {}, depth + 1, closure);
        else direct(next, mime, row.content_length, jsonValue({ row, url: next }), closure);
      } catch (error) { issues.push(String(error)); }
    }
  }
  if (!observation.access.url) return { products, issues: ['No archive access URL.'] };
  let address: string;
  try { address = voUrl(observation.access.url, snapshot.response.effectiveUrl, policy); }
  catch (error) { return { products, issues: [String(error)] }; }
  const pins = [snapshot.response.raw, snapshotPin];
  const advertised = observation.access.mime;
  if (datalink(advertised)) await links(address, {}, 0, pins);
  else if (advertised !== null && mediaType(advertised) === null) {
    // A malformed access_format names no decoder (ALMA declares the column as char(9) and serves "applicati"). The access
    // URL answers for itself: it is read as DataLink, and anything that does not parse as a DataLink response is refused.
    issues.push(`Advertised access_format ${JSON.stringify(advertised)} is malformed; the access URL was read as a DataLink service.`);
    await links(address, {}, 0, pins);
  } else direct(address, observation.access.mime, observation.access.estimatedKilobytes === null ? null : observation.access.estimatedKilobytes * 1000,
    jsonValue({ url: address, identities: observation.identities }), pins);
  return { products, issues };
}

/** Acquisition records origin/integrity only. Scientific metadata qualification is a later stage. */
export async function acquireVoProduct(root: string, spec: AcquisitionSpec, policy: VoNetworkPolicy = {}) {
  voUrl(spec.operation.url, spec.operation.url, policy);
  if (spec.implementation !== await implementation() || spec.key !== acquisitionKey(spec.productKey, jsonValue({ operation: spec.operation, request: spec.request }), jsonValue(spec.descriptor), spec.limits, spec.implementation))
    throw new Error('VO acquisition identity or implementation changed; query again.');
  for (const pin of spec.metadata) {
    const actual = await sha256File(pin.path);
    if (actual.sha256 !== pin.sha256 || actual.bytes !== pin.bytes) throw new Error('VO metadata evidence changed.');
  }
  if (spec.operation.kind === 'soda-sync') {
    if (!spec.descriptor || spec.serviceRow === null || !spec.serviceMetadata) throw new Error('Subset has no pinned descriptor binding.');
    const parameters = sodaParameters(spec.descriptor, spec.request, spec.operation.parameters);
    if (canonical(parameters) !== canonical(spec.operation.parameters)) throw new Error('Subset parameters disagree with request.');
  } else if (spec.request.region || spec.request.spectralFrame) throw new Error('Subset requests cannot acquire a direct product.');
  const destination = resolve(root, 'output/telescopes/vo/acquired', spec.key), recordPath = resolve(destination, 'acquisition.json');
  const run: ProductRun = { telescope: spec.observation.service, stage: 'archive-acquisition',
    inputs: spec.metadata.map(pin => ({ identity: pin.sha256, role: 'archive metadata response', bytes: pin.bytes })),
    parameters: { acquisition: spec.key, parent: spec.observation.identities, operation: spec.operation, format: spec.format, limits: spec.limits },
    software: [{ name: 'cssEarth VO acquisition', version: spec.implementation }, { name: 'PyVO', version: '1.9.1' }] };
  const previous = await readProductRecord(recordPath);
  if (previous) {
    if (canonical(previous.parameters) !== canonical(run.parameters) || canonical(previous.software) !== canonical(run.software) || !await sameRun(previous, previous, name => resolve(destination, name))) throw new Error('Acquired product or evidence is stale.');
    return { file: previous.outputs.some(output => output.path === 'science.fits') ? resolve(destination, 'science.fits') : null, record: recordPath, reused: true, replay: 'pinned-local-artifact' as const };
  }
  await mkdir(dirname(destination), { recursive: true });
  const staging = `${destination}.${randomUUID()}.partial`;
  await mkdir(staging);
  try {
    const metadata: { path: string; file: string }[] = [];
    for (const pin of spec.metadata) {
      const path = `${pin.sha256}${pin.path.endsWith('.json') ? '.json' : '.xml'}`;
      if (metadata.some(m => m.path === path)) continue;
      const file = resolve(staging, path); await copyFile(pin.path, file);
      const actual = await sha256File(file);
      if (actual.sha256 !== pin.sha256 || actual.bytes !== pin.bytes) throw new Error('Metadata changed while copying.');
      metadata.push({ path, file });
    }
    const descriptorPin = spec.metadata.find(p => p.path === spec.serviceMetadata);
    if (spec.operation.kind === 'soda-sync' && !descriptorPin) throw new Error('Subset descriptor is outside the metadata evidence closure.');
    const receivedName = spec.format === 'fits' ? 'science.fits' : `archive.${spec.format}`;
    const transferred = (await astroquery({ operation: 'vo-download', url: spec.operation.url, destination: resolve(staging, receivedName), format: spec.format,
      ...(nativeQualificationRoute(spec) === 'f08-table' ? { fitsProfile: 'bintable' as const } : {}),
      byteLimit: spec.limits.scienceBytes, parameters: spec.operation.parameters, allowedPrivateHosts: policy.allowedPrivateHosts,
      ...(spec.operation.kind === 'soda-sync' ? { descriptor: { file: descriptorPin!, row: spec.serviceRow!, serviceId: spec.descriptor!.id! } } : {}) })).transfer!;
    const unpacked = spec.format === 'fits' ? undefined : await extractVoPackage(resolve(staging, receivedName), staging, { expandedBytes: spec.limits.expandedBytes, members: spec.limits.packageMembers });
    if (unpacked) {
      if (unpacked.format !== spec.format) throw new Error('Archive format disagrees with advertised MIME.');
      // A package may contain several FITS science members or a table/event product. Never select one by order.
      if (unpacked.science !== null) await copyFile(resolve(staging, 'members', unpacked.science), resolve(staging, 'science.fits'));
      metadata.push({ path: receivedName, file: resolve(staging, receivedName) }, ...unpacked.members.map(member => ({ path: `members/${member.path}`, file: resolve(staging, 'members', member.path) })));
    }
    const content: VoContentProfile[] = [];
    if (unpacked) {
      for (const member of unpacked.fitsMembers) content.push(inspectVoFits(`members/${member}`, await readFile(resolve(staging, 'members', member))));
    } else content.push(inspectVoFits('science.fits', await readFile(resolve(staging, 'science.fits'))));
    const legacySource = content.length === 1 && content[0]!.family === 'raster' && content[0]!.state === 'confirmed' ? content[0]!.member : null;
    const legacy = legacySource === null ? null : 'science.fits';
    if (legacySource === null && unpacked?.science !== null && unpacked?.science !== undefined)
      throw new Error('Package raster candidate disagrees with validated native content.');
    if (legacySource !== null && unpacked && unpacked.science !== null && legacySource !== `members/${unpacked.science}`)
      throw new Error('Package raster selection disagrees with validated member identity.');
    await writeFile(resolve(staging, 'origin.json'), canonical({ schema: 'cssearth-vo-origin@1', acquisition: spec.key,
      parent: spec.observation.identities, operation: spec.operation, received: { ...transferred, file: { ...transferred.file, path: receivedName } }, ...(unpacked ? { unpacked } : {}) }));
    await writeFile(resolve(staging, 'content.json'), canonical({ schema: 'cssearth-vo-content@2', format: spec.format,
      archiveProposal: { kind: spec.kind, decoder: spec.decoder }, members: content,
      legacyRasterMember: legacy, qualification: legacy === 'science.fits' ? 'raster candidate requires content qualification.' : 'non-qualifiable through the legacy raster route; select a family-specific qualified operation using the stable member identity above.' }));
    await writeProductRecord(resolve(staging, 'acquisition.json'), run, [...(legacy === 'science.fits' || spec.format === 'fits' ? [{ path: 'science.fits', file: resolve(staging, 'science.fits') }] : []),
      { path: 'content.json', file: resolve(staging, 'content.json') },
      { path: 'origin.json', file: resolve(staging, 'origin.json') }, ...metadata], []);
    await rename(staging, destination);
    return { file: legacy === 'science.fits' || spec.format === 'fits' ? resolve(destination, 'science.fits') : null, record: recordPath, reused: false };
  } finally { await rm(staging, { recursive: true, force: true }); }
}
