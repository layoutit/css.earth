#!/usr/bin/env node
import { selectedProductInput } from './telescopes/selected-product.mts';
import { assessRequest, summarizeSatisfaction, type RequestSatisfaction } from './telescopes/request-satisfaction.mts';
/** Bind one scientific question and selected archive program to the exact body-map bytes published for it.
 *
 * The instrument-specific stages still do the science. This module supplies the missing boundary between them: a body map is
 * publishable only when its plane and metadata are outputs of one current product record, and when its observations name the
 * exact ledger mode and pinned program selected by the capability query. */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '../../src/platform/sha256.mts';
import { flagValue } from '../cli/cli-arguments.mts';
import { hasErrorCode, requireRecord, requireArray } from '../sources/source-values.mts';
import { supportsMeasuredResolution } from './resolution-evidence.mts';
import { readFitsHdus, fitsImageAccessor } from '../fits/fits.mts';
import { definitionDigest, parseBodyMapProduct, resolutionElementsAcrossDisc, surfaceResolutionKm, type BodyMapProduct } from './body-map-product.mts';
import { parseProductRecord, productRecordPath, runDigest, sameRun, type ProductInput, type ProductRecord, type ProductRun, type ProductSoftware } from './product-record.mts';
import { loadQueryInputs, queryCapabilities, requestFromArguments, selectObservation, type ConstraintVerdict, type ObservationSelection } from './telescopes/query.mts';

export const BODY_MAP_PUBLICATION_STAGE = 'body-map';
export const TELESCOPE_LAYER_SCHEMA = 'cssearth-telescope-layer@1';

const bodyMapTelescope = (product: BodyMapProduct): string => {
  const names = [...new Set(product.observations.map(observation => observation.telescope))];
  return names.length === 1 ? names[0]! : names.sort().join('+');
};

/** The run identity of a finished map. The product's meaning and every selected observation are parameters; the files it read
 * are inputs. A changed definition, frame, grid, mask, program or observation therefore invalidates the record. */
export function bodyMapRun(product: BodyMapProduct, inputs: readonly ProductInput[], software: readonly ProductSoftware[], toolchainDigest?: string): ProductRun {
  return { telescope: bodyMapTelescope(product), stage: BODY_MAP_PUBLICATION_STAGE, inputs,
    parameters: { definitionDigest: definitionDigest(product.definition), definition: product.definition, frame: product.frame, grid: product.grid,
      mask: product.mask, observations: product.observations, combination: product.combination ?? null }, software,
    ...(toolchainDigest === undefined ? {} : { toolchainDigest }) };
}

/** Build the deterministic record an author writes beside `<map>.fits`. The author supplies the exact input pins it read. */
export function bodyMapProductRecord(product: BodyMapProduct, plane: Buffer, metadata: Buffer, inputs: readonly ProductInput[],
  software: readonly ProductSoftware[], toolchainDigest?: string,
  extraOutputs: readonly { readonly path: string; readonly bytes: Buffer; readonly units?: string; readonly conventions?: Readonly<Record<string, string>> }[] = []): ProductRecord {
  const planeName = product.planes.file, metadataName = `${planeName}.body-map.json`;
  return parseProductRecord({ schema: 'cssearth-telescope-product@1', ...bodyMapRun(product, inputs, software, toolchainDigest),
    outputs: [{ path: planeName, bytes: plane.byteLength, sha256: sha256(plane), units: product.definition.units },
      { path: metadataName, bytes: metadata.byteLength, sha256: sha256(metadata), conventions: { schema: product.schema } },
      ...extraOutputs.map(output => ({ path: output.path, bytes: output.bytes.byteLength, sha256: sha256(output.bytes),
        ...(output.units === undefined ? {} : { units: output.units }), ...(output.conventions === undefined ? {} : { conventions: output.conventions }) }))], evidence: [] });
}

export const formatProductRecord = (record: ProductRecord): string => `${JSON.stringify(parseProductRecord(record), null, 2)}\n`;

/** Called after an author's actual fit or calibrated beam extraction. This receipt
 * is an output of the same run as the map, bound to the same input pins. */
export function bindMapResolution(product: BodyMapProduct, kind: 'measured' | 'calibrated', method: string, diagnostics: unknown) {
  const path = `${product.planes.file}.resolution.json`;
  const bytes = Buffer.from(`${JSON.stringify({ schema: 'cssearth-map-resolution@1', target: product.frame.body, kind, method,
    observations: product.observations.map(o => ({ id: o.id, majorArcsec: o.angularResolution.majorArcsec, minorArcsec: o.angularResolution.minorArcsec })), diagnostics }, null, 2)}\n`);
  return { product: { ...product, observations: product.observations.map(o => ({ ...o, angularResolution: { ...o.angularResolution,
    evidence: { kind, receipt: { file: path, sha256: sha256(bytes) } } } })) }, output: { path, bytes } };
}

export function assertBodyMapPlanes(bytes: Buffer, product: BodyMapProduct): void {
  const hdus = readFitsHdus(bytes);
  const plane = (name: string) => {
    const matches = hdus.filter(hdu => hdu.header.EXTNAME === name);
    if (matches.length !== 1) throw new Error(`Body map needs exactly one ${name} plane.`);
    const hdu = matches[0]!;
    if (hdu.dimensions.length !== 2 || hdu.dimensions[0] !== product.grid.width || hdu.dimensions[1] !== product.grid.height || ![-32, -64].includes(hdu.bitpix)) throw new Error(`${name}: body-map grid or floating missing-value convention mismatch.`);
    if ((hdu.header.BUNIT ?? hdu.header.UNITS) !== product.definition.units) throw new Error(`${name}: body-map units mismatch.`);
    return fitsImageAccessor(bytes, hdu);
  };
  const value = plane(product.planes.value), error = plane(product.planes.uncertainty);
  let measured = 0;
  for (let i = 0; i < product.grid.width * product.grid.height; i++) {
    const v = value(i), e = error(i);
    if (Number.isNaN(v) && Number.isNaN(e)) continue;
    if (!Number.isFinite(v) || !Number.isFinite(e) || e < 0) throw new Error('Body-map values and nonnegative uncertainties must share a finite/NaN mask.');
    measured++;
  }
  if (!measured) throw new Error('Body map has no measured cells.');
}

export interface TelescopeLayer {
  readonly schema: typeof TELESCOPE_LAYER_SCHEMA;
  readonly satisfaction: RequestSatisfaction;
  readonly target: string;
  readonly request: ObservationSelection['request'];
  readonly selection: Pick<ObservationSelection, 'telescope' | 'mode' | 'programme' | 'toolkitLevel' | 'constraints' | 'bodyMapSupport' | 'unresolved'>;
  readonly map: { readonly metadata: string; readonly productRecord: string; readonly plane: string; readonly sha256: string;
    readonly quantity: string; readonly units: string; readonly definitionDigest: string };
  readonly observations: BodyMapProduct['observations'];
}

const publicationFile = async (path: string, selection: ObservationSelection, artifact: string): Promise<Buffer> => readFile(path).catch((error: unknown) => {
  if (!hasErrorCode(error, 'ENOENT')) throw error;
  throw new Error(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the ${artifact} is missing at ${path}. A publishable body-map route writes the map plane, its *.body-map.json metadata and the plane's *.product.json record.`);
});

/** The mode-level query can only say whether an observation might satisfy a requested resolution. Publication has the
 * measured beam/PSF and exact epoch, so this is where a partial answer becomes a definite yes or no. */
export function assertMapAnswersRequest(product: BodyMapProduct, selection: ObservationSelection): Record<string, ConstraintVerdict> {
  const { request } = selection, observations = product.observations, resolved: Record<string, ConstraintVerdict> = {};
  if (request.continuumMicrometres && (product.definition.method.kind !== 'band-depth' || JSON.stringify(product.definition.method.bandMicrometres) !== JSON.stringify(request.wavelengthMicrometres) || JSON.stringify(product.definition.method.continuumMicrometres) !== JSON.stringify(request.continuumMicrometres))) throw new Error('Published estimator does not match the requested band and continuum windows.');
  const measured = observations.every(o => supportsMeasuredResolution(o.angularResolution.evidence));
  const unsupported: ConstraintVerdict = { answer: 'unknown', reason: 'Not every observation has measured or calibrated resolution evidence; a number or prose basis is insufficient.' };
  const intervals = product.definition.wavelengthIntervalsMicrometres;
  if (!intervals?.length) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the map does not state the wavelength intervals its measurement used.`);
  const ordered = [...intervals].sort((a, b) => a[0] - b[0]), [askedFrom, askedTo] = request.wavelengthMicrometres;
  let coveredTo = askedFrom, started = false;
  for (const [from, to] of ordered) if (from <= coveredTo && to >= askedFrom) { coveredTo = Math.max(coveredTo, to); started = true; }
  if (!started || coveredTo < askedTo) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the map measurement covers ${ordered.map(([from, to]) => `${from} to ${to}`).join(', ')} micrometres; the question requires ${askedFrom} to ${askedTo}.`);
  resolved.observationWavelength = { answer: 'yes', reason: `The published map measurement covers the requested ${askedFrom} to ${askedTo} micrometres.` };
  if (request.angularResolutionArcsec !== undefined && !measured) resolved.angularResolution = unsupported;
  else if (request.angularResolutionArcsec !== undefined) {
    const worst = Math.max(...observations.map(observation => observation.angularResolution.majorArcsec));
    if (worst > request.angularResolutionArcsec) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the map's measured resolution is ${worst.toPrecision(3)} arcsec; the question requires ${request.angularResolutionArcsec} arcsec or better.`);
    resolved.angularResolution = { answer: 'yes', reason: `The published map's measured worst-axis resolution is ${worst.toPrecision(3)} arcsec, within the requested ${request.angularResolutionArcsec} arcsec.` };
  }
  if (request.surfaceResolutionKm !== undefined && !measured) resolved.surfaceResolution = unsupported;
  else if (request.surfaceResolutionKm !== undefined) {
    const worst = Math.max(...observations.map(observation => surfaceResolutionKm(observation).majorKm));
    if (worst > request.surfaceResolutionKm) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the map's measured surface resolution is ${worst.toPrecision(3)} km at the sub-observer point; the question requires ${request.surfaceResolutionKm} km or better.`);
    resolved.surfaceResolution = { answer: 'yes', reason: `The published map's measured worst-axis surface resolution is ${worst.toPrecision(3)} km at the sub-observer point, within the requested ${request.surfaceResolutionKm} km.` };
  }
  if (request.resolutionElements !== undefined && !measured) resolved.resolutionElements = unsupported;
  else if (request.resolutionElements !== undefined) {
    const fewest = Math.min(...observations.map(observation => resolutionElementsAcrossDisc(observation, product.frame.radiusKm)));
    if (fewest < request.resolutionElements) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the map has ${fewest.toPrecision(3)} measured resolution elements across the disc; the question requires at least ${request.resolutionElements}.`);
    resolved.resolutionElements = { answer: 'yes', reason: `The published map has at least ${fewest.toPrecision(3)} measured resolution elements across the disc, meeting the requested ${request.resolutionElements}.` };
  }
  if (request.time && !('any' in request.time)) {
    const fromMs = Date.parse(request.time.fromIso), toMs = Date.parse(request.time.toIso);
    const from = fromMs / 86_400_000 + 2_440_587.5, to = toMs / 86_400_000 + 2_440_587.5;
    const outside = observations.find(o => o.startIso && o.endIso ? Date.parse(o.startIso)<fromMs || Date.parse(o.endIso)>toMs : o.midTimeJd < from || o.midTimeJd > to || (o.startTimeJd !== undefined && o.startTimeJd < from) || (o.endTimeJd !== undefined && o.endTimeJd > to));
    if (outside) throw new RangeError(`Cannot publish: observation ${outside.id} is outside the requested time range.`);
    resolved.time = observations.every(o => o.startIso !== undefined && o.endIso !== undefined || o.startTimeJd !== undefined && o.endTimeJd !== undefined)
      ? { answer: 'yes', reason: 'Every complete observation interval is inside the requested time range.' }
      : { answer: 'unknown', reason: 'Observation midpoints or summed integration times do not establish the complete time interval.' };
  }
  return resolved;
}

/** Verify the complete chain at publication time and return the small descriptor the body package can consume. */
export async function qualifyBodyMap(mapPath: string, selection: ObservationSelection, root = resolve(import.meta.dirname, '../..')): Promise<TelescopeLayer> {
  const metadataPath = resolve(mapPath), product = parseBodyMapProduct(JSON.parse((await publicationFile(metadataPath, selection, 'body-map metadata')).toString('utf8')) as unknown);
  const planePath = resolve(dirname(metadataPath), product.planes.file), expectedMetadata = `${planePath}.body-map.json`;
  if (metadataPath !== expectedMetadata) throw new Error(`The body-map record belongs at ${expectedMetadata}, beside the plane it names.`);
  const plane = await publicationFile(planePath, selection, 'map plane');
  assertBodyMapPlanes(plane, product);
  const recordPath = productRecordPath(planePath), record = parseProductRecord(JSON.parse((await publicationFile(recordPath, selection, 'product record')).toString('utf8')) as unknown);
  if (!await sameRun(record, record, output => resolve(dirname(planePath), output))) throw new Error(`${recordPath} does not describe the output bytes on disk now.`);
  const expectedRun = bodyMapRun(product, record.inputs, record.software, record.toolchainDigest);
  if (runDigest(record) !== runDigest(expectedRun)) throw new Error(`${recordPath} does not bind the current map definition, frame, observations and combination policy.`);
  for (const [path, bytes] of [[basename(planePath), plane], [basename(metadataPath), await readFile(metadataPath)]] as const) {
    const output = record.outputs.find(entry => entry.path === path);
    if (!output || output.bytes !== bytes.byteLength || output.sha256 !== sha256(bytes)) throw new Error(`${recordPath} does not pin its ${path} output.`);
  }
  if (product.frame.body !== selection.request.target) throw new Error(`${metadataPath} maps ${product.frame.body}, not the selected target ${selection.request.target}.`);
  const matched = product.observations.filter(observation => observation.telescope === selection.telescope && observation.mode === selection.mode && observation.programme === selection.programme);
  if (!matched.length) throw new Error(`${metadataPath} names no ${selection.telescope} ${selection.mode} observation from ${selection.programme}.`);
  const incomplete = product.observations.filter(observation => !observation.mode || !observation.programme);
  if (incomplete.length) throw new Error(`${metadataPath} has ${incomplete.length} observation(s) without an exact ledger mode and program.`);
  for (const observation of product.observations) {
    const evidence = observation.angularResolution.evidence;
    if (!supportsMeasuredResolution(evidence)) continue;
    const pin = evidence!.receipt!, output = record.outputs.find(entry => entry.path === pin.file);
    if (!output || output.sha256 !== pin.sha256) throw new Error('Resolution evidence is not pinned as an output of this map run.');
    const receipt = requireRecord(JSON.parse(await readFile(resolve(dirname(planePath), pin.file), 'utf8')));
    const row = requireArray(receipt.observations).map(value => requireRecord(value)).find(row => row.id === observation.id);
    if (receipt.schema !== 'cssearth-map-resolution@1' || receipt.target !== product.frame.body || receipt.kind !== evidence!.kind ||
      !row || row.majorArcsec !== observation.angularResolution.majorArcsec || row.minorArcsec !== observation.angularResolution.minorArcsec)
      throw new Error('Resolution receipt does not establish this observation and its beam axes.');
  }
  const selected = selection.product ? await selectedProductInput(root, selection) : undefined;
  if (selected && !record.inputs.some(i => i.identity === selected.input.identity && i.sha256 === selected.input.sha256 && i.bytes === selected.input.bytes)) throw new Error('Map did not consume the exact selected qualified artifact.');
  const resolvedConstraints = assertMapAnswersRequest(product, selection), resolvedNames = new Set(Object.keys(resolvedConstraints));
  const satisfaction = assessRequest(selection.request, { verified: true, target: product.frame.body, result: 'body-map', ...(selected?.facts.kind ? { kind: selected.facts.kind } : {}),
      wavelengthIntervalsMicrometres: product.definition.wavelengthIntervalsMicrometres,
      resolutionEvidence: product.observations.map(o => o.angularResolution.evidence ?? { kind: 'unknown' }),
      ...(product.observations.every(o => o.startIso && o.endIso) ? {
        startIso: product.observations.map(o=>o.startIso!).sort()[0]!, endIso: product.observations.map(o=>o.endIso!).sort().at(-1)!
      } : {}),
      angularResolutionArcsec: Math.max(...product.observations.map(observation => observation.angularResolution.majorArcsec)),
      surfaceResolutionKm: Math.max(...product.observations.map(observation => surfaceResolutionKm(observation).majorKm)),
      resolutionElements: Math.min(...product.observations.map(observation => resolutionElementsAcrossDisc(observation, product.frame.radiusKm))) });
  return { schema: TELESCOPE_LAYER_SCHEMA, satisfaction: resolvedConstraints.time ? summarizeSatisfaction({ ...satisfaction.constraints, time: resolvedConstraints.time }) : satisfaction, target: selection.request.target, request: selection.request,
    selection: { telescope: selection.telescope, mode: selection.mode, programme: selection.programme, toolkitLevel: selection.toolkitLevel,
      constraints: { ...selection.constraints, ...resolvedConstraints }, bodyMapSupport: selection.bodyMapSupport,
      unresolved: [...selection.unresolved.filter(item => !resolvedNames.has(item.constraint)),
        ...Object.entries(resolvedConstraints).flatMap(([constraint, verdict]) => verdict.answer === 'unknown' || verdict.answer === 'partial' ? [{ constraint, answer: verdict.answer, reason: verdict.reason }] : [])] },
    map: { metadata: basename(metadataPath), productRecord: basename(recordPath), plane: basename(planePath), sha256: sha256(plane),
      quantity: product.definition.quantity, units: product.definition.units, definitionDigest: definitionDigest(product.definition) }, observations: product.observations };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), telescope = flagValue(args, '--select-telescope'), mode = flagValue(args, '--select-mode'), programme = flagValue(args, '--program'), map = flagValue(args, '--map');
  if (!telescope || !mode || !programme || !map) throw new TypeError('Usage: body-map-publication.mts --target <id> --wavelength <from,to> --kind <kind> (--from <ISO> --to <ISO> | --any-time) (--min-arcsec <N> | --min-km <N> | --min-elements <N>) --result body-map --select-telescope <name> --select-mode <mode> --program <id> --map <map.fits.body-map.json> [--out <layer.json>]');
  const request = requestFromArguments(args), answer = queryCapabilities(request, await loadQueryInputs(resolve(import.meta.dirname, '../..'), request.target));
  const layer = await qualifyBodyMap(map, selectObservation(answer, telescope, mode, programme)), text = `${JSON.stringify(layer, null, 2)}\n`, out = flagValue(args, '--out');
  if (out) await writeFile(resolve(out), text); else process.stdout.write(text);
}
