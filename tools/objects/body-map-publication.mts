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
import { definitionDigest, parseBodyMapProduct, type BodyMapProduct } from './body-map-product.mts';
import { parseProductRecord, productRecordPath, runDigest, sameRun, type ProductInput, type ProductRecord, type ProductRun, type ProductSoftware } from './product-record.mts';
import { loadQueryInputs, queryCapabilities, requestFromArguments, selectObservation, type ObservationSelection } from './telescopes/query.mts';

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
  readonly selection: Pick<ObservationSelection, 'telescope' | 'mode' | 'programme' | 'toolkitLevel' | 'unresolved'>;
  readonly map: { readonly metadata: string; readonly productRecord: string; readonly plane: string; readonly sha256: string;
    readonly quantity: string; readonly units: string; readonly definitionDigest: string };
  readonly observations: BodyMapProduct['observations'];
}

/** Verify the complete chain at publication time and return the small descriptor the body package can consume. */
export async function qualifyBodyMap(mapPath: string, selection: ObservationSelection): Promise<TelescopeLayer> {
  const metadataPath = resolve(mapPath), product = parseBodyMapProduct(JSON.parse(await readFile(metadataPath, 'utf8')) as unknown);
  const planePath = resolve(dirname(metadataPath), product.planes.file), expectedMetadata = `${planePath}.body-map.json`;
  if (metadataPath !== expectedMetadata) throw new Error(`The body-map record belongs at ${expectedMetadata}, beside the plane it names.`);
  const plane = await readFile(planePath);
  if (sha256(plane) !== product.planes.sha256) throw new Error(`${planePath} is not the plane pinned by ${metadataPath}.`);
  const recordPath = productRecordPath(planePath), record = parseProductRecord(JSON.parse(await readFile(recordPath, 'utf8')) as unknown);
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
  return { schema: TELESCOPE_LAYER_SCHEMA, target: selection.request.target, request: selection.request,
    selection: { telescope: selection.telescope, mode: selection.mode, programme: selection.programme, toolkitLevel: selection.toolkitLevel, unresolved: selection.unresolved },
    map: { metadata: basename(metadataPath), productRecord: basename(recordPath), plane: basename(planePath), sha256: product.planes.sha256,
      quantity: product.definition.quantity, units: product.definition.units, definitionDigest: definitionDigest(product.definition) }, observations: product.observations };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), telescope = flagValue(args, '--select-telescope'), mode = flagValue(args, '--select-mode'), programme = flagValue(args, '--program'), map = flagValue(args, '--map');
  if (!telescope || !mode || !programme || !map) throw new TypeError('Usage: body-map-publication.mts --target <id> --wavelength <from,to> [query constraints] --select-telescope <name> --select-mode <mode> --program <id> --map <map.fits.body-map.json> [--out <layer.json>]');
  const request = requestFromArguments(args), answer = queryCapabilities(request, await loadQueryInputs(resolve(import.meta.dirname, '../..'), request.target));
  const layer = await qualifyBodyMap(map, selectObservation(answer, telescope, mode, programme)), text = `${JSON.stringify(layer, null, 2)}\n`, out = flagValue(args, '--out');
  if (out) await writeFile(resolve(out), text); else process.stdout.write(text);
}
