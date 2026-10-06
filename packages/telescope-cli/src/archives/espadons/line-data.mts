/** The published atomic line list of line-data.json, on disk under .local/espadons/line-data at its pinned size, fetched
 * when it is not there. */
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { readAtomicLines, type AtomicLine } from './kurucz.mts';
import { DOWNLOADS } from './program.mts';

const HERE = dirname(fileURLToPath(import.meta.url)), DIRECTORY = resolve(DOWNLOADS, 'line-data');
const run = (command: string, args: readonly string[]) => new Promise<number>(done => { const child = spawn(command, args, { stdio: 'ignore' }); child.on('error', () => done(1)); child.on('close', code => done(code ?? 1)); });
export interface LineDataPin { readonly name: string; readonly url: string; readonly bytes: number; readonly credit: string }
export async function lineDataPin(): Promise<LineDataPin> {
  const record = requireRecord(requireRecord(requireRecord(JSON.parse(await readFile(resolve(HERE, 'line-data.json'), 'utf8')), 'line data').files, 'line data files').lines, 'line data lines');
  return { name: requireString(record.name, 'lines.name'), url: requireString(record.url, 'lines.url'), bytes: requireFiniteNumber(record.bytes, 'lines.bytes'), credit: requireString(record.credit, 'lines.credit') };
}
/** The pinned file's path, downloaded when it is missing or short; refused at any size but the pinned one. */
async function pinned(pin: LineDataPin): Promise<string> { if (!/^[A-Za-z0-9._-]+$/u.test(pin.name)) throw new TypeError(`Invalid line-data file name ${pin.name}.`);
  const path = resolve(DIRECTORY, pin.name), size = () => stat(path).then(info => info.size, () => -1); await mkdir(DIRECTORY, { recursive: true });
  for (let attempt = 1; attempt <= 5 && await size() !== pin.bytes; attempt++) await run('curl', ['-s', '-L', '-C', '-', '-A', 'cssEarth-telescope/1.0 (https://css.earth)', '-o', path, pin.url]);
  if (await size() !== pin.bytes) throw new Error(`${pin.url} did not download to its pinned ${pin.bytes} bytes (${await size()} on disk at ${path}).`);
  return path; }
/** The list's lines between two wavelengths (nm), with the pin they were read from. */
export async function loadAtomicLines(fromNm: number, toNm: number): Promise<{ readonly lines: AtomicLine[]; readonly pin: LineDataPin; readonly undecided: readonly number[] }> {
  const pin = await lineDataPin(), read = await readAtomicLines(await pinned(pin), fromNm, toNm);
  return { lines: read.lines, pin, undecided: read.undecided };
}
