/** What the FITS reader returns for one file, reduced to a digest per reading, so a recorded set of digests pins the
 * reader's behaviour on every FITS file the repository tracks. The readers are parameters: the recorded digests in
 * `tests/fixtures/fits/repository-inputs.json` were written by the three readers that preceded `@cssearth/fits`
 * (`tools/fits/fits.mts` with its rice and sky modules, `tools/objects/observation/fits.mts` and
 * `tools/nebula/application/fits.ts` at 7e47cf4489), and the test reads the same files through the package.
 *
 *   node tests/fits/repository-inputs.mts --write   rewrite the digests from the package, after an intended change */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { isRecord, requireRecord, requireString } from '@cssearth/core';

type Header = Record<string, string | number | boolean | undefined>;
/** The package's readers, or any readers with the same signatures. */
export interface FitsReaders {
  readFitsHdus(bytes: Buffer): readonly { readonly nextOffset: number }[];
  readFitsImage(bytes: Buffer, options: { start: number }): unknown;
  readFitsHeader(bytes: Buffer, start: number): { readonly header: Header };
  readFitsPrimary(bytes: Buffer): unknown;
  decodeFits(bytes: Buffer): unknown;
  readRiceCompressedImage(bytes: Buffer): unknown;
  readFitsFileHdus(path: string): Promise<unknown>;
  skyImageAxes(header: Header): unknown;
}
export const ROOT = resolve(import.meta.dirname, '../..');
export const PINS = 'tests/fixtures/fits/repository-inputs.json';

/** A JSON-stable form: typed arrays by their bytes, and the numbers JSON cannot hold by name. */
function stable(value: unknown): unknown {
  if (ArrayBuffer.isView(value)) return { [value.constructor.name]: createHash('sha256').update(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)).digest('hex') };
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : Number.isFinite(value) ? value : String(value);
  if (value === undefined) return '(undefined)';
  if (Array.isArray(value)) return value.map(stable);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, stable(entry)]));
  return value;
}
async function reading(read: () => unknown): Promise<string> {
  try { return createHash('sha256').update(JSON.stringify(stable(await read()))).digest('hex'); }
  catch (error) { return `refused: ${error instanceof Error ? error.message : String(error)}`; }
}

/** One digest (or refusal message) per reading of one repository file. */
export async function summarize(readers: FitsReaders, path: string): Promise<Record<string, string>> {
  const raw = await readFile(resolve(ROOT, path)), bytes = path.endsWith('.gz') ? gunzipSync(raw) : raw;
  const result: Record<string, string> = { bytes: String(bytes.length) };
  result.hdus = await reading(() => readers.readFitsHdus(bytes));
  let starts = [0];
  try { starts = readers.readFitsHdus(bytes).map((_, index, hdus) => index ? hdus[index - 1]!.nextOffset : 0); } catch { /* the refusal is recorded above */ }
  for (const start of starts) {
    result[`image@${start}`] = await reading(() => readers.readFitsImage(bytes, { start }));
    result[`sky@${start}`] = await reading(() => readers.skyImageAxes(readers.readFitsHeader(bytes, start).header));
  }
  result.primary = await reading(() => readers.readFitsPrimary(bytes));
  result.transport = await reading(() => readers.decodeFits(bytes));
  result.rice = await reading(() => readers.readRiceCompressedImage(bytes));
  // The file reader locates the same HDUs without reading data; a gzip member is not a FITS file on disk.
  if (!path.endsWith('.gz')) result.fileHdus = await reading(() => readers.readFitsFileHdus(resolve(ROOT, path)));
  return result;
}

/** Every tracked FITS file, in path order. */
export function trackedFitsFiles(): string[] {
  return execFileSync('git', ['ls-files', '*.fits', '*.fit', '*.fits.gz', '*.fit.gz'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
}

export async function readPins(): Promise<Record<string, Record<string, string>>> {
  const value = requireRecord(JSON.parse(await readFile(resolve(ROOT, PINS), 'utf8')));
  if (value.schema !== 'cssearth-fits-repository-inputs@1') throw new TypeError(`${PINS}: unexpected schema.`);
  requireString(value.writtenBy);
  return Object.fromEntries(Object.entries(requireRecord(value.files)).map(([path, entry]) =>
    [path, Object.fromEntries(Object.entries(requireRecord(entry)).map(([key, digest]) => [key, requireString(digest)]))]));
}

export async function writePins(readers: FitsReaders, writtenBy: string) {
  const files: Record<string, Record<string, string>> = {};
  for (const path of trackedFitsFiles()) files[path] = await summarize(readers, path);
  await writeFile(resolve(ROOT, PINS), JSON.stringify({ schema: 'cssearth-fits-repository-inputs@1', writtenBy, files }, null, 2) + '\n');
  return Object.keys(files).length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).join(' ') !== '--write') throw new Error('Usage: node tests/fits/repository-inputs.mts --write');
  const fits = await import('@cssearth/fits'), node = await import('@cssearth/fits/node');
  const count = await writePins({ ...fits, readFitsFileHdus: node.readFitsFileHdus }, '@cssearth/fits');
  console.log(`Pinned ${count} FITS files in ${PINS}.`);
}
