async function readBounded(stream, size) {
  const reader = stream.getReader(), chunks = []; let length = 0;
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
async function verify(bytes, expected) {
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
  if (digest !== expected) throw new Error("Prepared JSON identity drifted.");
}
export async function readPreparedJson(response, reference) {
  let bytes = await readBounded(response.body, reference.bytes);
  await verify(bytes, reference.sha256);
  if (reference.encoding === "gzip") {
    if (!Number.isSafeInteger(reference.decodedBytes) || reference.decodedBytes < 1 || reference.decodedBytes > 32 * 1024 * 1024) {
      throw new Error("Prepared JSON decoded capacity is invalid.");
    }
    bytes = await readBounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")), reference.decodedBytes);
    await verify(bytes, reference.decodedSha256);
  } else if (reference.encoding !== undefined) throw new Error("Unsupported prepared JSON encoding.");
  return JSON.parse(new TextDecoder().decode(bytes));
}
