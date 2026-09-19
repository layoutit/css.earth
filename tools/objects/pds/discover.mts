#!/usr/bin/env node
/** Complete, scoped Peppi target search -> verified labels -> product-level candidates for the shared query. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue } from '../../cli-arguments.mts';
import { pds4Blocks, pds4Elements, pds4Field, pds4Number } from '../pds-labels.mts';
import { requireArray, requireRecord, requireString } from '../../source-values.mts';
import { pdsPackages } from '../astronomy-packages/pds-client.mts';
import { normalizeDiscoveredPdsProduct, type DiscoveredPdsProduct } from './archive-final.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
export const PDS_DISCOVERY_SCHEMA = 'cssearth-pds-discovery@1';
export const PDS_DISCOVERY_STORE_SCHEMA = 'cssearth-pds-discovery@2';
export const PDS_DISCOVERY = resolve(ROOT, 'data/pds/discovery.json');
const TARGETS = resolve(ROOT, 'data/pds/targets.json');

export interface PdsDiscoveredObservation {
  readonly id: string; readonly lidvid: string; readonly targetLid: string; readonly targetName: string;
  readonly telescope: string; readonly archiveTelescope: string; readonly mode: string; readonly instrument: string;
  readonly kind: 'image'; readonly title: string; readonly registryStartIso: string; readonly registryStopIso: string;
  readonly filters: readonly string[]; readonly wavelengthIntervalsMicrometres: readonly (readonly [number, number])[];
  readonly surfaceResolutionKm?: number; readonly label: { readonly uri: string; readonly bytes: number; readonly md5: string; readonly sha256: string };
  readonly use: string; readonly units: string;
}

const identity = (product: DiscoveredPdsProduct, xml: string) => {
  const logicalIdentifier = pds4Field(xml, 'logical_identifier'), version = values(xml, 'version_id')[0];
  if (`${logicalIdentifier}::${version}` !== product.lidvid) throw new Error(`${product.lidvid} label identity disagrees with the registry.`);
  const files = values(xml, 'file_name');
  if (files.length !== product.data.length || !files.every(name => product.data.some(file => new URL(file.uri).pathname.endsWith(`/${name}`))))
    throw new Error(`${product.lidvid} label and registry disagree about the complete data-file set.`);
  return logicalIdentifier;
};

const values = (xml: string, name: string) => pds4Elements(xml, name).map(entry => entry.content.trim()).filter(value => value && !value.includes('<'));
const targetReferences = (xml: string) => pds4Blocks(xml, 'Internal_Reference').flatMap(block => {
  try { return pds4Field(block, 'reference_type') === 'data_to_target' ? [pds4Field(block, 'lid_reference')] : []; } catch { return []; }
});
const componentNames = (xml: string) => pds4Blocks(xml, 'Observing_System_Component').map(block => pds4Field(block, 'name'));

export function inspectMappedPdsProduct(product: DiscoveredPdsProduct, xml: string, labelSha256: string): PdsDiscoveredObservation | undefined {
  const systems = componentNames(xml), instrument = 'Multispectral Visible Imaging Camera';
  if (!systems.includes('New Horizons') || !systems.includes(instrument) || !pds4Blocks(xml, 'cart:Cartography').length || !pds4Blocks(xml, 'Array_3D_Spectrum').length) return undefined;
  const bins = pds4Blocks(xml, 'sp:Bin_Wavelength').map(block => {
    const center = pds4Number(block, 'sp:center_wavelength', 'nm'), width = pds4Number(block, 'sp:bin_width_wavelength', 'nm');
    if (!(center > 0 && width > 0 && width < center * 2)) throw new Error(`${product.lidvid} has an invalid spectral bin.`);
    return { filter: pds4Field(block, 'sp:filter_name'), interval: [Number(((center - width / 2) / 1000).toPrecision(12)), Number(((center + width / 2) / 1000).toPrecision(12))] as const };
  });
  if (!bins.length || !targetReferences(xml).some(lid => product.targetLids.includes(lid))) throw new Error(`${product.lidvid} has no usable target or wavelength bins.`);
  const resolutionX = pds4Number(xml, 'cart:pixel_resolution_x', 'm/pixel'), resolutionY = pds4Number(xml, 'cart:pixel_resolution_y', 'm/pixel');
  if (resolutionX !== resolutionY || resolutionX <= 0) throw new Error(`${product.lidvid} has unsupported unequal map sampling.`);
  const logicalIdentifier = identity(product, xml);
  return { id: logicalIdentifier.split(':').at(-1)!, lidvid: product.lidvid, targetLid: product.targetLids[0]!, targetName: product.targetNames[0]!,
    telescope: 'New Horizons', archiveTelescope: 'New Horizons', mode: 'MVIC mapped color', instrument, kind: 'image', title: pds4Field(xml, 'title'),
    registryStartIso: product.startIso, registryStopIso: product.stopIso, filters: bins.map(bin => bin.filter),
    wavelengthIntervalsMicrometres: bins.map(bin => bin.interval), surfaceResolutionKm: resolutionX / 1000,
    label: { ...product.label, sha256: labelSha256 }, units: 'dimensionless relative values, no longer strictly I/F',
    use: 'Archive-derived, body-registered multiband map. Suitable as a pinned telescope product; wavelength bands and map sampling come from its PDS4 label.' };
}


export function inspectMvicColorProduct(product: DiscoveredPdsProduct, xml: string, labelSha256: string): PdsDiscoveredObservation | undefined {
  const systems = componentNames(xml), instrument = 'Multispectral Visible Imaging Camera';
  if (!systems.includes('New Horizons') || !systems.includes(instrument) || pds4Blocks(xml, 'cart:Cartography').length || !pds4Blocks(xml, 'Array_2D_Image').length) return undefined;
  const bands = pds4Blocks(xml, 'img:Imaging').map(block => {
    const filters = pds4Blocks(block, 'img:Optical_Filter');
    if (filters.length !== 1) throw new Error(`${product.lidvid} has an ambiguous optical-filter description.`);
    const filter = filters[0]!, center = pds4Number(filter, 'img:center_filter_wavelength', 'nm'), width = pds4Number(filter, 'img:bandwidth', 'nm');
    if (!(center > 0 && width > 0 && width < center * 2)) throw new Error(`${product.lidvid} has an invalid optical filter.`);
    return { array: pds4Field(block, 'local_identifier_reference'), filter: pds4Field(filter, 'img:filter_name'),
      interval: [Number(((center - width / 2) / 1000).toPrecision(12)), Number(((center + width / 2) / 1000).toPrecision(12))] as const };
  });
  const arrays = pds4Blocks(xml, 'Array_2D_Image').map(block => pds4Field(block, 'local_identifier'));
  if (!bands.length || bands.map(band => band.array).join('\n') !== arrays.join('\n') || !targetReferences(xml).some(lid => product.targetLids.includes(lid)))
    throw new Error(`${product.lidvid} has no usable target or one image per optical filter.`);
  const logicalIdentifier = identity(product, xml);
  return { id: logicalIdentifier.split(':').at(-1)!, lidvid: product.lidvid, targetLid: product.targetLids[0]!, targetName: product.targetNames[0]!,
    telescope: 'New Horizons', archiveTelescope: 'New Horizons', mode: 'MVIC color images', instrument, kind: 'image', title: pds4Field(xml, 'title'),
    registryStartIso: product.startIso, registryStopIso: product.stopIso, filters: bands.map(band => band.filter), wavelengthIntervalsMicrometres: bands.map(band => band.interval),
    label: { ...product.label, sha256: labelSha256 }, units: 'not stated by PDS label',
    use: 'Archive-derived four-filter detector images. Suitable as a pinned telescope product; the PDS4 label establishes each filter band but supplies no body-surface registration.' };
}

async function verifiedLabel(product: DiscoveredPdsProduct) {
  const response = await fetch(product.label.uri, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`PDS label ${product.label.uri} returned ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer()), md5 = createHash('md5').update(bytes).digest('hex');
  if (bytes.byteLength !== product.label.bytes || md5 !== product.label.md5) throw new Error(`${product.label.uri} does not match its PDS Registry size and MD5.`);
  return { xml: bytes.toString('utf8'), sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function discoverPdsTarget(target: { readonly id: string; readonly lid: string; readonly name: string }) {
  const answer = await pdsPackages({ operation: 'discover-target', targetLid: target.lid, processingLevel: 'Derived' });
  const products = (answer.products ?? []).map(normalizeDiscoveredPdsProduct), observations: PdsDiscoveredObservation[] = [];
  for (const product of products) {
    const label = await verifiedLabel(product), inspected = inspectMappedPdsProduct(product, label.xml, label.sha256) ?? inspectMvicColorProduct(product, label.xml, label.sha256);
    if (inspected && inspected.targetLid === target.lid && inspected.targetName === target.name) observations.push(inspected);
  }
  return { schema: PDS_DISCOVERY_SCHEMA, searchedAt: new Date().toISOString(), package: { name: 'pds.peppi', version: answer.peppi }, target,
    scope: { productClass: 'Product_Observational', processingLevel: 'Derived', complete: true }, registryProducts: products.length, observations } as const;
}

export function mergePdsDiscovery(existing: unknown, discovery: Awaited<ReturnType<typeof discoverPdsTarget>>) {
  const value = existing === undefined ? undefined : requireRecord(existing, 'PDS discovery store');
  const searches = value === undefined ? [] : value.schema === PDS_DISCOVERY_STORE_SCHEMA
    ? requireArray(value.searches, 'PDS discovery searches')
    : value.schema === PDS_DISCOVERY_SCHEMA ? [value]
    : (() => { throw new TypeError('Unsupported PDS discovery schema.'); })();
  return { schema: PDS_DISCOVERY_STORE_SCHEMA,
    searches: [...searches.filter(entry => requireString(requireRecord(requireRecord(entry, 'PDS discovery search').target, 'PDS discovery target').id, 'PDS target id') !== discovery.target.id), discovery] };
}

export async function pdsTarget(root: string, id: string) {
  const raw = requireRecord(JSON.parse(await readFile(resolve(root, 'data/pds/targets.json'), 'utf8')) as unknown, 'PDS targets');
  if (raw.schema !== 'cssearth-pds-targets@1') throw new TypeError('Unsupported PDS target catalogue.');
  const found = requireArray(raw.targets, 'PDS targets').map(entry => requireRecord(entry, 'PDS target')).find(entry => entry.id === id);
  if (!found) throw new TypeError(`No PDS target identity is recorded for ${id}.`);
  return { id, lid: requireString(found.lid, 'PDS target lid'), name: requireString(found.name, 'PDS target name') };
}

export const DISCOVER_HELP = 'Usage: pnpm telescope:discover --archive pds --target TARGET [--write]';
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), archive = flagValue(args, '--archive'), target = flagValue(args, '--target');
  if (args.includes('--help') || args.includes('-h')) process.stdout.write(`${DISCOVER_HELP}\n`);
  else {
    if (archive !== 'pds' || !target) throw new TypeError(DISCOVER_HELP);
    const discovery = await discoverPdsTarget(await pdsTarget(ROOT, target));
    if (args.includes('--write')) {
      const existing = await readFile(PDS_DISCOVERY, 'utf8').then(text => JSON.parse(text) as unknown).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
      });
      await writeFile(PDS_DISCOVERY, `${JSON.stringify(mergePdsDiscovery(existing, discovery), null, 2)}\n`);
      const { buildPdsLedger } = await import('./archive-ledger.mts');
      await writeFile(resolve(ROOT, 'data/pds/ledger.json'), `${JSON.stringify(await buildPdsLedger(), null, 2)}\n`);
    }
    process.stdout.write(`${JSON.stringify(discovery, null, 2)}\n`);
  }
}
