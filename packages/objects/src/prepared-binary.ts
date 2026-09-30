/**
 * How a prepared binary file travels. The asset host compresses JSON but serves `.bin` as it is (2026-09-30:
 * `application/octet-stream`, no content encoding), so a binary file is compressed at preparation and expanded by the
 * browser's own `DecompressionStream`. Before compression each typed region is byte-shuffled: the first bytes of every
 * element, then the second bytes, and so on, so gzip finds the runs a column's high bytes form (the Blosc and HDF5
 * shuffle filter). Unpacking returns the original bytes exactly, so every format keeps its own decoder unchanged. The
 * bake packs with `packPreparedBinary` (`@cssearth/objects/node`); the page reads with the renderer's `readPreparedBinary`.
 *
 * Measured on the published files (gzip level 9, 2026-09-30): the Stellar Neighbourhood's 2,799,000-byte star bank
 * packs to 1,930,377 bytes (gzip alone 2,278,113); 300 orbit banks from 1,276,080 to 617,485 bytes.
 *
 * Layout inside the gzip stream: magic `CSPBIN01`, u32 original byte length, u32 region count, then per region u32
 * offset, u32 byte length and u32 element bytes (1, 2, 4 or 8), then the original bytes with each region shuffled.
 */
export const PREPARED_BINARY_MAGIC = 'CSPBIN01';
const HEADER_BYTES = 16, REGION_BYTES = 12, ELEMENT_BYTES = new Set([1, 2, 4, 8]);

/** A typed run of a prepared file: `bytes` long from `offset`, made of `elementBytes`-wide values. */
export interface PreparedBinaryRegion { readonly offset: number; readonly bytes: number; readonly elementBytes: number }

function checkRegions(length: number, regions: readonly PreparedBinaryRegion[], at: string) {
  const sorted = [...regions].sort((a, b) => a.offset - b.offset);
  let end = 0;
  for (const region of sorted) {
    const { offset, bytes, elementBytes } = region;
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(bytes) || offset < end || bytes < 0 || offset + bytes > length ||
        !ELEMENT_BYTES.has(elementBytes) || bytes % elementBytes !== 0) {
      throw new TypeError(`${at}: prepared binary region ${JSON.stringify(region)} must lie inside the file's ${length} bytes after the region before it, whole elements of 1, 2, 4 or 8 bytes.`);
    }
    end = offset + bytes;
  }
}

function shuffle(source: Uint8Array, target: Uint8Array, { offset, bytes, elementBytes }: PreparedBinaryRegion, inverse: boolean) {
  const count = bytes / elementBytes;
  for (let element = 0; element < count; element++) for (let byte = 0; byte < elementBytes; byte++) {
    const plain = offset + element * elementBytes + byte, planar = offset + byte * count + element;
    if (inverse) target[plain] = source[planar]!; else target[planar] = source[plain]!;
  }
}

/** The file ready for compression: the container header and the bytes with every region shuffled. */
export function shufflePreparedBinary(bytes: Uint8Array, regions: readonly PreparedBinaryRegion[], at = 'prepared binary'): Uint8Array {
  checkRegions(bytes.byteLength, regions, at);
  const header = HEADER_BYTES + regions.length * REGION_BYTES, output = new Uint8Array(header + bytes.byteLength);
  const view = new DataView(output.buffer);
  for (let index = 0; index < PREPARED_BINARY_MAGIC.length; index++) output[index] = PREPARED_BINARY_MAGIC.charCodeAt(index);
  view.setUint32(8, bytes.byteLength, true); view.setUint32(12, regions.length, true);
  regions.forEach((region, index) => {
    view.setUint32(HEADER_BYTES + index * REGION_BYTES, region.offset, true);
    view.setUint32(HEADER_BYTES + index * REGION_BYTES + 4, region.bytes, true);
    view.setUint32(HEADER_BYTES + index * REGION_BYTES + 8, region.elementBytes, true);
  });
  const body = output.subarray(header);
  body.set(bytes);
  for (const region of regions) shuffle(bytes, body, region, false);
  return output;
}

/** The original bytes of an expanded container, in a buffer of their own (so typed-array views start aligned). */
export function unshufflePreparedBinary(container: Uint8Array, at = 'prepared binary'): ArrayBuffer {
  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  if (container.byteLength < HEADER_BYTES || String.fromCharCode(...container.subarray(0, 8)) !== PREPARED_BINARY_MAGIC) {
    throw new TypeError(`${at}: not a prepared binary container (expected magic ${PREPARED_BINARY_MAGIC}).`);
  }
  const length = view.getUint32(8, true), count = view.getUint32(12, true), header = HEADER_BYTES + count * REGION_BYTES;
  if (container.byteLength !== header + length) {
    throw new TypeError(`${at}: prepared binary container holds ${container.byteLength - header} bytes after its ${count} regions; its header says ${length}.`);
  }
  const regions = Array.from({ length: count }, (_, index): PreparedBinaryRegion => ({ offset: view.getUint32(HEADER_BYTES + index * REGION_BYTES, true),
    bytes: view.getUint32(HEADER_BYTES + index * REGION_BYTES + 4, true), elementBytes: view.getUint32(HEADER_BYTES + index * REGION_BYTES + 8, true) }));
  checkRegions(length, regions, at);
  const body = container.subarray(header), output = new Uint8Array(length);
  output.set(body);
  for (const region of regions) shuffle(body, output, region, true);
  return output.buffer;
}
