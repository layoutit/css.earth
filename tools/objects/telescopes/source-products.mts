import { inside } from './source-transfer.mts';
/** Package-owned observations enter the same query as archive holdings. Pins stay in the existing source manifest. */
import { intakeSources, type SourceIntakeIssue } from './source-intake.mts';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { sha256File } from '../../../src/platform/sha256.mts';
import { hasErrorCode, requireArray, requireRecord, requireString, requireFiniteNumber } from '../../sources/source-values.mts';
import { fileSize, readProductRecord, sameRun, type ProductRecord, type ProductRun } from '../product-record.mts';
import { sourcePds3Observations } from '../pds/source-observations.mts';
import type { ProductKind } from './recipe-request.mts';
import { parseProductFacts, type QualifiedObservation } from './qualified-observations.mts';
import { verifyCalibrationDependencies, type CalibrationDependency } from './calibration-dependencies.mts';
import type { ProductFacts } from './request-satisfaction.mts';
import { archiveProfileFamilyEvidence, productKindFamilyEvidence, type ObservationFamilyEvidence } from './observation-families.mts';

export const SOURCE_PRODUCTS_SCHEMA = 'cssearth-source-observations@1';
export interface SourceFile { readonly role: string; readonly path: string; readonly origin: string }
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
export interface LoadedSourceProduct extends SourceProduct { readonly qualified: boolean; readonly receipt: string; readonly receiptProblem?: string; readonly facts?: ProductFacts }
const HEX = /^[a-f0-9]{64}$/u;
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
      return { role: requireString(entry.role, 'input role'), path: `src/objects/${target}/source/${relative('/package', inside('/package', path))}`, origin };
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
/** Authored implementation inputs hashed into every source-qualification receipt. */
export const SOURCE_RUN_FILES = ['source-intake.mts', 'source-transfer.mts', '../operations-acquisition.ts', '../source-files.ts', '../terrestrial-layers/isis3-raster.mts', 'source-products.mts', 'qualify-source.mts', 'observation-families.mts', 'product-descriptor.mts', 'families/common.mts', 'families/f16/f16-spherical-grid.mts', 'native-metadata.mts', 'product-science.mts', 'calibration-dependencies.mts', '../astronomy-packages/science.mts', '../astronomy-packages/requirements.lock', 'qualified-observations.mts', 'request-satisfaction.mts', '../../fits/fits.mts', '../../fits/fits-rice.mts', '../pds3-labels.mts', '../pds/source-observations.mts', '../pds-labels.mts', '../product-record.mts', '../astronomy-packages/pds-client.mts', '../astronomy-packages/pds-toolchain.json'] as const;
export async function sourceRun(root: string, product: SourceProduct, dependencies: readonly CalibrationDependency[] = []): Promise<ProductRun> {
  assertPinnedLabel(product);
  const digest = createHash('sha256');
  for (const path of SOURCE_RUN_FILES) digest.update(path).update(await readFile(resolve(import.meta.dirname, path)));
  const inputs = await Promise.all(product.files.map(async file => ({ role: file.role, identity: file.origin, ...await sha256File(inside(root, file.path)) })));
  return { telescope: product.telescope, stage: 'source-qualification', inputs: [...inputs, ...dependencies.filter(d=>d.status==='pinned').map(d=>({role:'calibration dependency',identity:d.origin!,bytes:d.bytes!}))],
    parameters: { observation: product }, software: [{ name: 'cssEarth source qualification', version: digest.digest('hex') }, { name: 'Node.js', version: process.version }] };
}
export async function loadSourceProducts(root: string, target: string, issues: SourceIntakeIssue[] = [], options: { readonly fetchRemote?: boolean } = {}): Promise<LoadedSourceProduct[]> {
  safeId(target, 'target');
  const source = resolve(root, 'src/objects', target, 'source');
  const value = await readFile(resolve(source, 'observations.json'), 'utf8').then(text => JSON.parse(text) as unknown).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
  const declared = value === undefined ? [] : parseSourceProducts(value, JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8')) as unknown, target);
  // PDS labels are a producer of the common contract, not a separate query path.
  const legacyIssues: SourceIntakeIssue[] = [];
  for (const observation of await sourcePds3Observations(root, target, (path, reason) => legacyIssues.push({ path, state: 'incomplete', reason }))) {
    if (declared.some(entry => entry.archiveProductId === observation.archiveProductId)) continue;
    declared.push({ id: observation.id, target, telescope: observation.telescope, mode: observation.mode, kind: observation.kind, archiveProductId: observation.archiveProductId,
      decoder: 'pds-image', files: observation.sourceFiles, identity: { PRODUCT_ID: observation.archiveProductId.slice(observation.datasetId.length + 1), DATA_SET_ID: observation.datasetId, TARGET_NAME: observation.targetName },
      startIso: observation.startIso, endIso: observation.endIso, ...(observation.centralWavelengthMicrometres === undefined ? {} : { centralWavelengthMicrometres: observation.centralWavelengthMicrometres }),
      units: observation.units, meaning: observation.use, citation: observation.sourceFiles[0]!.origin,
      limitations: ['Filter width and achieved optical resolution are not supplied; pixel sampling is not optical resolution.'] });
  }
  declared.push(...await intakeSources(root, target, declared, issues, options));
  // A product accepted by native intake needs no warning about the narrower mission-image adapter.
  for (const issue of legacyIssues) if (!declared.some(product => product.files.some(file => file.path === issue.path)) &&
      !issues.some(existing => existing.path === issue.path)) issues.push(issue);
  if (new Set(declared.map(product => product.id)).size !== declared.length) throw new TypeError('Duplicate source product identity.');
  const loaded: LoadedSourceProduct[] = [];
  for (const product of declared) {
    const receipt = sourceReceipt(product);
    let record;
    try { record = await readProductRecord(resolve(root, receipt)); } catch { loaded.push({ ...product, qualified: false, receipt, receiptProblem: 'Qualification receipt is malformed.' }); continue; }
    let qualified = false, receiptProblem: string | undefined;
    const savedFacts = record ? await readFile(resolve(root, `output/telescopes/${target}/${product.id}/decoded.json`),'utf8').then(t=>parseProductFacts(requireRecord(JSON.parse(t)).facts),()=>undefined).catch(()=>undefined):undefined;
    if (record) {
      qualified = sourceRecordComplete(record, product) && await sameRun(record, await sourceRun(root,product,savedFacts?.calibrationDependencies), path => inside(root, path));
      for (const file of product.files) {
        const pin = await fileSize(inside(root, file.path)).catch(() => null);
        qualified &&= pin !== null && record.outputs.some(output => output.path === file.path && output.bytes === pin.bytes);
      }
      qualified &&= await verifyCalibrationDependencies(root,savedFacts?.calibrationDependencies??[]);
      if (!qualified) receiptProblem = 'The qualification receipt is stale: inputs, parameters, implementation, runtime or output bytes changed.';
    }
    const facts = qualified ? parseProductFacts(requireRecord(JSON.parse(await readFile(resolve(root, `output/telescopes/${target}/${product.id}/decoded.json`), 'utf8')), 'decoded product').facts) : undefined;
    loaded.push({ ...product, qualified, receipt, ...(facts ? { facts } : {}), ...(receiptProblem ? { receiptProblem } : {}) });
  }
  return loaded;
}

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

/** Adapt current source receipts to the common artifact contract without promoting declared science metadata. */
export function sourceQualifiedObservations(products: readonly LoadedSourceProduct[]): QualifiedObservation[] {
  return products.flatMap(product => product.qualified && product.facts ? [{ target: product.target, telescope: product.telescope, mode: product.mode,
    observation: product.id, program: product.id, product: product.files.find(file => file.role === 'science')!.path,
    receipt: product.receipt, productRecord: product.receipt, outputRoot: '.', facts: product.facts }] : []);
}
