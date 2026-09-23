/** Native archive qualification reuses the same FITS and product-science owners as source products. */
import { dirname, resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { inspectFits } from '../qualify-source.mts';
import { readProductScience } from '../product-science.mts';
import { rememberQualification, type QualifiedObservation } from '../qualified-observations.mts';
import { readProductRecord, fileSize, writeProductRecord, type ProductRun } from '../../product-record.mts';
import { digest } from './contracts.mts';
import { acquireVoProduct, type AcquisitionSpec } from './access.mts';
import type { VoNetworkPolicy } from './network-policy.mts';

export async function qualifyVoProduct(root: string, spec: AcquisitionSpec, policy: VoNetworkPolicy = {}): Promise<QualifiedObservation> {
  const inField = spec.observation.target.status === 'in-field';
  if (spec.observation.target.status !== 'confirmed' && !inField || spec.observation.target.target !== spec.request.target || typeof spec.observation.rawTarget !== 'string')
    throw new Error('The selected archive record does not establish the requested target.');
  const circle = spec.request.region ?? spec.request.footprint;
  if (inField && !circle) throw new Error('An in-field archive record is qualified only against the circle that selected it.');
  if (spec.decoder !== 'fits-raster') throw new Error(`Archive ${spec.kind} is discoverable but has no native qualification route.`);
  const acquired = await acquireVoProduct(root, spec, policy), outputRoot = dirname(acquired.record), acquisition = await readProductRecord(acquired.record);
  if (!acquisition) throw new Error('Acquisition record is missing.');
  const content = JSON.parse(await readFile(resolve(outputRoot, 'content.json'), 'utf8')) as { schema?: unknown; archiveProposal?: { kind?: unknown; decoder?: unknown }; legacyRasterMember?: unknown; members?: readonly { member?: unknown; profile?: unknown; state?: unknown; reason?: unknown }[] };
  const legacyContent = content.schema === 'cssearth-vo-content@1';
  if (!legacyContent && content.schema !== 'cssearth-vo-content@2') throw new Error('Acquired VO content manifest is missing or unsupported. Reacquire the product.');
  if (!legacyContent && (content.archiveProposal?.kind !== spec.kind || content.archiveProposal.decoder !== spec.decoder)) throw new Error('Archive proposal changed after acquisition. Requery the product.');
  if (!acquired.file || content.legacyRasterMember !== 'science.fits' || spec.decoder !== 'fits-raster' || (spec.kind !== 'image' && spec.kind !== 'cube')) {
    const reasons = Array.isArray(content.members) ? content.members.map(member => typeof member.reason === 'string' ? member.reason : null).filter((reason): reason is string => reason !== null) : [];
    throw new Error(`The retained archive product is discoverable but not qualifiable by the legacy raster route.${reasons.length ? ` ${reasons.join(' ')}` : ''}`);
  }
  if (!acquisition.outputs.some(output => output.path === 'science.fits')) throw new Error('Legacy raster content has no pinned science FITS output.');
  const pin = await fileSize(acquired.file);
  if (!acquisition.outputs.some(p => p.path === 'science.fits' && p.bytes === pin.bytes)) throw new Error('Acquired bytes changed.');
  const decoded = inspectFits(await readFile(acquired.file), { OBJECT: spec.observation.rawTarget }, spec.kind);
  const archiveId = spec.operation.parameters.ID ?? spec.observation.identities.obs_publisher_did;
  if (typeof archiveId === 'string' && archiveId.startsWith('ivo://eso.org/ID?') && decoded.header.ARCFILE !== `${archiveId.slice('ivo://eso.org/ID?'.length)}.fits`)
    throw new Error('ESO archive product identity disagrees with the FITS ARCFILE header.');
  const facts = { target: spec.request.target, verified: true, kind: spec.kind, result: 'telescope-product' as const,
    ...await readProductScience(root, { file: acquired.file, format: 'fits', target: spec.request.target, decoded, ...(circle ? { region: circle } : {}) }) };
  // Field membership rests on the archive footprint until the product's own WCS puts usable pixels inside the circle.
  if (inField && !(facts.regionCoverage && facts.regionCoverage.usablePixelCenters > 0))
    throw new Error('The in-field product has no usable pixel centre inside the requested ICRS circle.');
  const receipt = resolve(outputRoot, 'qualification.json'), productRecord = resolve(outputRoot, 'qualified.product.json');
  await writeFile(receipt, `${JSON.stringify({ schema: 'cssearth-vo-qualification@1', acquisition: spec.key, artifact: pin, facts,
    identity: { target: spec.observation.target, headerObject: decoded.header.OBJECT, parent: spec.observation.identities },
    acceptance: `Pinned archive response, matching FITS OBJECT, supported native arrays and qualified product metadata.${inField ? ' The target is in the field: usable pixel centres of the product WCS lie inside the requested ICRS circle; the FITS OBJECT names the field, not the target.' : ''} No local recalibration, full-parent equivalence or request fulfillment is implied.` }, null, 2)}\n`);
  const run: ProductRun = { telescope: spec.observation.service, stage: 'native-product-qualification',
    inputs: [...acquisition.outputs.map(p => ({ role: 'acquired product and metadata', identity: p.path, bytes: p.bytes })),
      { role: 'acquisition record', identity: 'acquisition.json', ...await fileSize(acquired.record) }],
    parameters: { acquisition: spec.key, observation: { decoder: spec.decoder, kind: spec.kind, target: spec.request.target }, operation: spec.operation },
    software: [...acquisition.software, { name: 'cssEarth native product qualification', version: digest(await Promise.all(['./qualify.mts', '../product-science.mts', '../native-metadata.mts', '../calibration-dependencies.mts', '../../astronomy-packages/science.mts', '../../astronomy-packages/requirements.lock'].map(path => readFile(new URL(path, import.meta.url), 'utf8')))) }] };
  await writeProductRecord(productRecord, run, [...acquisition.outputs.map(p => ({ path: p.path, file: resolve(outputRoot, p.path) })),
    { path: 'acquisition.json', file: acquired.record }, { path: 'qualification.json', file: receipt },
    ...(facts.calibrationDependencies ?? []).flatMap(d => d.file ? [{ path: d.file, file: resolve(root, d.file) }] : [])],
    [{ kind: spec.operation.kind === 'soda-sync' ? 'archive-subset-origin' : 'archive-retrieval-origin', product: 'science.fits', receipt: 'origin.json',
      establishes: 'The selected archive service returned these bytes for this exact parent and operation. No recalibration, sample-equivalence or final calibration level is claimed.' }]);
  const result: QualifiedObservation = { target: spec.request.target, telescope: spec.observation.service, mode: `native-${spec.kind}`, observation: spec.observation.key,
    program: spec.key, product: acquired.file, receipt, productRecord, outputRoot, facts };
  await rememberQualification(root, result);
  return result;
}
