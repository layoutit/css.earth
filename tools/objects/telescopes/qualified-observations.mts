/** Durable result of the public qualifier. A small index of exact local artifacts, not an archive ledger. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { sha256, sha256File } from '../../../src/platform/sha256.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber, hasErrorCode } from '../../source-values.mts';
import { readProductRecord, sameRun } from '../product-record.mts';
import { assessRequest, type ProductFacts } from './request-satisfaction.mts';
import type { CapabilityRequest } from './query.mts';

export interface QualifiedObservation {
  readonly target: string; readonly telescope: string; readonly mode: string; readonly observation: string; readonly program: string;
  readonly product: string; readonly receipt: string; readonly productRecord: string; readonly outputRoot: string;
  readonly facts: ProductFacts;
}
export function parseProductFacts(raw: unknown): ProductFacts {
  const value = requireRecord(raw, 'product facts');
  if (typeof value.verified !== 'boolean') throw new TypeError('Product verification must be explicit.');
  const facts: { -readonly [K in keyof ProductFacts]: ProductFacts[K] } = { target: requireString(value.target, 'product target'), verified: value.verified };
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
  return facts;
}
const implementation = async () => sha256(await readFile(new URL('./qualify.mts', import.meta.url)));
export async function rememberQualification(root: string, result: QualifiedObservation): Promise<void> {
  const locations = Object.fromEntries((['product', 'receipt', 'productRecord', 'outputRoot'] as const).map(key => [key, relative(root, resolve(root, result[key]))]));
  const pins = await Promise.all([result.product, result.receipt, result.productRecord].map(async file => ({ path: relative(root, resolve(root, file)), ...(await sha256File(resolve(root, file))) })));
  const value = { ...result, ...locations, schema: 'cssearth-qualified-observation@1', facts: parseProductFacts(result.facts), implementation: await implementation(), pins };
  const text = `${JSON.stringify(value, null, 2)}\n`, directory = resolve(root, 'output/telescopes', result.target, 'qualifications');
  await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, `${sha256(text)}.json`), text);
}
export async function loadQualifiedObservations(root: string, target: string): Promise<QualifiedObservation[]> {
  const directory = resolve(root, 'output/telescopes', target, 'qualifications');
  const names = await readdir(directory).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return []; throw error; });
  const version = await implementation(), products: QualifiedObservation[] = [];
  for (const name of names.filter(name => name.endsWith('.json')).sort()) {
    const text = await readFile(resolve(directory, name), 'utf8');
    if (name !== `${sha256(text)}.json`) continue;
    const value = requireRecord(JSON.parse(text), 'qualified observation');
    if (value.schema !== 'cssearth-qualified-observation@1' || value.target !== target || value.implementation !== version) continue;
    let current = true;
    for (const raw of requireArray(value.pins, 'qualified pins')) {
      const pin = requireRecord(raw), found = await sha256File(resolve(root, requireString(pin.path))).catch(() => null);
      if (!found || found.bytes !== pin.bytes || found.sha256 !== pin.sha256) current = false;
    }
    if (!current) continue;
    const fields = Object.fromEntries(['target', 'telescope', 'mode', 'observation', 'program', 'product', 'receipt', 'productRecord', 'outputRoot'].map(key => [key, requireString(value[key], key)]));
    const record = await readProductRecord(resolve(root, fields.productRecord!));
    if (!record || !await sameRun(record, record, name => resolve(root, fields.outputRoot!, name))) continue;
    if (!record.outputs.some(output => resolve(root, fields.outputRoot!, output.path) === resolve(root, fields.product!))) continue;
    const facts = parseProductFacts(value.facts);
    if (!facts.verified || facts.target !== target) continue;
    products.push({ target, telescope: fields.telescope!, mode: fields.mode!, observation: fields.observation!, program: fields.program!, product: fields.product!, receipt: fields.receipt!, productRecord: fields.productRecord!, outputRoot: fields.outputRoot!, facts });
  }
  return products;
}
export function matchingProduct(products: readonly QualifiedObservation[], request: CapabilityRequest, program: string) {
  return products.filter(product => product.program === program && assessRequest({ ...request, result: 'telescope-product' }, product.facts).status !== 'refused')
    .sort((a, b) => Object.values(assessRequest(request, a.facts).constraints).filter(v => v.answer !== 'yes').length - Object.values(assessRequest(request, b.facts).constraints).filter(v => v.answer !== 'yes').length)[0];
}
