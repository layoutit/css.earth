/** Exact PDS Registry product -> complete byte set -> pdr decode -> archive-final qualification. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { pdsPackages } from '@cssearth/telescope/node';
import { pdsToolchain } from '@cssearth/telescope/node';
import { writeProductRecord } from '@cssearth/telescope/node';
import type { ProductInput, ProductRun } from '@cssearth/telescope';

const ROOT = resolve(import.meta.dirname, '../../..');
export const PDS_ARCHIVE_FINAL_SCHEMA = 'cssearth-pds-archive-final@1';
export const PDS_PROGRAMS = resolve(import.meta.dirname, 'programs');
const HEX32 = /^[0-9a-f]{32}$/u, SAFE_NAME = /^[A-Za-z0-9._-]+$/u, MAX_FILE_BYTES = 256 * 1024 * 1024;

export interface PdsQualificationSpec {
  readonly id: string; readonly target: string; readonly targetLid: string; readonly targetName: string;
  readonly lidvid: string; readonly telescope: string; readonly archiveTelescope: string; readonly mode: string; readonly instrument: string;
  readonly kind: 'image'; readonly use: string; readonly units?: string;
}
export interface PdsArchiveFile { readonly role: 'label' | 'science' | 'supplemental'; readonly name: string; readonly uri: string;
  readonly bytes: number; readonly md5: string; readonly sha256: string }

const list = (value: unknown, label: string): unknown[] => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
const strings = (value: unknown, label: string): string[] => list(value, label).map((entry, index) => requireString(entry, `${label}[${index}]`));
const numbers = (value: unknown, label: string): number[] => list(value, label).map((entry, index) => {
  const number = typeof entry === 'string' ? Number(entry) : requireFiniteNumber(entry, `${label}[${index}]`);
  if (!Number.isSafeInteger(number) || number < 0) throw new TypeError(`${label}[${index}] is not a byte count.`);
  return number;
});

export interface DiscoveredPdsProduct {
  readonly lid: string; readonly lidvid: string; readonly version: string; readonly targetNames: readonly string[]; readonly targetLids: readonly string[];
  readonly observingSystem: readonly string[]; readonly startIso: string; readonly stopIso: string; readonly harvestIso: string;
  readonly label: { readonly uri: string; readonly bytes: number; readonly md5: string };
  readonly data: readonly { readonly uri: string; readonly bytes: number; readonly md5: string }[];
}

export function normalizeDiscoveredPdsProduct(value: unknown): DiscoveredPdsProduct {
  const row = requireRecord(value, 'PDS Registry product'), field = (name: string) => row[name];
  const dataUris = strings(field('ops:Data_File_Info.ops:file_ref'), 'PDS data URI');
  const dataBytes = numbers(field('ops:Data_File_Info.ops:file_size'), 'PDS data bytes');
  const dataMd5 = strings(field('ops:Data_File_Info.ops:md5_checksum'), 'PDS data md5');
  if (!dataUris.length || dataUris.length !== dataBytes.length || dataUris.length !== dataMd5.length) throw new TypeError('PDS Registry returned an incomplete data-file set.');
  const labelUris = strings(field('ops:Label_File_Info.ops:file_ref'), 'PDS label URI'), labelBytes = numbers(field('ops:Label_File_Info.ops:file_size'), 'PDS label bytes'),
    labelMd5 = strings(field('ops:Label_File_Info.ops:md5_checksum'), 'PDS label md5');
  if (labelUris.length !== 1 || labelBytes.length !== 1 || labelMd5.length !== 1) throw new TypeError('PDS Registry returned no unique label file.');
  for (const digest of [...labelMd5, ...dataMd5]) if (!HEX32.test(digest)) throw new TypeError(`PDS Registry returned an invalid MD5 ${digest}.`);
  return { lid: requireString(field('lid'), 'PDS lid'), lidvid: requireString(field('lidvid'), 'PDS lidvid'), version: requireString(field('vid'), 'PDS version'),
    targetNames: strings(field('pds:Target_Identification.pds:name'), 'PDS target name'), targetLids: strings(field('ref_lid_target'), 'PDS target lid'),
    observingSystem: strings(field('pds:Observing_System_Component.pds:name'), 'PDS observing system'),
    startIso: requireString(field('pds:Time_Coordinates.pds:start_date_time'), 'PDS start'), stopIso: requireString(field('pds:Time_Coordinates.pds:stop_date_time'), 'PDS stop'),
    harvestIso: requireString(field('ops:Harvest_Info.ops:harvest_date_time'), 'PDS harvest time'),
    label: { uri: labelUris[0]!, bytes: labelBytes[0]!, md5: labelMd5[0]! },
    data: dataUris.map((uri, index) => ({ uri, bytes: dataBytes[index]!, md5: dataMd5[index]! })) };
}

async function acquire(entry: { readonly uri: string; readonly bytes: number; readonly md5: string }, directory: string) {
  const name = basename(new URL(entry.uri).pathname);
  if (!SAFE_NAME.test(name) || entry.bytes > MAX_FILE_BYTES) throw new Error(`Unsupported PDS file ${name || entry.uri}.`);
  const path = resolve(directory, name);
  let bytes = await readFile(path).catch(() => undefined);
  if (!bytes || bytes.byteLength !== entry.bytes || createHash('md5').update(bytes).digest('hex') !== entry.md5) {
    const response = await fetch(entry.uri, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`PDS download ${entry.uri} returned ${response.status}.`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength !== entry.bytes || createHash('md5').update(bytes).digest('hex') !== entry.md5) throw new Error(`${entry.uri} does not match the PDS Registry size and MD5.`);
    await writeFile(path, bytes);
  }
  return { name, path, uri: entry.uri, bytes: bytes.byteLength, md5: entry.md5, sha256: createHash('sha256').update(bytes).digest('hex') };
}

const textField = (record: Record<string, unknown>, name: string) => requireString(record[name], `decoded ${name}`);
const textList = (record: Record<string, unknown>, name: string) => requireArray(record[name], `decoded ${name}`).map((entry, index) => requireString(entry, `decoded ${name}[${index}]`));
const optionalTextField = (record: Record<string, unknown>, name: string) => record[name] === null || record[name] === undefined ? undefined : textField(record, name);
const wavelengthMicrometres = (value: number, unit: string) => unit === 'nm' ? value / 1000 : unit === 'Angstrom' ? value / 10_000
  : unit === 'um' || unit === 'micrometer' ? value : (() => { throw new Error(`Unsupported PDS wavelength unit ${unit}.`); })();
const wavelengthEdge = (value: number) => Number(value.toPrecision(12));

interface DecodedBand { readonly filter: string; readonly interval: readonly [number, number]; readonly array?: string }
function decodedBands(metadata: Record<string, unknown>): DecodedBand[] {
  const bins = requireArray(metadata.spectralBins, 'decoded spectral bins').map((raw, index) => {
    const bin = requireRecord(raw, `decoded spectral bin ${index}`), center = Number(textField(bin, 'center')), width = Number(textField(bin, 'width')),
      centerUnit = textField(bin, 'centerUnit'), widthUnit = textField(bin, 'widthUnit');
    if (!(center > 0 && width > 0) || centerUnit !== widthUnit) throw new Error('The PDS label has an invalid spectral bin.');
    const centerUm = wavelengthMicrometres(center, centerUnit), widthUm = wavelengthMicrometres(width, widthUnit);
    return { filter: textField(bin, 'filter'), interval: [wavelengthEdge(centerUm - widthUm / 2), wavelengthEdge(centerUm + widthUm / 2)] as const };
  });
  if (bins.length) return bins;
  const optical = requireArray(metadata.opticalFilters ?? [], 'decoded optical filters').map((raw, index) => {
    const band = requireRecord(raw, `decoded optical filter ${index}`), center = Number(textField(band, 'center')), width = Number(textField(band, 'width')),
      centerUnit = textField(band, 'centerUnit'), widthUnit = textField(band, 'widthUnit');
    if (!(center > 0 && width > 0) || centerUnit !== widthUnit) throw new Error('The PDS label has an invalid optical filter.');
    const centerUm = wavelengthMicrometres(center, centerUnit), widthUm = wavelengthMicrometres(width, widthUnit);
    return { array: textField(band, 'array'), filter: textField(band, 'filter'), interval: [wavelengthEdge(centerUm - widthUm / 2), wavelengthEdge(centerUm + widthUm / 2)] as const };
  });
  if (optical.length) return optical;
  const center = Number(textField(metadata, 'centerFilterWavelength')), width = Number(textField(metadata, 'bandwidth'));
  if (!(center > 0 && width > 0 && width < center * 2)) throw new Error('The decoded label has no usable filter band.');
  return [{ filter: textField(metadata, 'filter'), interval: [(center - width / 2) / 10_000, (center + width / 2) / 10_000] as const }];
}

export async function qualifyPdsArchiveProduct(spec: PdsQualificationSpec, work = resolve(ROOT, 'output/pds', spec.id)) {
  if (!SAFE_NAME.test(spec.id) || !spec.use.trim()) throw new TypeError('A PDS qualification needs a safe id and a stated use.');
  const discovered = await pdsPackages({ operation: 'discover-product', targetLid: spec.targetLid, lidvid: spec.lidvid });
  if (discovered.products?.length !== 1) throw new Error(`Peppi did not find the exact PDS product ${spec.lidvid} for ${spec.targetLid}.`);
  const product = normalizeDiscoveredPdsProduct(discovered.products[0]);
  if (product.lidvid !== spec.lidvid || !product.targetLids.includes(spec.targetLid) || !product.targetNames.includes(spec.targetName) ||
      !product.observingSystem.includes(spec.archiveTelescope) || !product.observingSystem.includes(spec.instrument)) throw new Error('The PDS Registry product does not match the requested target or observing system.');
  await mkdir(work, { recursive: true });
  const label = await acquire(product.label, work), acquired = [label, ...await Promise.all(product.data.map(file => acquire(file, work)))];
  const decodedAnswer = await pdsPackages({ operation: 'decode-product', labelPath: label.path }), decoded = decodedAnswer.decoded!;
  if (decoded.standard !== 'PDS4' || !decoded.structures.length) throw new Error(`${spec.lidvid} did not decode as a non-empty PDS4 product.`);
  const metadata = decoded.metadata, logicalIdentifier = textField(metadata, 'logicalIdentifier'), version = textField(metadata, 'version');
  const references = requireArray(metadata.references, 'decoded references').map((entry, index) => requireRecord(entry, `decoded reference ${index}`));
  const targetReferences = references.filter(entry => entry.reference_type === 'data_to_target').map(entry => requireString(entry.lid_reference, 'target reference'));
  const fileNames = textList(metadata, 'fileNames'), registryDataNames = acquired.slice(1).map(file => file.name);
  const labelStart = optionalTextField(metadata, 'startIso'), labelStop = optionalTextField(metadata, 'stopIso');
  if (`${logicalIdentifier}::${version}` !== spec.lidvid || textField(metadata, 'targetName') !== spec.targetName || !targetReferences.includes(spec.targetLid) ||
      (labelStart !== undefined && Date.parse(labelStart) !== Date.parse(product.startIso)) || (labelStop !== undefined && Date.parse(labelStop) !== Date.parse(product.stopIso)) ||
      [...fileNames].sort().join('\n') !== [...registryDataNames].sort().join('\n')) throw new Error('The decoded label disagrees with the selected PDS Registry product.');
  const systems = textList(metadata, 'observingSystem');
  if (!systems.includes(spec.archiveTelescope) || !systems.includes(spec.instrument)) throw new Error('The decoded label names another observing system.');
  const science = product.data.length === 1 ? acquired.find(file => file.uri === product.data[0]!.uri) : acquired.find(file => /\.fits?$/iu.test(file.name));
  if (!science || !decoded.structures.length) throw new Error('This qualification route requires one science data file with decoded image data.');
  const structures = decoded.structures, shapes = structures.map((structure, index) => requireArray(structure.shape, `science shape ${index}`).map(value => requireFiniteNumber(value, 'science axis')));
  if (shapes.some(shape => (shape.length !== 2 && shape.length !== 3) || shape.some(value => !Number.isSafeInteger(value) || value < 1)) ||
      shapes.slice(1).some(shape => shape.join(',') !== shapes[0]!.join(','))) throw new Error('The decoded science product is not one image or equally sized filter images.');
  const bands = decodedBands(metadata);
  if (structures.length > 1 && (shapes[0]!.length !== 2 || structures.length !== bands.length ||
      structures.some((structure, index) => structure.name !== bands[index]!.array))) throw new Error('Separate decoded images must correspond one-to-one with the label filters.');
  const shape = shapes[0]!, filters = bands.map(band => band.filter), intervals = bands.map(band => band.interval), filter = filters.join(', '),
    dataUnits = spec.units ?? textList(metadata, 'units')[0] ?? 'not stated', width = shape.at(-1)!, height = shape.at(-2)!;
  const resolution = metadata.pixelResolutionX === null || metadata.pixelResolutionX === undefined ? undefined : requireRecord(metadata.pixelResolutionX, 'pixel resolution');
  const surfaceResolutionKm = resolution === undefined ? undefined : textField(resolution, 'unit') === 'm/pixel' ? Number(textField(resolution, 'value')) / 1000
    : (() => { throw new Error('Unsupported PDS map-resolution unit.'); })();
  const files: PdsArchiveFile[] = acquired.map(file => ({ role: file.name === label.name ? 'label' : file.name === science.name ? 'science' : 'supplemental',
    name: file.name, uri: file.uri, bytes: file.bytes, md5: file.md5, sha256: file.sha256 }));
  const program = { schema: PDS_ARCHIVE_FINAL_SCHEMA, id: spec.id, target: spec.target, targetLid: spec.targetLid, targetName: spec.targetName,
    telescope: spec.telescope, archiveTelescope: spec.archiveTelescope, mode: spec.mode, instrument: spec.instrument, kind: spec.kind, use: spec.use, lidvid: spec.lidvid,
    observation: { id: logicalIdentifier.split(':').at(-1), startIso: product.startIso, stopIso: product.stopIso, filter, filters,
      wavelengthIntervalsMicrometres: intervals, ...(intervals.length === 1 ? { wavelengthIntervalMicrometres: intervals[0] } : {}), units: dataUnits, width, height,
      ...(surfaceResolutionKm === undefined ? {} : { surfaceResolutionKm }), ...(optionalTextField(metadata, 'mapProjection') ? { mapProjection: optionalTextField(metadata, 'mapProjection') } : {}) },
    discovery: { package: 'pds.peppi', version: discovered.peppi, harvestIso: product.harvestIso },
    decoding: { package: 'pdr', version: decodedAnswer.pdr, standard: decoded.standard, structures: decoded.structures }, files,
    components: [{ role: 'science', supplied: true, file: science.name, units: dataUnits },
      { role: 'coordinates', supplied: surfaceResolutionKm !== undefined, ...(surfaceResolutionKm === undefined
        ? { reason: 'The label supplies no per-pixel celestial WCS or body-surface registration.' }
        : { file: science.name, convention: `${optionalTextField(metadata, 'mapProjection')}; ${optionalTextField(metadata, 'longitudeDirection')}; ${surfaceResolutionKm} km/pixel` }) },
      { role: 'uncertainty', supplied: false, reason: 'This PDS product supplies no uncertainty array.' },
      { role: 'quality', supplied: false, reason: 'This PDS product supplies no per-pixel quality array.' }],
    note: 'Archive-final image product: one array, one multiband array or separate filter images. Decoding establishes readable values and label conventions; it does not establish calibration accuracy beyond the archive product.' } as const;
  await mkdir(PDS_PROGRAMS, { recursive: true });
  const programPath = resolve(PDS_PROGRAMS, `${spec.id}.archive-final.json`), recordPath = resolve(PDS_PROGRAMS, `${spec.id}.archive-final.product.json`);
  await writeFile(programPath, `${JSON.stringify(program, null, 2)}\n`);
  const inputs: ProductInput[] = files.map(file => ({ role: file.role, identity: file.uri, bytes: file.bytes, sha256: file.sha256 }));
  const toolchain = await pdsToolchain(), run: ProductRun = { telescope: spec.telescope, stage: 'archive-final', inputs, software: [], toolchainDigest: toolchain.digest,
    parameters: { selection: { program: spec.id, target: spec.target, targetLid: spec.targetLid, lidvid: spec.lidvid, kind: spec.kind, use: spec.use },
      identityAgreedWith: { registry: { targetNames: product.targetNames, targetLids: product.targetLids, observingSystem: product.observingSystem, startIso: product.startIso, stopIso: product.stopIso },
        label: { logicalIdentifier, version, targetName: spec.targetName, targetLid: spec.targetLid, observingSystem: systems, startIso: labelStart ?? null, stopIso: labelStop ?? null } },
      qualificationPackages: { peppi: discovered.peppi, pdr: decodedAnswer.pdr },
      measured: { kind: spec.kind, width, height, units: dataUnits, filters, wavelengthIntervalsMicrometres: intervals,
        ...(structures.length === 1 ? { decodedStructure: structures[0] } : { decodedStructures: structures }),
        uncertaintySupplied: false, worldCoordinateSystemSupplied: false, surfaceRegistrationSupplied: surfaceResolutionKm !== undefined,
        ...(surfaceResolutionKm === undefined ? {} : { surfaceResolutionKm, mapProjection: optionalTextField(metadata, 'mapProjection'), longitudeDirection: optionalTextField(metadata, 'longitudeDirection') }) } } };
  const receipt = `tools/objects/pds/programs/${spec.id}.archive-final.product.json`;
  const record = await writeProductRecord(recordPath, run, files.map(file => ({ path: file.name, file: resolve(work, file.name),
    ...(file.name === science.name ? { units: dataUnits, conventions: { filters: bands.map(band => `${band.filter}: ${band.interval[0]} to ${band.interval[1]} micrometres`).join('; '),
      registration: surfaceResolutionKm === undefined ? 'detector image only; no body-surface registration' : `${optionalTextField(metadata, 'mapProjection')} map at ${surfaceResolutionKm} km/pixel`, qualification: spec.use } } : {}) })),
    [{ kind: 'archive-origin', receipt, product: science.name,
      establishes: `${science.name} and every file referenced by ${spec.lidvid} match the PDS Registry sizes and MD5 values, are pinned here by SHA-256, and pdr ${decodedAnswer.pdr} decoded the complete science data structures. This establishes origin, integrity and readability only; no local calibration or archive agreement is claimed.` }]);
  return { program, record, programPath, recordPath, productPath: science.path };
}
