/** Validated source declarations and receipt metadata; no intake, downloads or qualification. */
import { resolve, relative, isAbsolute } from 'node:path';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '@cssearth/core';
import type { ProductRecord } from '../product-record.mts';
import type { ProductKind } from './recipe-request.mts';
import { archiveProfileFamilyEvidence, productKindFamilyEvidence, type ObservationFamilyEvidence } from './observation-families.mts';
export const SOURCE_PRODUCTS_SCHEMA = 'cssearth-source-observations@1';

export interface SourceProcessingSoftware { readonly name: string; readonly version: string; readonly evidence: string }

export interface SourceFile { readonly role: string; readonly path: string; readonly origin: string; readonly sourceProcessing?: readonly SourceProcessingSoftware[] }

export function parseSourceProcessing(value: unknown): readonly SourceProcessingSoftware[] | undefined {
  if (value === undefined) return undefined;
  return requireArray(value, 'source processing software').map(raw => {
    const row = requireRecord(raw, 'source processing software'), name = requireString(row.name, 'software name').trim(),
      version = requireString(row.version, 'software version').trim(), evidence = requireString(row.evidence, 'software evidence');
    if (!name || !version || !/^https:\/\//u.test(evidence)) throw new TypeError('Source processing software needs a name, version and HTTPS evidence.');
    return { name, version, evidence };
  });
}

export function recordedSourceProcessing(record: ProductRecord): readonly SourceProcessingSoftware[] {
  if (record.stage !== 'source-qualification' || record.parameters.observation === undefined) return [];
  const observation = requireRecord(record.parameters.observation, 'source observation');
  const items = requireArray(observation.files, 'source observation files').flatMap(file =>
    parseSourceProcessing(requireRecord(file, 'source file').sourceProcessing) ?? []);
  return [...new Map(items.map(item => [`${item.name}\0${item.version}\0${item.evidence}`, item])).values()];
}

export interface SourceProduct {
  readonly id: string; readonly target: string; readonly telescope: string; readonly mode: string; readonly kind: ProductKind;
  readonly archiveProductId: string; readonly decoder: 'fits-image' | 'pds-image' | 'pds-product' | 'isis3'; readonly labelPath?: string; readonly files: readonly SourceFile[];
  readonly identity: Readonly<Record<string, string | number | boolean>>;
  readonly familyEvidence?: ObservationFamilyEvidence;
  readonly startIso?: string; readonly endIso?: string;
  readonly wavelengthIntervalsMicrometres?: readonly (readonly [number, number])[];
  readonly centralWavelengthMicrometres?: number;
  /** Achieved resolution only, with a cited measurement basis; never detector sampling. */
  readonly angularResolutionArcsec?: number; readonly surfaceResolutionKm?: number; readonly resolutionElements?: number; readonly resolutionBasis?: string;
  readonly units: string; readonly meaning: string; readonly citation: string;
  readonly limitations: readonly string[];
}

const SAFE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u;

export function safeId(value: unknown, label: string): string {
  const id = requireString(value, label); if (!SAFE.test(id)) throw new TypeError(`${label} must be a safe identifier.`); return id;
}

const time = (value: unknown, label: string) => {
  const text = requireString(value, label);
  if (!/Z$|[+-]\d\d:\d\d$/u.test(text) || !Number.isFinite(Date.parse(text))) throw new TypeError(`${label} must state an ISO timezone.`);
  return new Date(text).toISOString();
};

export function parseSourceProducts(value: unknown, manifestValue: unknown, target: string): SourceProduct[] {
  safeId(target, 'target');
  const root = requireRecord(value, 'source observations');
  if (root.schema !== SOURCE_PRODUCTS_SCHEMA || root.target !== target) throw new TypeError('Source observation schema or target mismatch.');
  const manifest = requireRecord(manifestValue, 'source manifest'), inputs = new Map<string, Record<string, unknown>>();
  for (const raw of requireArray(manifest.inputs, 'source inputs')) {
    const input = requireRecord(raw, 'source input'), id = requireString(input.id, 'source input id');
    if (inputs.has(id)) throw new TypeError(`Duplicate manifest input ${id}.`); inputs.set(id, input);
  }
  const ids = new Set<string>();
  return requireArray(root.observations, 'observations').map(raw => {
    const row = requireRecord(raw, 'observation'), id = safeId(row.id, 'observation id');
    if (ids.has(id)) throw new TypeError(`Duplicate observation ${id}.`); ids.add(id);
    const decoder = requireString(row.decoder, 'decoder');
    if (decoder !== 'fits-image' && decoder !== 'pds-image' && decoder !== 'pds-product' && decoder !== 'isis3') throw new TypeError(`Unsupported source decoder ${decoder}.`);
    const kind = requireString(row.kind, 'product kind');
    if (!['image', 'cube', 'table'].includes(kind) || (decoder === 'fits-image' || decoder === 'isis3') && kind === 'table' || decoder === 'pds-image' && kind !== 'image') throw new TypeError(`${decoder} cannot qualify ${kind}.`);
    const files = requireArray(row.inputs, 'observation inputs').map(rawFile => {
      const entry = requireRecord(rawFile, 'observation input'), inputId = requireString(entry.input, 'manifest input'), pin = inputs.get(inputId);
      if (!pin) throw new TypeError(`${id} references missing manifest input ${inputId}.`);
      const path = requireString(pin.path, 'input path');
      inside('/package', path);
      const origin = requireString(pin.origin, 'input origin');
      if (!/^https?:\/\//u.test(origin)) throw new TypeError(`${inputId} needs a retrievable archive origin.`);
      return { role: requireString(entry.role, 'input role'), path: `src/objects/${target}/source/${relative('/package', inside('/package', path))}`, origin,
        ...(pin.sourceProcessing === undefined ? {} : { sourceProcessing: parseSourceProcessing(pin.sourceProcessing) }) };
    });
    if (new Set(files.map(file => file.path)).size !== files.length || files.filter(file => file.role === 'science').length !== 1 || decoder === 'pds-image' && files.filter(file => file.role === 'label').length !== 1)
      throw new TypeError(`${id} needs one science input and, for PDS, one label, without duplicate files.`);
    const labelPath = row.labelPath === undefined ? files.find(file => file.role === 'label')?.path : `src/objects/${target}/source/${relative('/package', inside('/package', requireString(row.labelPath, 'label path')))}`;
    assertPinnedLabel({ decoder, labelPath, files });
    const identity = Object.fromEntries(Object.entries(requireRecord(row.identity, 'product identity')).map(([key, value]) => {
      if (!key || !['string', 'number', 'boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) throw new TypeError(`Invalid product identity ${key}.`);
      return [key, value as string | number | boolean];
    }));
    if (!Object.keys(identity).length) throw new TypeError(`${id} requires header or label identity assertions.`);
    const telescope = requireString(row.telescope, 'telescope'), mode = requireString(row.mode, 'mode'), familyOwner = { kind: 'source-product' as const, id, evidence: requireString(row.citation, 'citation') };
    const familyEvidence = row.familyProfile === undefined
      ? productKindFamilyEvidence(kind, familyOwner)
      : archiveProfileFamilyEvidence(requireString(row.familyProfile, 'archive family profile'), { kind: kind as ProductKind, decoder, identity, owner: familyOwner });
    const intervals = row.wavelengthIntervalsMicrometres === undefined ? undefined : requireArray(row.wavelengthIntervalsMicrometres, 'wavelength intervals').map(rawRange => {
      const range = requireArray(rawRange, 'wavelength interval'), a = requireFiniteNumber(range[0], 'wavelength start'), b = requireFiniteNumber(range[1], 'wavelength end');
      if (range.length !== 2 || a <= 0 || b <= a) throw new TypeError('Wavelength intervals must have two increasing positive bounds.');
      return [a, b] as const;
    });
    if (row.centralWavelengthMicrometres !== undefined && !(requireFiniteNumber(row.centralWavelengthMicrometres, 'central wavelength') > 0)) throw new TypeError('Central wavelength must be positive.');
    const startIso = row.startIso === undefined ? undefined : time(row.startIso, 'observation start'), endIso = row.endIso === undefined ? undefined : time(row.endIso, 'observation end');
    if (endIso && (!startIso || endIso < startIso)) throw new TypeError('Observation time interval is reversed or missing its start.');
    const resolution: { angularResolutionArcsec?: number; surfaceResolutionKm?: number; resolutionElements?: number; resolutionBasis?: string } = {};
    for (const key of ['angularResolutionArcsec', 'surfaceResolutionKm', 'resolutionElements'] as const) if (row[key] !== undefined) {
      const value = requireFiniteNumber(row[key], key); if (!(value > 0)) throw new TypeError(`${key} must be positive.`); resolution[key] = value;
    }
    if (Object.keys(resolution).length) resolution.resolutionBasis = requireString(row.resolutionBasis, 'achieved resolution basis');
    return { ...resolution, id, target, telescope, mode, kind: kind as ProductKind, familyEvidence,
      archiveProductId: requireString(row.archiveProductId, 'archive identity'), decoder, files, identity, ...(labelPath ? { labelPath } : {}),
      ...(startIso ? { startIso } : {}), ...(endIso ? { endIso } : {}), ...(intervals ? { wavelengthIntervalsMicrometres: intervals } : {}),
      ...(row.centralWavelengthMicrometres === undefined ? {} : { centralWavelengthMicrometres: requireFiniteNumber(row.centralWavelengthMicrometres, 'central wavelength') }),
      units: requireString(row.units, 'units'), meaning: requireString(row.meaning, 'measurement meaning'), citation: requireString(row.citation, 'citation'),
      limitations: requireArray(row.limitations, 'limitations').map(value => requireString(value, 'limitation')) };
  });
}

export const sourceReceipt = (product: SourceProduct) => `output/telescopes/${product.target}/${product.id}/qualification.product.json`;

export function sourceRecordComplete(record: ProductRecord, product: SourceProduct): boolean {
  const science = product.files.find(file => file.role === 'science')!;
  return product.files.every(file => record.outputs.some(output => output.path === file.path))
    && record.outputs.some(output => output.path === sourceReceipt(product).replace('qualification.product.json', 'decoded.json'))
    && (product.familyEvidence?.profileId === undefined || record.outputs.some(output => output.path === sourceReceipt(product).replace('qualification.product.json', 'descriptor.json')))
    && record.evidence.some(entry => entry.kind === 'archive-origin' && entry.product === science.path && entry.receipt === sourceReceipt(product));
}

/** Every label the decoder reads belongs to the same pinned dependency set, including attached labels. */
export function assertPinnedLabel(product: Pick<SourceProduct, 'decoder' | 'labelPath' | 'files'>): void {
  const labelPath = product.labelPath ?? product.files.find(file => file.role === 'label')?.path;
  if (!labelPath) {
    if (product.decoder === 'pds-product' || product.decoder === 'pds-image') throw new TypeError('PDS decoding requires a pinned labelPath.');
    return;
  }
  const label = inside('/package', labelPath);
  if (!product.files.some(file => inside('/package', file.path) === label)) throw new TypeError('labelPath must belong to the pinned input files.');
}

export function inside(root: string, path: string): string {
  const file = resolve(root, path), rel = relative(root, file);
  if (!rel || isAbsolute(path) || rel === '..' || rel.startsWith('../')) throw new TypeError(`Source path escapes its package: ${path}`);
  return file;
}

/** The object id and package-relative path that address a source file's mirror copy. */
export function sourceCacheAddress(file: Pick<SourceFile, 'path'>): [string, string] {
  const match = /^src\/objects\/([a-z0-9-]+)\/source\/(.+)$/u.exec(file.path);
  if (!match) throw new TypeError(`${file.path} is not an object source path.`);
  return [match[1]!, match[2]!];
}
