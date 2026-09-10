import type { PreparedReference, PreparedDirectory } from "../../renderers/css/paging/types.ts";
import { PREPARED_BLOCK_LIMITS, decodePreparedBlockAsync, restoreWmtsRecords } from "./prepared-block.mts";
import { isPreparedAssetPath } from "./city-asset-url.mts";

export const PREPARED_BLOCK_ENCODING = "gzip-cssearth-prepared-columns@1";
const HASH = /^[a-f0-9]{64}$/u;

export const preparedReferenceKey = (ref: PreparedReference) => `${ref.url}#${ref.offset ?? "all"}:${ref.bytes}:${ref.sha256}`;

export function isPreparedBlockReference(ref: PreparedReference, assetPath = /^\/scenes\/[a-z][a-z0-9-]*\//u.exec(ref?.url ?? "")?.[0]) {
  return ref?.encoding === PREPARED_BLOCK_ENCODING && HASH.test(ref.sha256 ?? "") && HASH.test(ref.decodedSha256 ?? "") &&
    isPreparedAssetPath(assetPath) && ref.url.startsWith(assetPath) &&
    [ref.bytes, ref.decodedBytes].every(value => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= PREPARED_BLOCK_LIMITS.bytes) &&
    (ref.offset === undefined ? ref.url === `${assetPath}wmts-index-${ref.sha256.slice(0, 16)}.bin.gz` :
      Number.isSafeInteger(ref.offset) && ref.offset >= 0 && ref.offset + ref.bytes <= 32*1024*1024 &&
      /^wmts-[a-f0-9]{16}\/\d+-\d+-\d+\.pack$/u.test(ref.url.slice(assetPath.length)));
}

async function readBounded(stream: ReadableStream<Uint8Array> | null, expected: number, signal: AbortSignal) {
  if (!stream) throw new Error("Missing prepared block body.");
  const reader = stream.getReader(), parts = []; let size = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > expected) throw new Error("Prepared block exceeds its declared byte length.");
      parts.push(value);
    }
    if (size !== expected) throw new Error("Prepared block byte length mismatch.");
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return bytes;
  } catch (error) { await reader.cancel(error).catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}
async function verifyHash(bytes: Uint8Array<ArrayBuffer>, expected: string) {
  const actual = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== expected) throw new Error("Prepared block hash mismatch.");
}

export async function readPreparedWmtsBlock(response: Response, ref: PreparedReference, signal: AbortSignal): Promise<PreparedDirectory> {
  if (!isPreparedBlockReference(ref)) throw new Error("Invalid prepared WMTS block reference.");
  if (!response.ok) throw new Error(`Prepared WMTS block: HTTP ${response.status}`);
  if (ref.offset !== undefined) {
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(response.headers.get("Content-Range") ?? "");
    if (response.status !== 206 || !match || Number(match[1]) !== ref.offset || Number(match[2]) !== ref.offset + ref.bytes - 1 ||
        Number(match[3]) < ref.offset + ref.bytes || Number(match[3]) > 32*1024*1024) {
      await response.body?.cancel();
      throw new Error("Prepared pack server did not honor the exact byte range.");
    }
  }
  const encoded = await readBounded(response.body, ref.bytes, signal);
  await verifyHash(encoded, ref.sha256);
  const decoded = await readBounded(new Blob([encoded]).stream().pipeThrough(new DecompressionStream("gzip")), ref.decodedBytes!, signal);
  await verifyHash(decoded, ref.decodedSha256!);
  const decodedBlock = await decodePreparedBlockAsync(decoded, { signal, withEnvelope: true });
  if (Array.isArray(decodedBlock)) throw new Error("Missing prepared WMTS block envelope.");
  const { records, envelope } = decodedBlock;
  if (envelope?.schema === "cssearth-city-index@1" && Array.isArray(envelope.nodes)) {
    if(envelope.metadataOnly && (records.length!==1 || records[0].metadataOnly!==true || Object.keys(records[0]).length!==1))throw new Error("Invalid metadata-only prepared block.");
    const pages = envelope.metadataOnly ? [] : restoreWmtsRecords(records), nodes=envelope.nodes, external=envelope.external;
    if (!nodes.length || nodes.length > 85 || !Array.isArray(external) || external.length > 64) throw new Error("Invalid prepared WMTS subtree.");
    const all=[...nodes,...pages,...external], keys=new Set(all.map(n=>n.key)), pageKeys=new Set(pages.map(p=>p.key));
    const byKey=new Map(all.map(n=>[n.key,n]));
    if(keys.size!==all.length)throw new Error("Duplicate prepared WMTS tree key.");
    const used=new Set();
    for(const node of nodes){
      if(!Array.isArray(node.pages)||!Array.isArray(node.children)||node.children.length>4)throw new Error("Invalid prepared WMTS tile group.");
      for(const key of node.pages){if(!pageKeys.has(key)||used.has(key))throw new Error("Prepared WMTS tile coverage mismatch.");used.add(key);}
      for(const key of node.children)if(!byKey.has(key)||byKey.get(key)!.level!==node.level+1)throw new Error("Invalid prepared WMTS child.");
    }
    const assetPath=/^\/scenes\/[a-z][a-z0-9-]*\//u.exec(ref.url)![0];
    if(used.size!==pages.length||external.some(n=>!n.stub||!isPreparedBlockReference(n.directory!,assetPath)))throw new Error("Incomplete prepared WMTS subtree.");
    return {schema:envelope.schema,dataset:envelope.dataset,nodes:[...nodes,...pages],external};
  }
  if (envelope?.schema !== "cssearth-city-index@1" || !envelope.root || !Array.isArray(envelope.root.children)) throw new Error("Invalid prepared WMTS block topology.");
  const pages = restoreWmtsRecords(records);
  const keys = new Set(pages.map(page => page.key));
  if (keys.size !== pages.length || keys.has(envelope.root.key) || new Set(envelope.root.children).size !== pages.length ||
      envelope.root.children.length !== pages.length || envelope.root.children.some(key => !keys.has(key))) throw new Error("Prepared WMTS block coverage mismatch.");
  return { schema: envelope.schema, dataset: envelope.dataset, nodes: [envelope.root, ...pages], external: [] };
}
