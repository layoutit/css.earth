/** Which readings of each tracked FITS file the reader accepts, and the message of every one it refuses, so the
 * recorded outcomes pin the reader's behaviour on every FITS file the repository tracks. The readers are parameters.
 * The refusals in `tests/fixtures/fits/repository-inputs.json` are those of the three readers that preceded
 * `@cssearth/fits` (`tools/fits/fits.mts` with its rice and sky modules, `tools/objects/observation/fits.mts` and
 * `tools/nebula/application/fits.ts`); the package refuses the same readings with the same messages.
 *
 *   node tests/fits/repository-inputs.mts --write   rewrite the outcomes from the package, after an intended change */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { requireRecord, requireString } from '@cssearth/core';

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

/** `read` when the reader returns, or its refusal message. */
async function reading(read: () => unknown): Promise<string> {
  try { await read(); return 'read'; }
  catch (error) { return `refused: ${error instanceof Error ? error.message : String(error)}`; }
}

/** The outcome of each reading of one repository file. */
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
  if (value.schema !== 'cssearth-fits-repository-inputs@2') throw new TypeError(`${PINS}: schema ${String(value.schema)} is not cssearth-fits-repository-inputs@2.`);
  requireString(value.writtenBy);
  return Object.fromEntries(Object.entries(requireRecord(value.files)).map(([path, entry]) =>
    [path, Object.fromEntries(Object.entries(requireRecord(entry)).map(([key, outcome]) => {
      const text = requireString(outcome);
      if (key !== 'bytes' && text !== 'read' && !text.startsWith('refused: '))
        throw new TypeError(`${PINS}: ${path} ${key} is ${JSON.stringify(text)}, not read or a refusal.`);
      return [key, text];
    }))]));
}

export async function writePins(readers: FitsReaders, writtenBy: string) {
  const files: Record<string, Record<string, string>> = {};
  for (const path of trackedFitsFiles()) files[path] = await summarize(readers, path);
  await writeFile(resolve(ROOT, PINS), JSON.stringify({ schema: 'cssearth-fits-repository-inputs@2', writtenBy, files }, null, 2) + '\n');
  return Object.keys(files).length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).join(' ') !== '--write') throw new Error('Usage: node tests/fits/repository-inputs.mts --write');
  const fits = await import('@cssearth/fits'), node = await import('@cssearth/fits/node');
  const count = await writePins({ ...fits, readFitsFileHdus: node.readFitsFileHdus }, '@cssearth/fits');
  console.log(`Pinned ${count} FITS files in ${PINS}.`);
}
