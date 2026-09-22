#!/usr/bin/env node
/** Complete, scoped Peppi target search -> verified labels -> product-level candidates for the shared query. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue } from '../../cli/cli-arguments.mts';
import { pds4Blocks, pds4Elements, pds4Field } from '../pds-labels.mts';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { pdsPackages } from '../astronomy-packages/pds-client.mts';
import { normalizeDiscoveredPdsProduct, type DiscoveredPdsProduct } from './archive-final.mts';
import { sourcePds3Observations } from './source-observations.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
export const PDS_DISCOVERY_SCHEMA = 'cssearth-pds-discovery@1';
export const PDS_DISCOVERY_STORE_SCHEMA = 'cssearth-pds-discovery@2';
export const PDS_DISCOVERY = resolve(ROOT, 'data/pds/discovery.json');

export interface PdsDiscoveredObservation {
  readonly id: string; readonly lidvid: string; readonly targetLid: string; readonly targetName: string;
  readonly telescope: string; readonly archiveTelescope: string; readonly mode: string; readonly instrument: string;
  readonly kind: 'image' | 'cube' | 'spectrum' | 'table'; readonly title: string; readonly registryStartIso: string; readonly registryStopIso: string;
  readonly processingLevel: string;
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
interface Component { readonly name: string; readonly type: string }
const components = (xml: string): Component[] => pds4Blocks(xml, 'Observing_System_Component').map(block => ({ name: pds4Field(block, 'name'), type: pds4Field(block, 'type') }));
const acronym = (name: string) => /\(([A-Z][A-Z0-9+_-]{1,})\)\s*$/u.exec(name)?.[1]
  ?? name.split(/[^A-Za-z0-9]+/u).filter(Boolean).map(word => word[0]!.toUpperCase()).join('');
const numberWithUnit = (xml: string, name: string) => {
  const element = pds4Elements(xml, name);
  if (element.length !== 1) return undefined;
  const value = Number(element[0]!.content.trim()), unit = /\bunit="([^"]+)"/u.exec(element[0]!.tag)?.[1];
  if (!Number.isFinite(value) || !unit) throw new Error(`Invalid PDS4 number or unit: ${name}`);
  return { value, unit };
};
const micrometres = (measurement: { readonly value: number; readonly unit: string }) => measurement.unit === 'nm' ? measurement.value / 1000
  : measurement.unit === 'Angstrom' ? measurement.value / 10_000
  : measurement.unit === 'um' || measurement.unit === 'micrometer' ? measurement.value
  : (() => { throw new Error(`Unsupported PDS wavelength unit ${measurement.unit}.`); })();
const kilometresPerPixel = (measurement: { readonly value: number; readonly unit: string }) => measurement.unit === 'm/pixel' ? measurement.value / 1000
  : measurement.unit === 'km/pixel' ? measurement.value
  : (() => { throw new Error(`Unsupported PDS map-resolution unit ${measurement.unit}.`); })();

/** Normalize an observational label from its declared structure. Instrument names select no code path. */
export function inspectPdsProduct(product: DiscoveredPdsProduct, xml: string, labelSha256: string,
  target: { readonly lid: string; readonly name: string }): PdsDiscoveredObservation {
  const logicalIdentifier = identity(product, xml), refs = targetReferences(xml);
  if (!refs.includes(target.lid) || !product.targetLids.includes(target.lid)) throw new Error(`${product.lidvid} does not identify the requested target.`);
  const system = components(xml), instruments = system.filter(entry => entry.type.toLowerCase() === 'instrument');
  if (instruments.length !== 1) throw new Error(`${product.lidvid} names ${instruments.length} instruments; one is required for an observation mode.`);
  const telescopeComponents = system.filter(entry => entry.type.toLowerCase() === 'telescope'), hosts = system.filter(entry => entry.type.toLowerCase() === 'host');
  if (telescopeComponents.length > 1 || hosts.length > 1 || !telescopeComponents.length && !hosts.length)
    throw new Error(`${product.lidvid} has no unique telescope or host.`);
  const archiveTelescope = telescopeComponents[0]?.name ?? hosts[0]!.name;
  const telescope = telescopeComponents.length && hosts.length ? `${hosts[0]!.name.split(/\s+/u)[0]}/${acronym(telescopeComponents[0]!.name)}` : archiveTelescope;
  const instrument = instruments[0]!.name, instrumentKey = acronym(instrument), processingLevel = pds4Field(xml, 'processing_level');
  const mapped = pds4Blocks(xml, 'cart:Cartography').length > 0, image2d = pds4Blocks(xml, 'Array_2D_Image'), image3d = pds4Blocks(xml, 'Array_3D_Image'), spectra3d = pds4Blocks(xml, 'Array_3D_Spectrum');
  const tables = [...pds4Blocks(xml, 'Table_Character'), ...pds4Blocks(xml, 'Table_Binary'), ...pds4Blocks(xml, 'Table_Delimited')];
  const kind = mapped && spectra3d.length ? 'image' : image2d.length ? 'image' : image3d.length || spectra3d.length ? 'cube' : tables.length ? 'table'
    : pds4Blocks(xml, 'Array_1D').length ? 'spectrum' : undefined;
  if (!kind) throw new Error(`${product.lidvid} has no supported observational array or table structure.`);
  const spectral = pds4Blocks(xml, 'sp:Bin_Wavelength').map(block => ({ filter: pds4Field(block, 'sp:filter_name'),
    center: numberWithUnit(block, 'sp:center_wavelength'), width: numberWithUnit(block, 'sp:bin_width_wavelength') }));
  const optical = pds4Blocks(xml, 'img:Optical_Filter').map(block => ({ filter: pds4Field(block, 'img:filter_name'),
    center: numberWithUnit(block, 'img:center_filter_wavelength'), width: numberWithUnit(block, 'img:bandwidth') }));
  const bands = [...spectral, ...optical].map(band => {
    if (!band.center || !band.width || band.center.unit !== band.width.unit) throw new Error(`${product.lidvid} has an incomplete optical band.`);
    const center = micrometres(band.center), width = micrometres(band.width);
    if (!(center > 0 && width > 0 && width < center * 2)) throw new Error(`${product.lidvid} has an invalid optical band.`);
    return { filter: band.filter, interval: [Number((center - width / 2).toPrecision(12)), Number((center + width / 2).toPrecision(12))] as const };
  });
  const resolution = [numberWithUnit(xml, 'cart:pixel_resolution_x'), numberWithUnit(xml, 'cart:pixel_resolution_y')].filter(value => value !== undefined);
  const surfaceResolutionKm = resolution.length ? Math.max(...resolution.map(value => kilometresPerPixel(value))) : undefined;
  const mode = mapped && bands.length ? `${instrumentKey} mapped color` : image2d.length > 1 && bands.length > 1 ? `${instrumentKey} color images`
    : kind === 'image' && bands.length === 1 ? `${instrumentKey}/${bands[0]!.filter} ${processingLevel.toLowerCase()} image`
    : `${instrumentKey} ${processingLevel.toLowerCase()} ${kind}`;
  const targetIndex = product.targetLids.indexOf(target.lid), targetName = product.targetNames[targetIndex] ?? target.name;
  return { id: logicalIdentifier.split(':').at(-1)!, lidvid: product.lidvid, targetLid: target.lid, targetName, telescope, archiveTelescope, mode, instrument, kind,
    title: pds4Field(xml, 'title'), registryStartIso: product.startIso, registryStopIso: product.stopIso, processingLevel,
    filters: bands.map(band => band.filter), wavelengthIntervalsMicrometres: bands.map(band => band.interval),
    ...(surfaceResolutionKm === undefined ? {} : { surfaceResolutionKm }), label: { ...product.label, sha256: labelSha256 }, units: 'not stated at product level',
    use: `Archive ${processingLevel.toLowerCase()} ${kind}; identity, structure and any wavelength or map-sampling facts come from its PDS4 label.` };
}

async function verifiedLabel(product: DiscoveredPdsProduct) {
  const response = await fetch(product.label.uri, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`PDS label ${product.label.uri} returned ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer()), md5 = createHash('md5').update(bytes).digest('hex');
  if (bytes.byteLength !== product.label.bytes || md5 !== product.label.md5) throw new Error(`${product.label.uri} does not match its PDS Registry size and MD5.`);
  return { xml: bytes.toString('utf8'), sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function discoverPdsTarget(target: { readonly id: string; readonly lid: string; readonly name: string }) {
  const answer = await pdsPackages({ operation: 'discover-target', targetLid: target.lid });
  const rows = answer.products ?? [], observations: PdsDiscoveredObservation[] = [], rejected: { lidvid: string; reason: string }[] = [];
  for (const row of rows) {
    let product: DiscoveredPdsProduct | undefined;
    try {
      product = normalizeDiscoveredPdsProduct(row);
      const label = await verifiedLabel(product);
      observations.push(inspectPdsProduct(product, label.xml, label.sha256, target));
    } catch (error) {
      rejected.push({ lidvid: product?.lidvid ?? String(row.lidvid ?? row.lid ?? 'unknown PDS product'), reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { schema: PDS_DISCOVERY_SCHEMA, searchedAt: new Date().toISOString(), package: { name: 'pds.peppi', version: answer.peppi }, target,
    scope: { productClass: 'Product_Observational', processingLevels: 'all', complete: true }, registryProducts: rows.length,
    admittedProducts: observations.length, rejectedProducts: rejected.length, rejected, observations } as const;
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

export function pdsTargetNameCandidates(values: readonly string[]) {
  const names = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    names.add(value);
    const withoutDesignation = value.replace(/\s+\([^()]+\)$/u, '');
    names.add(withoutDesignation);
    names.add(withoutDesignation.replace(/[A-Z]{2,}/gu, word => `${word[0]}${word.slice(1).toLowerCase()}`));
  }
  return [...names];
}

/** Resolve a PDS context target through Peppi. Archive identity is package-owned data, not a cssEarth target table. */
export async function pdsTarget(root: string, id: string) {
  const descriptor = requireRecord(JSON.parse(await readFile(resolve(root, 'src/objects', id, 'object.json'), 'utf8')) as unknown, `${id} object`);
  const catalog = requireRecord(requireRecord(descriptor.properties, `${id} properties`).catalog, `${id} catalog`);
  const sourceNames = (await sourcePds3Observations(root, id)).map(observation => observation.targetName);
  const names = pdsTargetNameCandidates([requireString(catalog.name, `${id} name`), ...sourceNames]);
  const targets = (await pdsPackages({ operation: 'resolve-target', names })).targets ?? [];
  if (targets.length !== 1) throw new TypeError(targets.length
    ? `PDS target names for ${id} are ambiguous: ${targets.map(target => `${target.name} (${target.lid})`).join(', ')}.`
    : `Peppi found no PDS context target for ${id} from ${names.join(', ')}.`);
  return { id, lid: targets[0]!.lid, name: targets[0]!.name };
}

export const DISCOVER_HELP = 'Usage: node tools/cli/run-typed-module.mjs tools/objects/pds/discover.mts --archive pds --target TARGET [--write]';
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
