import type { PreparedPage, PreparedDirectory, PreparedReference } from "./types.js";
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
interface Template extends Array<unknown> { 0: "field" | "value" | "array" | "object"; }
interface NumericColumn { type: "number"; order: number; bytes: number; offset: number; end: number; values: Float64Array; previous: bigint; delta: bigint; }
interface StringColumn { type: "string"; values: string[]; }
type Column = NumericColumn | StringColumn;
interface BlockEnvelope { schema: string; dataset: string; nodes?: PreparedPage[]; external?: PreparedPage[]; root?: PreparedPage; metadataOnly?: boolean; }
interface BlockHeader { schema: string; rows: number; columns: Column[]; template: Template; envelope: BlockEnvelope; }
// Transport only: restore the exact IEEE-754 values and strings written by
// preparation. No coordinate projection, matrix fitting or source derivation.
export const PREPARED_BLOCK_SCHEMA = "cssearth-prepared-columns@1";
export const PREPARED_BLOCK_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, rows: 2048, columns: 192 });
const MAGIC = "CECOL001";
const MAX_BITS = (1n << 64n) - 1n;

export function createPreparedBlockDecoder(bytes: Uint8Array) {
  const limits = PREPARED_BLOCK_LIMITS;
  if (!(bytes instanceof Uint8Array) || bytes.length < 16 || bytes.length > limits.bytes ||
      String.fromCharCode(...bytes.subarray(0, 8)) !== MAGIC) throw new Error("Invalid prepared block header.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerBytes = view.getUint32(8, true), payloadBytes = view.getUint32(12, true);
  if (headerBytes > bytes.length - 16 || headerBytes + payloadBytes + 16 !== bytes.length) throw new Error("Invalid prepared block length.");
  const header: BlockHeader = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(16, 16 + headerBytes)));
  if (header.schema !== PREPARED_BLOCK_SCHEMA || !Number.isSafeInteger(header.rows) || header.rows < 1 || header.rows > limits.rows ||
      !Array.isArray(header.columns) || header.columns.length > limits.columns) throw new Error("Invalid prepared block counts.");
  const streams: Column[] = [];
  let offset = 16 + headerBytes;
  for (const column of header.columns) {
    if (column.type === "number") {
      if (![0, 1, 2].includes(column.order) || !Number.isSafeInteger(column.bytes) || column.bytes < header.rows || column.bytes > header.rows * 10) throw new Error("Invalid prepared numeric column.");
      streams.push({ ...column, offset, end: offset + column.bytes, values: new Float64Array(header.rows), previous: 0n, delta: 0n });
      offset += column.bytes;
    } else if (column.type === "string") {
      if (!Array.isArray(column.values) || column.values.length !== header.rows || column.values.some(value => typeof value !== "string")) throw new Error("Invalid prepared string column.");
      streams.push(column);
    } else throw new Error("Invalid prepared column type.");
  }
  if (offset !== bytes.length) throw new Error("Prepared column lengths disagree.");
  let templateNodes = 0;
  const validateTemplate = (node: Template, depth = 0) => {
    if (!Array.isArray(node) || depth > 16 || ++templateNodes > 1024) throw new Error("Invalid prepared record template.");
    const [kind, value] = node;
    if (kind === "field") {
      if (!Number.isSafeInteger(value) || !streams[value as number] || node.length !== 2) throw new Error("Invalid prepared field address.");
    } else if (kind === "value") {
      if (node.length !== 2 || !["number", "string", "boolean"].includes(typeof value) && value !== null || typeof value === "number" && !Number.isFinite(value)) throw new Error("Invalid prepared constant.");
    } else if (kind === "array") {
      for (const child of node.slice(1)) validateTemplate(child as Template, depth + 1);
    } else if (kind === "object") {
      const keys = new Set();
      for (const entry of node.slice(1)) {
        if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || keys.has(entry[0])) throw new Error("Invalid prepared object fields.");
        keys.add(entry[0]); validateTemplate(entry[1] as Template, depth + 1);
      }
    } else throw new Error("Invalid prepared template type.");
  };
  validateTemplate(header.template);
  const numeric = streams.filter(stream => stream.type === "number");
  const numberBytes = new DataView(new ArrayBuffer(8));
  const rows: Record<string, Json>[] = [];
  let columnIndex = 0, rowIndex = 0;
  const restore = (node: Template, row: number): Json => {
    const [kind, value] = node;
    if (kind === "value") return value as Json;
    if (kind === "field") return streams[value as number].values[row];
    if (kind === "array") return node.slice(1).map(child => restore(child as Template, row));
    return Object.fromEntries((node.slice(1) as [string, Template][]).map(([key, child]) => [key, restore(child as Template, row)]));
  };
  return {
    envelope: header.envelope,
    get done() { return rows.length === header.rows; },
    step(maximumValues = 1024) {
      if (!Number.isSafeInteger(maximumValues) || maximumValues < 1) throw new Error("Invalid prepared decode slice.");
      let operations = 0;
      while (operations < maximumValues && columnIndex < numeric.length) {
        const stream = numeric[columnIndex];
        let encoded = 0n, shift = 0n, finished = false;
        for (let i = 0; i < 10; i++) {
          if (stream.offset >= stream.end) throw new Error("Prepared numeric column ended early.");
          const byte = bytes[stream.offset++];
          encoded |= BigInt(byte & 127) << shift;
          if (!(byte & 128)) { finished = true; break; }
          shift += 7n;
        }
        if (!finished) throw new Error("Prepared numeric residual overflow.");
        const residual = encoded & 1n ? -(encoded + 1n) / 2n : encoded / 2n;
        const bits = residual + (stream.order === 0 ? 0n : stream.previous + (stream.order === 2 ? stream.delta : 0n));
        if (bits < 0n || bits > MAX_BITS) throw new Error("Prepared floating-point bits overflow.");
        numberBytes.setBigUint64(0, bits, true);
        const value = numberBytes.getFloat64(0, true);
        if (!Number.isFinite(value)) throw new Error("Non-finite prepared value.");
        stream.values[rowIndex++] = value;
        stream.delta = bits - stream.previous; stream.previous = bits;
        operations++;
        if (rowIndex === header.rows) {
          if (stream.offset !== stream.end) throw new Error("Prepared numeric column has trailing data.");
          columnIndex++; rowIndex = 0;
        }
      }
      while (columnIndex === numeric.length && rows.length < header.rows && operations < maximumValues) {
        rows.push(restore(header.template, rows.length) as Record<string, Json>);
        operations += templateNodes;
      }
      return this.done;
    },
    result() {
      if (!this.done) throw new Error("Prepared block decode is incomplete.");
      return rows;
    },
  };
}

export function decodePreparedBlock(bytes: Uint8Array) {
  const decoder = createPreparedBlockDecoder(bytes);
  while (!decoder.step()) {}
  return decoder.result();
}

export async function decodePreparedBlockAsync(bytes: Uint8Array, { signal, yieldTask = () => new Promise<void>(resolve => setTimeout(resolve, 0)), withEnvelope = false }: { signal?: AbortSignal; yieldTask?: () => Promise<void>; withEnvelope?: boolean } = {}) {
  const decoder = createPreparedBlockDecoder(bytes);
  for (;;) {
    signal?.throwIfAborted();
    if (decoder.step()) return withEnvelope ? { records: decoder.result(), envelope: decoder.envelope } : decoder.result();
    await yieldTask();
  }
}

export function restoreWmtsRecords(records: Record<string, Json>[]): PreparedPage[] {
  return records.map(record => {
    for (const name of ["frameMatrix", "textureMatrix", "imageMatrix"]) {
      if (!Array.isArray(record[name]) || record[name].length !== 16 || record[name].some(value => !Number.isFinite(value))) throw new Error("Invalid prepared WMTS matrix.");
    }
    return { ...record, frameMatrix: (record.frameMatrix as number[]).join(","), textureMatrix: (record.textureMatrix as number[]).join(","), imageMatrix: (record.imageMatrix as number[]).join(",") } as unknown as PreparedPage;
  });
}
