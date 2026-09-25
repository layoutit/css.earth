import { inside, safeId, parseSourceProducts, sourceReceipt, sourceRecordComplete, assertPinnedLabel, type SourceProduct } from './source-product-contract.mts';
/** Package-owned observations enter the same query as archive holdings. Pins stay in the existing source manifest. */
import { intakeSources, type SourceIntakeIssue } from './source-intake.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { sha256File } from '@cssearth/core/node';
import { hasErrorCode, requireRecord } from '@cssearth/core';
import { fileSize, readProductRecord, sameRun, type ProductRun } from '../product-record.mts';
import { sourcePds3Observations } from '../pds/source-observations.mts';
import { parseProductFacts, type QualifiedObservation } from './qualified-observations.mts';
import { verifyCalibrationDependencies, type CalibrationDependency } from './calibration-dependencies.mts';
import type { ProductFacts } from './request-satisfaction.mts';
export interface LoadedSourceProduct extends SourceProduct { readonly qualified: boolean; readonly receipt: string; readonly receiptProblem?: string; readonly facts?: ProductFacts }
/** Authored implementation inputs hashed into every source-qualification receipt. */
export const SOURCE_RUN_FILES = ['source-intake.mts', 'source-product-contract.mts', 'source-transfer.mts', '../operations-acquisition.ts', '../source-files.ts', '../terrestrial-layers/isis3-raster.mts', 'source-products.mts', 'qualify-source.mts', 'observation-families.mts', 'product-descriptor.mts', 'families/common.mts', 'families/f16/f16-spherical-grid.mts', 'native-metadata.mts', 'product-science.mts', 'calibration-dependencies.mts', '../astronomy-packages/science.mts', '../astronomy-packages/requirements.lock', 'qualified-observations.mts', 'request-satisfaction.mts', '../../../packages/fits/src/fits.ts', '../../../packages/fits/src/node/file.ts', '../../../packages/fits/src/rice.ts', '../pds3-labels.mts', '../pds/source-observations.mts', '../pds-labels.mts', '../product-record.mts', '../astronomy-packages/pds-client.mts', '../astronomy-packages/pds-toolchain.json'] as const;
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

/** Adapt current source receipts to the common artifact contract without promoting declared science metadata. */
export function sourceQualifiedObservations(products: readonly LoadedSourceProduct[]): QualifiedObservation[] {
  return products.flatMap(product => product.qualified && product.facts ? [{ target: product.target, telescope: product.telescope, mode: product.mode,
    observation: product.id, program: product.id, product: product.files.find(file => file.role === 'science')!.path,
    receipt: product.receipt, productRecord: product.receipt, outputRoot: '.', facts: product.facts }] : []);
}
