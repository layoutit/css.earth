/** Durable result of the public qualifier. A small index of exact local artifacts, not an archive ledger. */
import { inputPath } from '../paths.mts';
import { parseCalibrationDependencies, verifyCalibrationDependencies } from '../requests/calibration-dependencies.mts';
import { parseNativeMetadata } from '../products/native-metadata.mts';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { requireArray, requireRecord, requireString, requireFiniteNumber, hasErrorCode } from '@cssearth/core';
import { fileSize, plainName, readProductRecord, sameRun, USER_ROOT } from '@cssearth/telescope-core/node';
import { assessInput, assessRequest, type ProductFacts } from '../requests/request-satisfaction.mts';
import type { CapabilityRequest } from '../requests/recipe-request.mts';
import { parseResolutionEvidence, parseRegion } from '@cssearth/objects';
import { admittedArtifactFile, artifactFile } from '../delivery/artifact-paths.mts';

export interface QualifiedObservation {
  readonly target: string | null; readonly telescope: string; readonly mode: string; readonly observation: string; readonly program: string;
  readonly product: string; readonly receipt: string; readonly productRecord: string; readonly outputRoot: string;
  readonly facts: ProductFacts;
}
export function parseProductFacts(raw: unknown): ProductFacts {
  const value = requireRecord(raw, 'product facts');
  if (typeof value.verified !== 'boolean') throw new TypeError('Product verification must be explicit.');
  const facts: { -readonly [K in keyof ProductFacts]: ProductFacts[K] } = { target: value.target === null ? null : requireString(value.target, 'product target'), verified: value.verified };
  if (value.regionCoverage !== undefined) {
    const r = requireRecord(value.regionCoverage), usablePixelCenters = requireFiniteNumber(r.usablePixelCenters), invalidPixelCenters = requireFiniteNumber(r.invalidPixelCenters);
    if (r.answer !== 'partial' && r.answer !== 'unknown' || ![usablePixelCenters,invalidPixelCenters].every(n => Number.isSafeInteger(n) && n >= 0)) throw new TypeError('Invalid region assessment.');
    facts.regionCoverage = { region: parseRegion(r.region), answer: r.answer, reason: requireString(r.reason), usablePixelCenters, invalidPixelCenters };
  }
  if (value.kind !== undefined) {
    if (!['image', 'cube', 'spectrum', 'table', 'photometry', 'events', 'strips'].includes(String(value.kind))) throw new TypeError('Unknown qualified product kind.');
    facts.kind = value.kind as ProductFacts['kind'];
  }
  if (value.result !== undefined) {
    if (value.result !== 'body-map' && value.result !== 'telescope-product') throw new TypeError('Unknown qualified result.');
    facts.result = value.result;
  }
  for (const key of ['startIso', 'endIso'] as const) if (value[key] !== undefined) {
    const date = requireString(value[key], key); if (!Number.isFinite(Date.parse(date))) throw new TypeError(`Invalid ${key}.`); facts[key] = new Date(date).toISOString();
  }
  if (facts.endIso && (!facts.startIso || facts.endIso < facts.startIso)) throw new TypeError('Reversed product time.');
  for (const key of ['angularResolutionArcsec', 'surfaceResolutionKm', 'resolutionElements'] as const) if (value[key] !== undefined) {
    const number = requireFiniteNumber(value[key], key); if (number <= 0) throw new TypeError(`Invalid ${key}.`); facts[key] = number;
  }
  if (value.wavelengthIntervalsMicrometres !== undefined) facts.wavelengthIntervalsMicrometres = requireArray(value.wavelengthIntervalsMicrometres, 'product wavelengths').map(raw => {
    const range = requireArray(raw, 'wavelength interval'), a = requireFiniteNumber(range[0]), b = requireFiniteNumber(range[1]);
    if (range.length !== 2 || !(a > 0 && b >= a)) throw new TypeError('Invalid product wavelengths.'); return [a, b] as const;
  });
  if (value.angularResolutionBound !== undefined) {
    const bound = requireRecord(value.angularResolutionBound), arcsec = requireFiniteNumber(bound.arcsec);
    if (!(arcsec > 0) || bound.method !== 'jwst-point-source-profile@1') throw new TypeError('Invalid angular resolution bound.');
    facts.angularResolutionBound = { arcsec, method: bound.method, receipt: requireString(bound.receipt) };
  }
  if (value.resolutionEvidence !== undefined) facts.resolutionEvidence = requireArray(value.resolutionEvidence).map(parseResolutionEvidence);
  if (value.nativeMetadata !== undefined) facts.nativeMetadata = parseNativeMetadata(value.nativeMetadata);
  if(value.calibrationDependencies !== undefined) facts.calibrationDependencies = parseCalibrationDependencies(value.calibrationDependencies);
  return facts;
}
/** One remembered qualification per observation, named by what was qualified. */
const qualificationName = (result: Pick<QualifiedObservation, 'telescope' | 'mode' | 'program' | 'observation'>): string =>
  `${plainName(result.telescope, result.mode, result.program, result.observation)}.json`;
/** Qualifications share the user-owned store regardless of the caller's workspace. */
export const qualificationDirectory = (target: string | null): string => target === null ? resolve(USER_ROOT, 'output/telescopes/vo/field-qualifications') : resolve(USER_ROOT, 'output/telescopes', target === '.' || target === '..' ? target.replaceAll('.', '%2E') : encodeURIComponent(target), 'qualifications');
export async function rememberQualification(root: string, result: QualifiedObservation): Promise<void> {
  const locations = Object.fromEntries((['product', 'receipt', 'productRecord', 'outputRoot'] as const).map(key => [key, inputPath(root, result[key])]));
  const facts = parseProductFacts(result.facts), bound = facts.angularResolutionBound;
  if(!await verifyCalibrationDependencies(root, facts.calibrationDependencies ?? []))throw new Error('Calibration dependency pin mismatch');
  const resolutionEvidence = await Promise.all((facts.resolutionEvidence ?? []).map(async evidence => {
    if (!evidence.receipt) return evidence;
    const file = resolve(root, evidence.receipt.file);
    await stat(file).catch(() => { throw new Error('Resolution evidence receipt is missing.'); });
    return { ...evidence, receipt: { ...evidence.receipt, file } };
  }));
  const pins = await Promise.all([result.product, result.receipt, result.productRecord, ...(bound ? [bound.receipt] : []),
    ...resolutionEvidence.flatMap(evidence => evidence.receipt ? [evidence.receipt.file] : []), ...(facts.calibrationDependencies ?? []).flatMap(r=>r.file?[r.file]:[])].map(async file => ({ path: inputPath(root, file), ...(await fileSize(inputPath(root, file))) })));
  const calibrationDependencies = facts.calibrationDependencies?.map(dependency => dependency.file ? { ...dependency, file: resolve(root, dependency.file) } : dependency);
  const portableFacts = { ...facts, ...(calibrationDependencies ? { calibrationDependencies } : {}), ...(facts.resolutionEvidence ? { resolutionEvidence } : {}), ...(bound ? { angularResolutionBound: { ...bound, receipt: resolve(root, bound.receipt) } } : {}) };
  const value = { ...result, ...locations, schema: 'cssearth-qualified-observation@2', facts: portableFacts, pins };
  const text = `${JSON.stringify(value, null, 2)}\n`, directory = resolve(qualificationDirectory(result.target), 'locations', ...resolve(root, result.outputRoot).split(/[/\\]/u).filter(Boolean).map(encodeURIComponent));
  await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, qualificationName(result)), text);
}
export async function loadQualifiedObservations(root: string, target: string | null): Promise<QualifiedObservation[]> {
  const directory = qualificationDirectory(target);
  const names = await readdir(directory, { recursive: true }).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return []; throw error; });
  const products: QualifiedObservation[] = [];
  for (const name of names.filter(name => name.endsWith('.json')).sort()) {
    const text = await readFile(resolve(directory, name), 'utf8');
    const value = requireRecord(JSON.parse(text), 'qualified observation');
    if (value.schema !== 'cssearth-qualified-observation@2' || value.target !== target) continue;
    let current = true;
    for (const raw of requireArray(value.pins, 'qualified pins')) {
      const pin = requireRecord(raw), path = requireString(pin.path);
      if (!isAbsolute(path)) { current = false; continue; }
      const found = await admittedArtifactFile(root, path).then(() => fileSize(path)).catch(() => null);
      if (!found || found.bytes !== pin.bytes || pin.sha256 !== undefined) current = false;
    }
    if (!current) continue;
    const fields = Object.fromEntries(['telescope', 'mode', 'observation', 'program', 'product', 'receipt', 'productRecord', 'outputRoot'].map(key => [key, requireString(value[key], key)]));
    if (['product', 'receipt', 'productRecord', 'outputRoot'].some(key => !isAbsolute(fields[key]!))) continue;
    const record = await readProductRecord(inputPath(root, fields.productRecord!));
    if (!record || !await sameRun(record, record, name => resolve(root, fields.outputRoot!, name))) continue;
    if (!record.outputs.some(output => resolve(root, fields.outputRoot!, output.path) === inputPath(root, fields.product!))) continue;
    const facts = parseProductFacts(value.facts);
    // Delivery carries every output and evidence receipt, even those outside the qualification's explicit pins.
    const files = [fields.product!, fields.receipt!, fields.productRecord!,
      ...record.outputs.map(output => resolve(fields.outputRoot!, output.path)), ...record.evidence.map(evidence => resolve(fields.outputRoot!, evidence.receipt)),
      ...(facts.calibrationDependencies ?? []).flatMap(dependency => dependency.file ? [resolve(root, dependency.file)] : []),
      ...(facts.angularResolutionBound ? [resolve(root, facts.angularResolutionBound.receipt)] : []),
      ...(facts.resolutionEvidence ?? []).flatMap(evidence => evidence.receipt ? [resolve(root, evidence.receipt.file)] : [])];
    try {
      if (resolve(root) !== resolve(fields.outputRoot!)) artifactFile(root, fields.outputRoot!);
      for (const file of files) await admittedArtifactFile(root, file);
    } catch { continue; }
    if(!await verifyCalibrationDependencies(root,facts.calibrationDependencies ?? []))continue;
    if (facts.angularResolutionBound && !requireArray(value.pins).some(raw => requireRecord(raw).path === facts.angularResolutionBound!.receipt)) continue;
    if (facts.resolutionEvidence?.some(evidence => evidence.receipt && !requireArray(value.pins).some(raw => {
      const pin = requireRecord(raw); return pin.path === evidence.receipt!.file;
    }))) continue;
    if (!facts.verified || facts.target !== target) continue;
    products.push({ target, telescope: fields.telescope!, mode: fields.mode!, observation: fields.observation!, program: fields.program!, product: fields.product!, receipt: fields.receipt!, productRecord: fields.productRecord!, outputRoot: fields.outputRoot!, facts });
  }
  return products;
}
export function matchingProduct(products: readonly QualifiedObservation[], request: CapabilityRequest, program: string) {
  return products.filter(product => product.program === program && assessInput(request, product.facts).status !== 'refused' && (!request.continuumMicrometres || assessInput(request, product.facts).constraints.wavelength?.answer === 'yes'))
    .sort((a, b) => Object.values(assessRequest(request, a.facts).constraints).filter(v => v.answer !== 'yes').length - Object.values(assessRequest(request, b.facts).constraints).filter(v => v.answer !== 'yes').length)[0];
}
