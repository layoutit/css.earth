#!/usr/bin/env node
/** Bind one scientific question and selected archive program to the exact body-map bytes published for it.
 *
 * The instrument-specific stages still do the science. This module supplies the missing boundary between them: a body map is
 * publishable only when its plane and metadata are outputs of one current product record, and when its observations name the
 * exact ledger mode and pinned program selected by the capability query. */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '../../src/platform/sha256.mts';
import { flagValue } from '../cli-arguments.mts';
import { hasErrorCode } from '../source-values.mts';
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

export interface TelescopeLayer {
  readonly schema: typeof TELESCOPE_LAYER_SCHEMA;
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
  const intervals = product.definition.wavelengthIntervalsMicrometres;
  if (!intervals?.length) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the map does not state the wavelength intervals its measurement used.`);
  const ordered = [...intervals].sort((a, b) => a[0] - b[0]), [askedFrom, askedTo] = request.wavelengthMicrometres;
  let coveredTo = askedFrom, started = false;
  for (const [from, to] of ordered) if (from <= coveredTo && to >= askedFrom) { coveredTo = Math.max(coveredTo, to); started = true; }
  if (!started || coveredTo < askedTo) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the map measurement covers ${ordered.map(([from, to]) => `${from} to ${to}`).join(', ')} micrometres; the question requires ${askedFrom} to ${askedTo}.`);
  resolved.observationWavelength = { answer: 'yes', reason: `The published map measurement covers the requested ${askedFrom} to ${askedTo} micrometres.` };
  if (request.angularResolutionArcsec !== undefined) {
    const worst = Math.max(...observations.map(observation => observation.angularResolution.majorArcsec));
    if (worst > request.angularResolutionArcsec) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the map's measured resolution is ${worst.toPrecision(3)} arcsec; the question requires ${request.angularResolutionArcsec} arcsec or better.`);
    resolved.angularResolution = { answer: 'yes', reason: `The published map's measured worst-axis resolution is ${worst.toPrecision(3)} arcsec, within the requested ${request.angularResolutionArcsec} arcsec.` };
  }
  if (request.surfaceResolutionKm !== undefined) {
    const worst = Math.max(...observations.map(observation => surfaceResolutionKm(observation).majorKm));
    if (worst > request.surfaceResolutionKm) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the map's measured surface resolution is ${worst.toPrecision(3)} km at the sub-observer point; the question requires ${request.surfaceResolutionKm} km or better.`);
    resolved.surfaceResolution = { answer: 'yes', reason: `The published map's measured worst-axis surface resolution is ${worst.toPrecision(3)} km at the sub-observer point, within the requested ${request.surfaceResolutionKm} km.` };
  }
  if (request.resolutionElements !== undefined) {
    const fewest = Math.min(...observations.map(observation => resolutionElementsAcrossDisc(observation, product.frame.radiusKm)));
    if (fewest < request.resolutionElements) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: the map has ${fewest.toPrecision(3)} measured resolution elements across the disc; the question requires at least ${request.resolutionElements}.`);
    resolved.resolutionElements = { answer: 'yes', reason: `The published map has at least ${fewest.toPrecision(3)} measured resolution elements across the disc, meeting the requested ${request.resolutionElements}.` };
  }
  if (request.time && !('any' in request.time)) {
    const from = Date.parse(request.time.fromIso) / 86_400_000 + 2_440_587.5, to = Date.parse(request.time.toIso) / 86_400_000 + 2_440_587.5;
    const outside = observations.find(observation => observation.midTimeJd < from || observation.midTimeJd > to);
    if (outside) throw new RangeError(`Cannot publish ${selection.telescope} ${selection.mode} program ${selection.programme}: observation ${outside.id} is outside the requested time range.`);
    resolved.time = { answer: 'yes', reason: 'Every observation in the published map is inside the requested time range.' };
  }
  return resolved;
}

/** Verify the complete chain at publication time and return the small descriptor the body package can consume. */
export async function qualifyBodyMap(mapPath: string, selection: ObservationSelection): Promise<TelescopeLayer> {
  const metadataPath = resolve(mapPath), product = parseBodyMapProduct(JSON.parse((await publicationFile(metadataPath, selection, 'body-map metadata')).toString('utf8')) as unknown);
  const planePath = resolve(dirname(metadataPath), product.planes.file), expectedMetadata = `${planePath}.body-map.json`;
  if (metadataPath !== expectedMetadata) throw new Error(`The body-map record belongs at ${expectedMetadata}, beside the plane it names.`);
  const plane = await publicationFile(planePath, selection, 'map plane');
  if (sha256(plane) !== product.planes.sha256) throw new Error(`${planePath} is not the plane pinned by ${metadataPath}.`);
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
  const resolvedConstraints = assertMapAnswersRequest(product, selection), resolvedNames = new Set(Object.keys(resolvedConstraints));
  return { schema: TELESCOPE_LAYER_SCHEMA, target: selection.request.target, request: selection.request,
    selection: { telescope: selection.telescope, mode: selection.mode, programme: selection.programme, toolkitLevel: selection.toolkitLevel,
      constraints: { ...selection.constraints, ...resolvedConstraints }, bodyMapSupport: selection.bodyMapSupport,
      unresolved: selection.unresolved.filter(item => !resolvedNames.has(item.constraint)) },
    map: { metadata: basename(metadataPath), productRecord: basename(recordPath), plane: basename(planePath), sha256: product.planes.sha256,
      quantity: product.definition.quantity, units: product.definition.units, definitionDigest: definitionDigest(product.definition) }, observations: product.observations };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), telescope = flagValue(args, '--select-telescope'), mode = flagValue(args, '--select-mode'), programme = flagValue(args, '--program'), map = flagValue(args, '--map');
  if (!telescope || !mode || !programme || !map) throw new TypeError('Usage: body-map-publication.mts --target <id> --wavelength <from,to> --kind <kind> (--from <ISO> --to <ISO> | --any-time) (--min-arcsec <N> | --min-km <N> | --min-elements <N>) --result body-map --select-telescope <name> --select-mode <mode> --program <id> --map <map.fits.body-map.json> [--out <layer.json>]');
  const request = requestFromArguments(args), answer = queryCapabilities(request, await loadQueryInputs(resolve(import.meta.dirname, '../..'), request.target));
  const layer = await qualifyBodyMap(map, selectObservation(answer, telescope, mode, programme)), text = `${JSON.stringify(layer, null, 2)}\n`, out = flagValue(args, '--out');
  if (out) await writeFile(resolve(out), text); else process.stdout.write(text);
}
