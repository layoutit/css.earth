import { paperRoot, readPaperIndex, readPaperPage, type PaperReference } from './types';

export async function sha256(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function loadPaperIndex(localFile: (path: string)=>string, catalogueSha256: string, signal: AbortSignal) {
  const response = await fetch(localFile(`${paperRoot}/index.json`),{cache:'no-store',signal});
  if(response.status===404) return null;
  if(!response.ok) throw new Error(`Paper index unavailable (${response.status}).`);
  const index = readPaperIndex(await response.json());
  if(index.catalogueSha256!==catalogueSha256) throw new Error('Paper index belongs to a different object catalogue.');
  return index;
}
export async function loadPapers(reference: PaperReference, localFile: (path: string)=>string, signal: AbortSignal) {
  if(!reference.path) return null;
  const response = await fetch(localFile(reference.path),{signal});
  if(!response.ok) throw new Error(`Papers unavailable (${response.status}).`);
  const bytes = await response.arrayBuffer();
  if(bytes.byteLength!==reference.bytes || await sha256(bytes)!==reference.sha256) throw new Error('Paper file failed its integrity check. Reload the index.');
  const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const page = readPaperPage(JSON.parse(text));
  if(page.objectId!==reference.objectId || page.simbadId!==reference.simbadId || page.papers.length!==reference.count || page.expectedCount!==reference.expectedCount) throw new Error('Papers do not match the selected object.');
  return page;
}
