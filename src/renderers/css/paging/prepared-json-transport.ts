import type { PreparedReference } from "./types.js";
async function readBounded(stream: ReadableStream<Uint8Array> | null, size: number) {
  if (!stream) throw new Error("Prepared JSON response is empty.");
  const reader = stream.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > size) throw new Error("Prepared JSON size drifted.");
      chunks.push(value);
    }
    if (length !== size) throw new Error("Prepared JSON size drifted.");
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } catch (error) { await reader.cancel(); throw error; }
}
async function verify(bytes: Uint8Array<ArrayBuffer>, expected: string | undefined) {
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
  if (digest !== expected) throw new Error("Prepared JSON identity drifted.");
}
export async function readPreparedBytes(response: Response, reference: PreparedReference) {
  const bytes = await readBounded(response.body, reference.bytes);
  await verify(bytes, reference.sha256);
  return bytes;
}
export async function readPreparedJson(response: Response, reference: PreparedReference): Promise<unknown> {
  let bytes = await readPreparedBytes(response, reference);
  if (reference.encoding === "gzip") {
    if (!Number.isSafeInteger(reference.decodedBytes) || (reference.decodedBytes ?? 0) < 1 || (reference.decodedBytes ?? Infinity) > 32 * 1024 * 1024) {
      throw new Error("Prepared JSON decoded capacity is invalid.");
    }
    bytes = await readBounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")), reference.decodedBytes!);
    await verify(bytes, reference.decodedSha256);
  } else if (reference.encoding !== undefined) throw new Error("Unsupported prepared JSON encoding.");
  return JSON.parse(new TextDecoder().decode(bytes));
}
