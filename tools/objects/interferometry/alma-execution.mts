#!/usr/bin/env node
/** What one ALMA execution contains, read without downloading it.
 *
 *   node tools/objects/interferometry/alma-execution.mts <raw tarball url>
 *
 * The raw visibilities of one execution are a tarball of tens of gigabytes, and the archive refuses byte ranges, so there is no
 * way to ask for part of it. But a tar is read in order, and this one begins with the two tables that describe the whole
 * execution: `ASDM.xml`, the index of every table and its row count, and `Main.xml`, one row per subscan with its field, its
 * antennas, its integration count and the size of the binary that holds it. Both arrive inside the first megabyte. Streaming
 * the tarball and stopping after them costs a megabyte and answers what five hours of download would contain.
 *
 * This is the pre-flight for `alma-restore.mts`: how many antennas, how long on the target, how much of the volume is the
 * target rather than its calibrators. */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** Tar keeps a 512-byte header before each member, with the name at 0 and the octal size at 124. */
const BLOCK = 512;
export interface TarMember { readonly name: string; readonly bytes: Buffer }

/** Members read from the head of a tar stream, stopping as soon as every wanted name has been seen. */
export function readTarHead(stream: Buffer, wanted: readonly string[]): TarMember[] {
  const found: TarMember[] = [], remaining = new Set(wanted);
  // GNU tar writes a path longer than the header's 100 bytes as a `././@LongLink` member whose body is the real name of the
  // member that follows. ALMA's deliveries carry both forms: the same archive nests member ids deep enough to need it.
  let longName: string | null = null;
  for (let offset = 0; offset + BLOCK <= stream.length && remaining.size > 0;) {
    const header = stream.subarray(offset, offset + BLOCK);
    const stated = header.subarray(0, 100).toString('ascii').replace(/\0.*$/su, '');
    if (!stated) break;
    const size = Number.parseInt(header.subarray(124, 136).toString('ascii').replace(/[\0 ]/gu, ''), 8);
    if (!Number.isSafeInteger(size) || size < 0) throw new TypeError(`A tar header states no readable size for ${stated}.`);
    const start = offset + BLOCK, end = start + size, next = start + Math.ceil(size / BLOCK) * BLOCK;
    const type = header.subarray(156, 157).toString('ascii');
    if (type === 'L') {
      if (end > stream.length) throw new RangeError('A long name is not complete in the streamed head.');
      longName = stream.subarray(start, end).toString('ascii').replace(/\0.*$/su, '');
      offset = next; continue;
    }
    const name = longName ?? stated;
    longName = null;
    // A PAX extended header describes the member after it and is not one itself.
    if (type !== 'x' && type !== 'g') {
      const base = name.split('/').at(-1) ?? '';
      if (remaining.has(base) && !base.startsWith('._')) {
        if (end > stream.length) throw new RangeError(`${base} is not complete in the streamed head.`);
        found.push({ name, bytes: stream.subarray(start, end) });
        remaining.delete(base);
      }
    }
    offset = next;
  }
  if (remaining.size) throw new RangeError(`The streamed head does not reach ${[...remaining].join(', ')}.`);
  return found;
}

const rows = (xml: string) => [...xml.matchAll(/<row>([\s\S]*?)<\/row>/gu)].map(match => match[1]!);
const field = (row: string, name: string) => {
  const match = new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`, 'u').exec(row);
  return match ? match[1]! : null;
};
/** ALMA's ArrayTime: nanoseconds since the modified Julian day zero. */
export const arrayTimeToDate = (value: number) => new Date((value / 1e9 - 3506716800) * 1000);

export interface Subscan {
  readonly scan: number; readonly subscan: number; readonly field: string; readonly configuration: string;
  readonly antennas: number; readonly integrations: number; readonly seconds: number; readonly dataBytes: number;
  readonly start: Date;
}
export interface ExecutionSummary {
  readonly entityId: string; readonly created: Date;
  readonly tables: ReadonlyMap<string, number>;
  readonly subscans: readonly Subscan[];
  readonly antennas: number;
  readonly totalDataBytes: number;
  /** Seconds and bytes per field, so the share that is the science target is visible before the download. */
  readonly byField: ReadonlyMap<string, { seconds: number; bytes: number; subscans: number }>;
}

export function parseExecution(asdmXml: string, mainXml: string): ExecutionSummary {
  const entity = /<Entity entityId="([^"]+)"[^>]*entityTypeName="ASDM"/u.exec(asdmXml);
  const created = /<TimeOfCreation>\s*([^<]+?)\s*<\/TimeOfCreation>/u.exec(asdmXml);
  if (!entity || !created) throw new TypeError('An ASDM index states its entity and its time of creation.');
  const tables = new Map<string, number>();
  for (const table of asdmXml.matchAll(/<Table>\s*<Name>\s*([A-Za-z]+)\s*<\/Name>\s*<NumberRows>\s*(\d+)\s*<\/NumberRows>/gu)) {
    tables.set(table[1]!, Number(table[2]!));
  }
  if (!tables.size) throw new TypeError('An ASDM index lists its tables and their row counts.');
  const subscans = rows(mainXml).map((row): Subscan => {
    const integrations = Number(field(row, 'numIntegration') ?? Number.NaN);
    const interval = Number(field(row, 'interval') ?? Number.NaN);
    const time = Number(field(row, 'time') ?? Number.NaN);
    if (!Number.isFinite(integrations) || !Number.isFinite(interval) || !Number.isFinite(time)) throw new TypeError('A Main row states its time, interval and integration count.');
    return { scan: Number(field(row, 'scanNumber')), subscan: Number(field(row, 'subscanNumber')),
      field: field(row, 'fieldId') ?? 'unknown', configuration: field(row, 'configDescriptionId') ?? 'unknown',
      antennas: Number(field(row, 'numAntenna')), integrations, seconds: interval / 1e9,
      dataBytes: Number(field(row, 'dataSize') ?? 0), start: arrayTimeToDate(time) };
  });
  if (!subscans.length) throw new TypeError('A Main table lists at least one subscan.');
  const byField = new Map<string, { seconds: number; bytes: number; subscans: number }>();
  for (const subscan of subscans) {
    const current = byField.get(subscan.field) ?? { seconds: 0, bytes: 0, subscans: 0 };
    current.seconds += subscan.seconds; current.bytes += subscan.dataBytes; current.subscans += 1;
    byField.set(subscan.field, current);
  }
  return { entityId: entity[1]!, created: new Date(created[1]!.replace(/(\.\d{3})\d+$/u, '$1')), tables, subscans,
    antennas: Math.max(...subscans.map(subscan => subscan.antennas)),
    totalDataBytes: subscans.reduce((sum, subscan) => sum + subscan.dataBytes, 0), byField };
}

/** Stream a raw tarball only as far as the two tables that describe it. */
export async function peekExecution(url: string, capBytes = 4 * 1024 * 1024) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`${url} answered ${response.status}.`);
  const chunks: Buffer[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (size < capBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value)); size += value.length;
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const head = Buffer.concat(chunks);
  const [asdm, main] = readTarHead(head, ['ASDM.xml', 'Main.xml']);
  return { summary: parseExecution(asdm!.bytes.toString('utf8'), main!.bytes.toString('utf8')), readBytes: size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const url = process.argv[2];
  if (!url) throw new TypeError('Usage: alma-execution.mts <raw tarball url>');
  const { summary, readBytes } = await peekExecution(url);
  const gb = (bytes: number) => `${(bytes / 1e9).toFixed(2)} GB`;
  console.log(`${summary.entityId}  observed ${summary.created.toISOString().slice(0, 19)}Z`);
  console.log(`  ${summary.antennas} antennas, ${summary.subscans.length} subscans in ${new Set(summary.subscans.map(s => s.scan)).size} scans, ${gb(summary.totalDataBytes)} of visibilities`);
  console.log('  field        subscans    seconds        size');
  for (const [name, totals] of [...summary.byField].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${name.padEnd(12)} ${String(totals.subscans).padStart(8)} ${totals.seconds.toFixed(0).padStart(10)} ${gb(totals.bytes).padStart(11)}`);
  }
  console.log(`  read ${(readBytes / 1e6).toFixed(1)} MB to learn this.`);
}
