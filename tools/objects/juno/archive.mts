#!/usr/bin/env node
/** JunoCam in the PDS: read a volume's index, and pin the calibrated colour images of one target as a program.
 *
 *   node tools/objects/juno/archive.mts <program id> <volume> <target> <naif id> <body frame> [--orbit <n>]
 *   node tools/objects/juno/archive.mts europa-pj45 JNOJNC_0024 EUROPA 502 IAU_EUROPA --orbit 45
 *
 * The PDS Cartography and Imaging Sciences Node serves JunoCam as numbered volumes, each with a fixed-format index of its
 * products. A program names the images of one target by URL and size; the measuring tool adds each file's digest the first
 * time it holds the bytes. Only calibrated products (RDR) whose filter combination includes red, green and blue are pinned,
 * because those are what the `junocam-camera` format reads. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const VOLUMES = 'https://planetarydata.jpl.nasa.gov/img/data/juno/';
export const PROGRAMS = resolve(import.meta.dirname, 'programs');
export const PROGRAM_SCHEMA = 'cssearth-junocam-program@1';
/** The kernel bank and the kernels a JunoCam camera reads, in load order. The trajectory and attitude kernels cover one perijove each, so a program names its own. */
export const KERNEL_SET = 'juno';

/** The index table's columns, in the order INDEX.LBL lists them. */
export const INDEX_COLUMNS = ['VOLUME_ID', 'STANDARD_DATA_PRODUCT_ID', 'DATA_SET_ID', 'PRODUCT_ID', 'START_TIME', 'STOP_TIME', 'PROCESSING_LEVEL_ID', 'RATIONALE_DESC', 'SOLAR_DISTANCE',
  'SPACECRAFT_ALTITUDE', 'SUB_SPACECRAFT_LATITUDE', 'SUB_SPACECRAFT_LONGITUDE', 'TARGET_NAME', 'FILE_SPECIFICATION_NAME', 'PRODUCT_CREATION_TIME', 'PRODUCT_LABEL_MD5CHECKSUM'] as const;
export type IndexRow = Record<typeof INDEX_COLUMNS[number], string>;

/** The filter combination a product id states (product SIS, appendix B), as the strips the image holds. P and H are global map products, not images. */
export const FILTER_COMBINATIONS: Readonly<Record<string, readonly string[]>> = { A: ['RED', 'GREEN', 'BLUE', 'METHANE'], B: ['BLUE'], C: ['RED', 'GREEN', 'BLUE'], G: ['GREEN'], M: ['METHANE'], R: ['RED'], T: ['RED', 'BLUE'] };

/** One line of a volume's INDEX.TAB: comma-separated, text fields quoted and padded, numbers followed by their unit. */
export function parseIndexLine(line: string): IndexRow {
  const fields: string[] = [];
  let field = '', quoted = false;
  for (const c of line) { if (c === '"') quoted = !quoted; else if (c === ',' && !quoted) { fields.push(field); field = ''; } else field += c; }
  fields.push(field);
  if (quoted || fields.length !== INDEX_COLUMNS.length) throw new Error(`JunoCam index line has ${fields.length} fields, not ${INDEX_COLUMNS.length}.`);
  return Object.fromEntries(INDEX_COLUMNS.map((name, i) => [name, fields[i]!.trim()])) as IndexRow;
}
export const parseIndex = (text: string) => text.split(/\r?\n/u).filter(line => line.trim()).map(parseIndexLine);

/** A product id such as JNCR_2022272_45C00001_V01 (product SIS, 4.2): type, year and day of year, orbit, filter combination, image index, version. */
export function parseProductId(id: string) {
  const match = /^JNC([ERM])_(\d{4})(\d{3})_(\d{2})([A-Z])(\d{5})_V(\d{2})$/u.exec(id);
  if (!match) throw new Error(`Not a JunoCam product id: ${id}.`);
  return { type: match[1] === 'E' ? 'EDR' : match[1] === 'R' ? 'RDR' : 'MAP', year: Number(match[2]), dayOfYear: Number(match[3]), orbit: Number(match[4]), filterCombination: match[5]!, index: Number(match[6]), version: Number(match[7]) } as const;
}

/** A number with its PDS unit, such as `1515.1 <km>`. */
export const indexNumber = (text: string) => { const value = Number(text.replace(/<[^<>]*>/gu, '').trim()); return Number.isFinite(value) ? value : null; };

export interface ProgramImage { productId: string; startTime: string; altitudeKm: number; url: string; bytes: number; sha256?: string; labelUrl: string; labelBytes: number; labelSha256?: string }
export interface JunocamProgram {
  schema: typeof PROGRAM_SCHEMA; id: string; volume: string;
  target: { name: string; naifId: number; bodyFrame: string };
  kernelSet: string; kernels: string[]; images: ProgramImage[];
}

export function parseProgram(value: unknown): JunocamProgram {
  const record = requireRecord(value, 'JunoCam program'), target = requireRecord(record.target, 'program target');
  if (record.schema !== PROGRAM_SCHEMA) throw new TypeError(`A JunoCam program states the schema ${PROGRAM_SCHEMA}.`);
  const optionalDigest = (digest: unknown) => digest === undefined ? {} : /^[a-f0-9]{64}$/u.test(String(digest)) ? digest : (() => { throw new TypeError('Invalid digest in JunoCam program.'); })();
  const images = requireArray(record.images, 'program images').map(entry => { const image = requireRecord(entry, 'program image');
    const sha256 = optionalDigest(image.sha256), labelSha256 = optionalDigest(image.labelSha256);
    return { productId: requireString(image.productId), startTime: requireString(image.startTime), altitudeKm: requireFiniteNumber(image.altitudeKm), url: requireString(image.url), bytes: requireFiniteNumber(image.bytes),
      ...(typeof sha256 === 'string' ? { sha256 } : {}), labelUrl: requireString(image.labelUrl), labelBytes: requireFiniteNumber(image.labelBytes), ...(typeof labelSha256 === 'string' ? { labelSha256 } : {}) }; });
  const id = requireString(record.id);
  if (!/^[a-z][a-z0-9-]*$/u.test(id) || !images.length || images.some(image => parseProductId(image.productId).type !== 'RDR' || !image.url.startsWith(VOLUMES) || !image.labelUrl.startsWith(VOLUMES)))
    throw new TypeError('A JunoCam program names calibrated products of the PDS JunoCam volumes.');
  return { schema: PROGRAM_SCHEMA, id, volume: requireString(record.volume), target: { name: requireString(target.name), naifId: requireFiniteNumber(target.naifId), bodyFrame: requireString(target.bodyFrame) },
    kernelSet: requireString(record.kernelSet), kernels: requireArray(record.kernels, 'program kernels').map(kernel => requireString(kernel)), images };
}
export const readProgram = async (id: string) => parseProgram(JSON.parse(await readFile(resolve(PROGRAMS, `${id}.json`), 'utf8')));
export const writeProgram = async (program: JunocamProgram) => { await mkdir(PROGRAMS, { recursive: true }); await writeFile(resolve(PROGRAMS, `${program.id}.json`), JSON.stringify(program, null, 2) + '\n'); };

export async function fetchText(url: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}.`);
  return response.text();
}
const contentLength = async (url: string, fetcher: typeof fetch) => {
  const response = await fetcher(url, { method: 'HEAD' }), length = Number(response.headers.get('content-length'));
  if (!response.ok || !Number.isInteger(length) || length <= 0) throw new Error(`${url} states no size (${response.status}).`);
  return length;
};

/** The calibrated images of one target in one volume that hold the red, green and blue strips. */
export const colourImages = (rows: readonly IndexRow[], target: string, orbit?: number) => rows.filter(row => {
  if (row.TARGET_NAME.toUpperCase() !== target.toUpperCase() || row.STANDARD_DATA_PRODUCT_ID !== 'JUNOCAM-RDR') return false;
  const product = parseProductId(row.PRODUCT_ID), strips = FILTER_COMBINATIONS[product.filterCombination] ?? [];
  return ['RED', 'GREEN', 'BLUE'].every(strip => strips.includes(strip)) && (orbit === undefined || product.orbit === orbit);
});

export async function pinProgram(id: string, volume: string, target: { name: string; naifId: number; bodyFrame: string }, kernels: readonly string[], orbit?: number, fetcher: typeof fetch = fetch): Promise<JunocamProgram> {
  if (!/^JNOJNC_\d{4}$/u.test(volume)) throw new TypeError('A JunoCam volume is named JNOJNC_nnnn.');
  const rows = colourImages(parseIndex(await fetchText(`${VOLUMES}${volume}/INDEX/INDEX.TAB`, fetcher)), target.name, orbit);
  if (!rows.length) throw new Error(`${volume} lists no calibrated colour image of ${target.name}${orbit === undefined ? '' : ` on orbit ${orbit}`}.`);
  const images: ProgramImage[] = [];
  for (const row of rows) {
    const labelUrl = `${VOLUMES}${volume}/${row.FILE_SPECIFICATION_NAME}`, url = labelUrl.replace(/\.LBL$/u, '.IMG'), altitudeKm = indexNumber(row.SPACECRAFT_ALTITUDE);
    if (!labelUrl.endsWith('.LBL') || altitudeKm === null) throw new Error(`Unexpected index row for ${row.PRODUCT_ID}.`);
    images.push({ productId: row.PRODUCT_ID, startTime: `${row.START_TIME}Z`, altitudeKm, url, bytes: await contentLength(url, fetcher), labelUrl, labelBytes: await contentLength(labelUrl, fetcher) });
  }
  return parseProgram({ schema: PROGRAM_SCHEMA, id, volume, target, kernelSet: KERNEL_SET, kernels: [...kernels], images });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), flag = (name: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args.splice(i, 2)[1]; };
  const orbit = flag('orbit'), kernels = flag('kernels'), [id, volume, name, naifId, bodyFrame] = args;
  if (!id || !volume || !name || !naifId || !bodyFrame || !kernels) throw new TypeError('Usage: archive.mts <program id> <volume> <target> <naif id> <body frame> --kernels <comma-separated bank paths in load order> [--orbit <n>]');
  const program = await pinProgram(id, volume, { name, naifId: Number(naifId), bodyFrame }, kernels.split(','), orbit === undefined ? undefined : Number(orbit));
  await writeProgram(program);
  console.log(JSON.stringify({ program: program.id, images: program.images.map(image => image.productId) }));
}
