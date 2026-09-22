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
import { sha256 } from '../../../src/platform/sha256.mts';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { parseProductRecord } from '../product-record.mts';

export const IHW_LEDGER_SCHEMA = 'cssearth-ihw-ledger@1';
export const IHW_DATASET = 'IHW-C-NNSN-3-EDR-HALLEY-V2.0';
export const IHW_DATASET_URL = 'https://pdssbn.astro.umd.edu/holdings/ihw-c-nnsn-3-edr-halley-v2.0/dataset.shtml';
export const IHW_FILELIST_URL = 'https://pdssbn.astro.umd.edu/holdings/ihw-c-nnsn-3-edr-halley-v2.0/index/filelist.tab';
export const IHW_FILELIST_SHA256 = 'aee5a1d0cfb7884f4fe84e5aa3c78730aa928e5794a63d9e7dc8e482c98a1f8e';
const ROOT = resolve(import.meta.dirname, '../../..');
const PROGRAM = 'comet-1p-nnsn1121';
const RECEIPT = `tools/objects/ihw/programs/${PROGRAM}.archive-final.product.json`;

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

async function archiveFinalQualified(): Promise<boolean> {
  const programPath = resolve(ROOT, `tools/objects/ihw/programs/${PROGRAM}.archive-final.json`);
  const program = requireRecord(JSON.parse(await readFile(programPath, 'utf8')) as unknown, 'IHW archive-final program');
  const record = parseProductRecord(JSON.parse(await readFile(resolve(ROOT, RECEIPT), 'utf8')) as unknown);
  if (program.schema !== 'cssearth-ihw-archive-final@1' || program.id !== PROGRAM || program.target !== 'comet-1p' || program.observation !== 'NNSN1121') return false;
  const files = requireArray(program.files, 'IHW archive-final files').map(raw => requireRecord(raw, 'IHW archive-final file'));
  const selection = requireRecord(record.parameters.selection, 'IHW archive-final selection');
  return record.telescope === 'IHW/PDS' && record.stage === 'archive-final' && record.software.length === 0
    && selection.program === PROGRAM && selection.observation === 'NNSN1121' && selection.target === 'comet-1p'
    && files.length === 2 && files.every(file => {
      const role = requireString(file.role, 'file role'), name = requireString(file.name, 'file name'), uri = requireString(file.uri, 'file uri');
      const bytes = Number(file.bytes), digest = requireString(file.sha256, 'file sha256');
      return record.inputs.some(input => input.role === role && input.identity === uri && input.bytes === bytes && input.sha256 === digest)
        && record.outputs.some(output => output.path === name && output.bytes === bytes && output.sha256 === digest);
    }) && record.evidence.length === 1 && record.evidence[0]?.kind === 'archive-origin' && record.evidence[0].receipt === RECEIPT
    && record.evidence[0].product === 'nnsn1121.fit';
}

export async function buildIhwLedger(fileList: string) {
  if (sha256(fileList) !== IHW_FILELIST_SHA256) throw new Error('FILELIST.TAB is not the pinned IHW/PDS index.');
  const observations = parseFileList(fileList), qualified = await archiveFinalQualified();
  return { schema: IHW_LEDGER_SCHEMA, archiveDate: '2026-09-19', dataset: { id: IHW_DATASET, status: 'ARCHIVED', target: 'comet-1p', targetName: '1P/HALLEY 1 (1682 Q1)',
      source: IHW_DATASET_URL, index: { url: IHW_FILELIST_URL, bytes: Buffer.byteLength(fileList), sha256: IHW_FILELIST_SHA256 } },
    modes: [{ mode: 'NNSN image', records: 'edited near-nucleus images in the archive-supplied relative-intensity units', observations: observations.length,
      programs: [PROGRAM], checked: [], receipts: [RECEIPT], archiveFinal: { programs: [PROGRAM], qualified: qualified ? [PROGRAM] : [] } }],
    objects: [{ id: 'comet-1p', observations }] } as const;
}

async function main(args: readonly string[]) {
  const source = args.find(arg => !arg.startsWith('-'));
  if (!source) throw new TypeError('Usage: archive-ledger FILELIST.TAB [--write]');
  const ledger = await buildIhwLedger(await readFile(resolve(source), 'utf8'));
  const json = `${JSON.stringify(ledger, null, 2)}\n`;
  if (args.includes('--write')) await writeFile(resolve(ROOT, 'data/ihw/ledger.json'), json); else process.stdout.write(json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
