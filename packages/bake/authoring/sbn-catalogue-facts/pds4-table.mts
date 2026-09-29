/**
 * Read a PDS4 table through its own label: field names, positions and missing-value constants come from the label, and
 * the record count must match it. Handles Table_Delimited (PDS DSV 1) and Table_Character. Tables and labels are read
 * from a local cache laid out as the SBN non-mission archive path, and downloaded on request.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface LabelField { name: string; location: number; length: number; missing: string[] }
export interface Label { lidvid: string; kind: 'delimited' | 'character'; offset: number; records: number; delimiter: string; fields: LabelField[] }
export interface Row { recordNumber: number; fields: Record<string, string> }
export interface Table { url: string; lidvid: string; label: Label; rows: Row[] }

const tag = (xml: string, name: string) => { const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml); return match ? match[1]!.trim() : undefined; };

export function readLabel(xml: string): Label {
  const identification = tag(xml, 'Identification_Area') ?? '';
  const lid = tag(identification, 'logical_identifier'), vid = tag(identification, 'version_id');
  assert.ok(lid && vid, 'PDS4 label without a logical identifier and version');
  const table = /<Table_(Delimited|Character)>([\s\S]*?)<\/Table_\1>/.exec(xml);
  assert.ok(table, `${lid}: label without a delimited or character table`);
  const block = table[2]!, offset = Number(tag(block, 'offset')), records = Number(tag(block, 'records'));
  assert.ok(Number.isInteger(offset) && Number.isInteger(records) && records > 0, `${lid}: table offset or record count unreadable`);
  const delimiterName = tag(block, 'field_delimiter');
  const delimiter = delimiterName === undefined ? '' : ({ Comma: ',', 'Vertical Bar': '|' } as Record<string, string>)[delimiterName] ?? '';
  if (table[1] === 'Delimited') assert.ok(delimiter, `${lid}: unsupported field delimiter ${delimiterName}`);
  const fields = [...block.matchAll(/<Field_(Delimited|Character)>([\s\S]*?)<\/Field_\1>/g)].map(match => {
    const field = match[2]!, name = tag(field, 'name');
    assert.ok(name, `${lid}: unnamed field`);
    const missing = [...field.matchAll(/<(?:missing|unknown|not_applicable|invalid)_constant>([\s\S]*?)<\//g)].map(value => value[1]!.trim().replace(/^'(.*)'$/, '$1'));
    return { name, location: Number(tag(field, 'field_location') ?? 0), length: Number(tag(field, 'field_length') ?? 0), missing };
  });
  assert.ok(fields.length, `${lid}: label without fields`);
  return { lidvid: `${lid}::${vid}`, kind: table[1] === 'Delimited' ? 'delimited' : 'character', offset, records, delimiter, fields };
}

/** PDS DSV 1: fields separated by the delimiter, optionally double-quoted, records separated by CRLF. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [], field = '', quoted = false, touched = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') { quoted = true; touched = true; }
    else if (char === delimiter) { record.push(field); field = ''; touched = true; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      if (touched || field) { record.push(field); records.push(record); }
      record = []; field = ''; touched = false;
    } else { field += char; touched = true; }
  }
  if (touched || field) { record.push(field); records.push(record); }
  return records;
}

export function readTable(url: string, label: Label, bytes: Buffer): Table {
  const data = bytes.subarray(label.offset);
  let rows: Row[];
  if (label.kind === 'delimited') {
    const records = parseDelimited(data.toString('utf8'), label.delimiter);
    rows = records.map((values, index) => {
      assert.equal(values.length, label.fields.length, `${label.lidvid}: record ${index + 1} has ${values.length} fields, the label ${label.fields.length}`);
      return { recordNumber: index + 1, fields: Object.fromEntries(label.fields.map((field, column) => [field.name, values[column]!.trim()])) };
    });
  } else {
    const lines: Buffer[] = [];
    let start = 0;
    for (let index = 0; index <= data.length; index++) {
      if (index === data.length || data[index] === 0x0a) {
        const line = data.subarray(start, index > start && data[index - 1] === 0x0d ? index - 1 : index);
        if (line.length) lines.push(line);
        start = index + 1;
      }
    }
    rows = lines.map((line, index) => ({ recordNumber: index + 1,
      fields: Object.fromEntries(label.fields.map(field => [field.name, line.subarray(field.location - 1, field.location - 1 + field.length).toString('utf8').trim()])) }));
  }
  assert.equal(rows.length, label.records, `${label.lidvid}: ${rows.length} records, the label declares ${label.records}`);
  return { url, lidvid: label.lidvid, label, rows };
}

/** A field's value, or undefined when blank or equal to one of the label's missing constants. */
export function value(table: Table, row: Row, name: string): string | undefined {
  const field = table.label.fields.find(candidate => candidate.name === name);
  assert.ok(field, `${table.lidvid}: no field ${name}`);
  const text = row.fields[name];
  if (text === undefined || text === '' || text === '-') return undefined;
  if (field.missing.some(constant => constant === text || (Number.isFinite(Number(constant)) && Number(constant) === Number(text) && /^[-+.\dEe]+$/.test(text)))) return undefined;
  return text;
}
export function numeric(table: Table, row: Row, name: string): number | undefined {
  const text = value(table, row, name);
  if (text === undefined) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

const cachePath = (root: string, cache: string, url: string) => {
  const match = /\/non_mission\/(.+)$/.exec(url);
  assert.ok(match, `Not an SBN non-mission URL: ${url}`);
  return resolve(root, cache, match[1]!);
};
async function cached(root: string, cache: string, url: string, fetchMissing: boolean): Promise<Buffer> {
  const path = cachePath(root, cache, url);
  try { return await readFile(path); } catch (error) {
    if (!fetchMissing) throw new Error(`${url} is not in ${cache}; run with --fetch.`, { cause: error });
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  assert.ok(response.ok, `${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return bytes;
}
/** A table and its PDS4 label (the same path with .xml), read from the cache below `root`; `fetchMissing` downloads what is absent. */
export async function loadTable(root: string, cache: string, url: string, fetchMissing: boolean): Promise<Table> {
  const labelUrl = url.replace(/\.[a-z]+$/i, '.xml');
  const label = readLabel((await cached(root, cache, labelUrl, fetchMissing)).toString('utf8'));
  return readTable(url, label, await cached(root, cache, url, fetchMissing));
}
