import { isArray } from '../../../src/platform/is-array.mts';
import { PREPARED_BLOCK_SCHEMA, PREPARED_BLOCK_LIMITS } from "../../../src/platform/prepared-map/prepared-block.mts";

import { requireRecord, requireArray, requireFiniteNumber } from '../../sources/source-values.mts';
import type { WmtsPage } from './contracts.mts';
// Galaxy's independent field streams and second differences, applied to the
// bits of finished doubles. Unlike fixed-point quantization, this is lossless.
export function encodePreparedBlock(records: readonly unknown[], { envelope = null }: { envelope?: unknown } = {}) {
  if (!isArray(records) || records.length < 1 || records.length > PREPARED_BLOCK_LIMITS.rows) throw new Error("Invalid prepared record count.");
  const columns: ({ type: "string"; values: string[] } | { type: "number"; order: number; bytes: number })[] = [], payloads: Uint8Array[] = [];
  const bitsView = new DataView(new ArrayBuffer(8));
  const template = (values: readonly unknown[], depth = 0): unknown[] => {
    if (depth > 16) throw new Error("Prepared records are too deeply nested.");
    const first = values[0];
    if (first === null || typeof first === "boolean") {
      if (!values.every(value => Object.is(value, first))) throw new Error("Prepared literal fields must be constant.");
      return ["value", first];
    }
    if (typeof first === "number" || typeof first === "string") {
      if (!values.every(value => typeof value === typeof first && (typeof value !== "number" || Number.isFinite(value)))) throw new Error("Prepared field types differ.");
      // JSON constants cannot preserve negative zero; keep those in the bitstream.
      if (!Object.is(first, -0) && values.every(value => Object.is(value, first))) return ["value", first];
      const index = columns.length;
      if (typeof first === "string") columns.push({ type: "string", values: values.map(value => { if (typeof value !== "string") throw new Error("Prepared string field differs"); return value; }) });
      else {
        const bits = values.map(value => { bitsView.setFloat64(0, requireFiniteNumber(value), true); return bitsView.getBigUint64(0, true); });
        const candidates = [0, 1, 2].map(order => {
          const output = []; let previous = 0n, delta = 0n;
          for (const value of bits) {
            const residual = value - (order === 0 ? 0n : previous + (order === 2 ? delta : 0n));
            let encoded = residual < 0n ? -2n * residual - 1n : 2n * residual;
            do { const byte = Number(encoded & 127n); encoded >>= 7n; output.push(byte | (encoded ? 128 : 0)); } while (encoded);
            delta = value - previous; previous = value;
          }
          return { order, bytes: Uint8Array.from(output) };
        }).sort((a, b) => a.bytes.length - b.bytes.length || a.order - b.order);
        const best = candidates[0];
        columns.push({ type: "number", order: best.order, bytes: best.bytes.length }); payloads.push(best.bytes);
      }
      if (columns.length > PREPARED_BLOCK_LIMITS.columns) throw new Error("Too many prepared columns.");
      return ["field", index];
    }
    if (isArray(first)) {
      if (!values.every(value => isArray(value) && value.length === first.length)) throw new Error("Prepared array shapes differ.");
      return ["array", ...first.map((_, i) => template(values.map(value => requireArray(value)[i]), depth + 1))];
    }
    if (first && typeof first === "object") {
      const keys = Object.keys(first);
      if (!values.every(value => value && !isArray(value) && typeof value === "object" && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)))) throw new Error("Prepared object shapes differ.");
      return ["object", ...keys.map(key => [key, template(values.map(value => requireRecord(value)[key]), depth + 1)])];
    }
    throw new Error("Unsupported prepared field.");
  };
  const shape = template(records);
  const header = new TextEncoder().encode(JSON.stringify({ schema: PREPARED_BLOCK_SCHEMA, rows: records.length, template: shape, columns, envelope }));
  const payloadBytes = payloads.reduce((sum, payload) => sum + payload.length, 0);
  const result = new Uint8Array(16 + header.length + payloadBytes);
  if (result.length > PREPARED_BLOCK_LIMITS.bytes) throw new Error("Prepared block exceeds its byte budget.");
  result.set(new TextEncoder().encode("CECOL001"));
  const view = new DataView(result.buffer);
  view.setUint32(8, header.length, true); view.setUint32(12, payloadBytes, true);
  result.set(header, 16); let offset = 16 + header.length;
  for (const payload of payloads) { result.set(payload, offset); offset += payload.length; }
  return result;
}

export function packWmtsRecords(pages: readonly WmtsPage[]) {
  return pages.map(page => ({ ...page,
    frameMatrix: page.frameMatrix.split(",").map(Number),
    textureMatrix: page.textureMatrix.split(",").map(Number),
    imageMatrix: page.imageMatrix.split(",").map(Number),
  }));
}
