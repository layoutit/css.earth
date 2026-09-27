#!/usr/bin/env node
/** Build the IHW/PDS near-nucleus Halley ledger from its fixed-width PDS file table.
 *
 *   pnpm exec node tools/cli/run-typed-module.mjs tools/objects/ihw/archive-ledger.mts FILELIST.TAB --write
 *
 * The archive table is the index. This code preserves every observation identity and does not infer bandpasses from filter
 * names. The selected archive-final product is qualified only while its committed record agrees with the official pins. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '@cssearth/core/node';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { parseProductRecord } from '@cssearth/telescope';

export const IHW_LEDGER_SCHEMA = 'cssearth-ihw-ledger@1';
export const IHW_DATASET = 'IHW-C-NNSN-3-EDR-HALLEY-V2.0';
export const IHW_DATASET_URL = 'https://pdssbn.astro.umd.edu/holdings/ihw-c-nnsn-3-edr-halley-v2.0/dataset.shtml';
export const IHW_FILELIST_URL = 'https://pdssbn.astro.umd.edu/holdings/ihw-c-nnsn-3-edr-halley-v2.0/index/filelist.tab';
const ROOT = resolve(import.meta.dirname, '../../..');

/** The one body the dataset observes, the name the archive gives it, and the archive-final program qualified from it with that
 * program's observation and science product. They are data beside the programs (`ledger-focus.json`), because the archive code
 * names no body. */
export interface IhwLedgerFocus {
  readonly object: string; readonly targetName: string;
  readonly archiveFinal: { readonly program: string; readonly observation: string; readonly product: string };
}
export const IHW_LEDGER_FOCUS = 'tools/objects/ihw/ledger-focus.json';
export async function ihwLedgerFocus(path = resolve(ROOT, IHW_LEDGER_FOCUS)): Promise<IhwLedgerFocus> {
  const record = requireRecord(JSON.parse(await readFile(path, 'utf8')) as unknown, 'IHW ledger focus');
  if (record.schema !== 'cssearth-archive-ledger-focus@1') throw new TypeError(`${path} is not an archive ledger focus.`);
  const objects = requireArray(record.objects, 'focus objects').map(id => requireString(id, 'focus object'));
  if (objects.length !== 1) throw new TypeError(`${path} names ${objects.length} objects; the IHW dataset observes one.`);
  const archiveFinal = requireRecord(record.archiveFinal, 'focus archiveFinal');
  return { object: objects[0]!, targetName: requireString(record.targetName, 'focus targetName'),
    archiveFinal: { program: requireString(archiveFinal.program, 'focus archive-final program'),
      observation: requireString(archiveFinal.observation, 'focus archive-final observation'), product: requireString(archiveFinal.product, 'focus archive-final product') } };
}
const receiptPath = (program: string) => `tools/objects/ihw/programs/${program}.archive-final.product.json`;

export interface IhwObservation {
  readonly id: string; readonly archiveObservationId: string; readonly observationTimeIso: string; readonly filter: string;
  readonly exposureSeconds: number; readonly airmass: number; readonly quality: string; readonly observatory: string;
  readonly instrument: string; readonly detector: string; readonly units: string; readonly pixelScaleArcsec: number;
}

const field = (line: string, start: number, bytes: number): string => line.slice(start - 1, start - 1 + bytes).trim();
export function parseFileList(text: string): IhwObservation[] {
  const rows = text.split(/\r?\n/u).filter(Boolean).map((line, index) => {
    if (line.length < 147 || line.length > 150) throw new TypeError(`IHW FILELIST row ${index + 1} has ${line.length} characters, outside the archive table's rows.`);
    const number = (start: number, bytes: number, name: string) => { const value = Number(field(line, start, bytes)); if (!Number.isFinite(value)) throw new TypeError(`IHW FILELIST row ${index + 1} has no ${name}.`); return value; };
    const scale = line.match(/([0-9]+\.[0-9]+)$/u);
    if (!scale?.index) throw new TypeError(`IHW FILELIST row ${index + 1} has no trailing pixel scale.`);
    return { id: field(line, 1, 8), observationTimeIso: `${field(line, 10, 19)}Z`, archiveObservationId: field(line, 30, 6), filter: field(line, 37, 9),
      exposureSeconds: number(47, 6, 'exposure'), airmass: number(54, 6, 'airmass'), quality: field(line, 61, 9), observatory: field(line, 71, 18),
      instrument: field(line, 90, 17), detector: field(line, 108, 16), units: line.slice(124, scale.index).replace(/^[' ]+|[' ]+$/gu, ''), pixelScaleArcsec: Number(scale[1]) };
  });
  if (rows.length !== 3523) throw new TypeError(`IHW FILELIST has ${rows.length} observations, not the archive's 3523.`);
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new TypeError('IHW FILELIST repeats a file identity.');
  return rows;
}

async function archiveFinalQualified(focus: IhwLedgerFocus): Promise<boolean> {
  const { program: id, observation, product } = focus.archiveFinal, receipt = receiptPath(id);
  const programPath = resolve(ROOT, `tools/objects/ihw/programs/${id}.archive-final.json`);
  const program = requireRecord(JSON.parse(await readFile(programPath, 'utf8')) as unknown, 'IHW archive-final program');
  const record = parseProductRecord(JSON.parse(await readFile(resolve(ROOT, receipt), 'utf8')) as unknown);
  if (program.schema !== 'cssearth-ihw-archive-final@1' || program.id !== id || program.target !== focus.object || program.observation !== observation) return false;
  const files = requireArray(program.files, 'IHW archive-final files').map(raw => requireRecord(raw, 'IHW archive-final file'));
  const selection = requireRecord(record.parameters.selection, 'IHW archive-final selection');
  return record.telescope === 'IHW/PDS' && record.stage === 'archive-final' && record.software.length === 0
    && selection.program === id && selection.observation === observation && selection.target === focus.object
    && files.length === 2 && files.every(file => {
      const role = requireString(file.role, 'file role'), name = requireString(file.name, 'file name'), uri = requireString(file.uri, 'file uri');
      return record.inputs.some(input => input.role === role && input.identity === uri)
        && record.outputs.some(output => output.path === name);
    }) && record.evidence.length === 1 && record.evidence[0]?.kind === 'archive-origin' && record.evidence[0].receipt === receipt
    && record.evidence[0].product === product;
}

export async function buildIhwLedger(fileList: string) {
  const focus = await ihwLedgerFocus(), program = focus.archiveFinal.program;
  const observations = parseFileList(fileList), qualified = await archiveFinalQualified(focus);
  return { schema: IHW_LEDGER_SCHEMA, archiveDate: '2026-09-19', dataset: { id: IHW_DATASET, status: 'ARCHIVED', target: focus.object, targetName: focus.targetName,
      source: IHW_DATASET_URL, index: { url: IHW_FILELIST_URL, bytes: Buffer.byteLength(fileList) } },
    modes: [{ mode: 'NNSN image', records: 'edited near-nucleus images in the archive-supplied relative-intensity units', observations: observations.length,
      programs: [program], checked: [], receipts: [receiptPath(program)], archiveFinal: { programs: [program], qualified: qualified ? [program] : [] } }],
    objects: [{ id: focus.object, observations }] } as const;
}

async function main(args: readonly string[]) {
  const source = args.find(arg => !arg.startsWith('-'));
  if (!source) throw new TypeError('Usage: archive-ledger FILELIST.TAB [--write]');
  const ledger = await buildIhwLedger(await readFile(resolve(source), 'utf8'));
  const json = `${JSON.stringify(ledger, null, 2)}\n`;
  if (args.includes('--write')) await writeFile(resolve(ROOT, 'data/ihw/ledger.json'), json); else process.stdout.write(json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
