import { paperRoot, readPaperIndex, readPaperPage, type PaperReference } from './types';

export async function loadPaperIndex(localFile: (path: string)=>string, catalogue: string, signal: AbortSignal) {
  const response = await fetch(localFile(`${paperRoot}/index.json`),{cache:'no-store',signal});
  if(response.status===404) return null;
  if(!response.ok) throw new Error(`Paper index unavailable (${response.status}).`);
  const index = readPaperIndex(await response.json());
  if(index.catalogue!==catalogue) throw new Error(`Paper index belongs to catalogue ${index.catalogue}, not ${catalogue}.`);
  return index;
}
export async function loadPapers(reference: PaperReference, localFile: (path: string)=>string, signal: AbortSignal) {
  if(!reference.path) return null;
  const response = await fetch(localFile(reference.path),{signal});
  if(!response.ok) throw new Error(`Papers unavailable (${response.status}).`);
  const bytes = await response.arrayBuffer();
  if(bytes.byteLength!==reference.bytes) throw new Error(`Paper file ${reference.path} has ${bytes.byteLength} bytes, not ${String(reference.bytes)}. Reload the index.`);
  const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const page = readPaperPage(JSON.parse(text));
  if(page.objectId!==reference.objectId || page.simbadId!==reference.simbadId || page.papers.length!==reference.count || page.expectedCount!==reference.expectedCount) throw new Error('Papers do not match the selected object.');
  return page;
}
