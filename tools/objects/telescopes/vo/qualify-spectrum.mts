import { dirname, resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readFitsHdus } from '../../interferometry/fits-table.mts';
import { fileSize, writeProductRecord, type ProductRun, type ProductRecord } from '../../product-record.mts';
import { describeEsoSpectrum, readEsoSpectrum } from '../families/f03-eso-spectrum.mts';
import { rememberQualification, type QualifiedObservation } from '../qualified-observations.mts';
import { implementationFingerprint } from '../implementation-dependencies.mts';
import type { AcquisitionSpec } from './access.mts';

/** A supported SDP byte structure is required even when ObsCore advertised a spectrum. */
export async function qualifyEsoSpectrum(root: string, spec: AcquisitionSpec,
  acquired: { readonly file: string | null; readonly record: string }, acquisition: ProductRecord): Promise<QualifiedObservation> {
  if (!acquired.file) throw new Error('No direct FITS spectrum was acquired.');
  const bytes = await readFile(acquired.file), header = readFitsHdus(bytes)[0]!.header;
  if (header.OBJECT !== spec.observation.rawTarget) throw new Error('FITS identity mismatch for OBJECT.');
  const archiveId = spec.observation.identities.obs_publisher_did;
  if (typeof archiveId === 'string' && archiveId.startsWith('ivo://eso.org/ID?') &&
    header.ARCFILE !== `${archiveId.slice('ivo://eso.org/ID?'.length)}.fits`) throw new Error('ESO ARCFILE identity mismatch.');
  const source = readEsoSpectrum(bytes), outputRoot = dirname(acquired.record), artifact = await fileSize(acquired.file);
  const descriptor = describeEsoSpectrum(spec.key, spec.request.target, source);
  const facts = { target: spec.request.target, verified: true, kind: 'spectrum' as const, result: 'telescope-product' as const };
  // Sample centres do not establish continuous wavelength coverage or bin bounds.
  const receipt = resolve(outputRoot, 'qualification.json'), descriptorFile = resolve(outputRoot, 'descriptor.json'), productRecord = resolve(outputRoot, 'qualified.product.json');
  await writeFile(descriptorFile, `${JSON.stringify(descriptor, null, 2)}\n`);
  await writeFile(receipt, `${JSON.stringify({ schema: 'cssearth-vo-qualification@1', acquisition: spec.key, artifact, facts,
    identity: { target: spec.observation.target, headerObject: header.OBJECT, parent: spec.observation.identities },
    spectrum: { nativeSamples: source.nativeSamples, usableSamples: source.samples.length, excludedSamples: source.excludedSamples,
      wavelengthUnit: source.wavelengthUnit, fluxUnit: source.fluxUnit, spectralFrame: source.spectralFrame, fluxCalibration: source.fluxCalibration,
      usableSampleCentresMicrometres: [source.samples[0]!.wavelength, source.samples.at(-1)!.wavelength].map(value => value * source.wavelengthToMicrometres) },
    acceptance: 'Archive target and FITS identity agree. ESO SDP WAVE/FLUX/ERR and optional QUAL are decoded by F03. Nonzero flags, nonfinite flux and nonpositive/nonfinite error are excluded with native IDs and gap boundaries retained. Archive calibration is declared, not independently reproduced. Continuous spectral coverage, achieved resolution and request fulfillment remain unverified.' }, null, 2)}\n`);
  const implementation = await implementationFingerprint(resolve(import.meta.dirname, '../../../..'), [fileURLToPath(import.meta.url)]);
  const run: ProductRun = { telescope: spec.observation.service, stage: 'native-product-qualification',
    inputs: [...acquisition.outputs.map(output => ({ role: 'acquired product and metadata', identity: output.path, bytes: output.bytes })),
      { role: 'acquisition record', identity: 'acquisition.json', ...await fileSize(acquired.record) }],
    parameters: { acquisition: spec.key, observation: { decoder: spec.decoder, kind: spec.kind, target: spec.request.target }, operation: spec.operation, family: 'F03', hdu: source.hdu },
    software: [...acquisition.software, { name: 'cssEarth VO ESO SDP spectrum qualification', version: implementation.sha256 }] };
  await writeProductRecord(productRecord, run, [...acquisition.outputs.map(output => ({ path: output.path, file: resolve(outputRoot, output.path) })),
    { path: 'acquisition.json', file: acquired.record }, { path: 'qualification.json', file: receipt }, { path: 'descriptor.json', file: descriptorFile }],
    [{ kind: 'archive-retrieval-origin', product: 'science.fits', receipt: 'origin.json', establishes: 'Exact selected archive spectrum; no local recalibration or resolved planetary surface.' }]);
  const result: QualifiedObservation = { target: spec.request.target, telescope: spec.observation.service, mode: 'native-spectrum', observation: spec.observation.key,
    program: spec.key, product: acquired.file, receipt, productRecord, outputRoot, facts };
  await rememberQualification(root, result);
  return result;
}
